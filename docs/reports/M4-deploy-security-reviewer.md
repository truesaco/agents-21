# M4 deploy-security-reviewer report (R-3, R-4)

## What changed
| File | Change |
|---|---|
| `netlify/lib/rateLimit.mjs` | Atomic counters: `getWithMetadata` (ETag), then `setJSON` with `onlyIfMatch` (existing) or `onlyIfNew` (new). Retries up to 5 times on `modified: false`, with jittered backoff. A counter already at its limit is not written again. Fails closed (503) if Blobs throws or conflicts persist. Falls back to in-memory only when `getStore` itself throws (no Blobs environment, e.g. plain local dev). `RATE_LIMIT_PER_HOUR` / `RATE_LIMIT_GLOBAL_PER_DAY` work as before. Exposes `createRateLimiter`, `incrementIfBelow` and `createMemoryStore` for tests. |
| `netlify/lib/passcode.mjs` (new) | `LIVE_PASSCODE` handling: SHA-256 both sides, then `crypto.timingSafeEqual`. Blank or unset means not required. Input over 256 chars is rejected. |
| `netlify/functions/analyze.mjs` | Passcode check after the key check, before body parsing and rate limiting. Returns 401 `{error, code:"passcode_required"}`. Rate-limit denials now use `limit.status` (429, or 503 on fail-closed). |
| `netlify/functions/status.mjs` | Adds `passcodeRequired` (boolean). |
| `tests/rateLimit.test.js` (new) | 8 tests: per-IP and global limits, onlyIfNew/onlyIfMatch usage, injected conflict then retry without losing the count, 12 concurrent requests against a limit of 5 (exactly 5 allowed), persistent conflict gives 503, read/write errors give 503, no write once at the limit. |
| `tests/passcode.test.js` (new) | 5 tests: unset/blank is open, exact match only, bad input, `/api/status` booleans only, `/api/analyze` 401 before body parsing (and the correct passcode reaches the 400 validation step, so no API call is made). |
| `docs/netlify-checklist.md` | `LIVE_PASSCODE` row plus a new section 7 (set it, scope it to Functions, redeploy, verify, rotate). |

Not changed: `netlify/lib/prompt.mjs`. My role config forbids changing the analysis prompt, so the M1 QA wording item goes back to the main session (see Open items).

## Client contract (for the main session to wire up in `src/`)
- **Discover:** `GET /api/status` returns `{"liveEnabled": boolean, "passcodeRequired": boolean}`.
- **Send:** for `POST /api/analyze`, send the passcode in the request header `X-VendorLens-Passcode: <passcode>`. The body is unchanged. When no passcode is configured, the header is ignored.
- **Errors:** wrong or missing passcode returns HTTP 401 with JSON `{"error": "Live mode needs the site passcode. Enter it and try again, or use demo mode.", "code": "passcode_required"}`. A missing and a wrong passcode get the same response. On 401 the UI should show or refocus the passcode input and not retry automatically.
- **Other statuses:** 429 is a rate limit (message in `error`). 503 means either the key isn't configured or the usage limit couldn't be checked (message in `error`).
- **UI notes:** use `<input type="password" autocomplete="off">`. Keep the value in memory, or `sessionStorage` at most, never `localStorage`. Never include it in URLs or logs. Browsers only accept ISO-8859-1 header values, so tell users the passcode should be ASCII (the checklist says so).

## Checks
| Check | Command | Result |
|---|---|---|
| Unit tests | `npm test` | 27 tests, 27 pass, 0 fail (13 new) |
| Build + secret scan | `npm run build` | exit 0; `check-secrets: OK. 48 file(s) scanned in source` (prebuild) and `OK. 7 file(s) scanned in dist/` (postbuild) |
| Planted fake key fails the scan | wrote `netlify/lib/zz-planted.mjs` containing `"sk-ant-" + 60 x "X"`, ran `node scripts/check-secrets.mjs --source` | `FAILED ... netlify/lib/zz-planted.mjs:1:12 Anthropic API key`, exit 1; file removed afterwards |
| Nothing leaks to dist | `grep -rn "sk-ant\|ANTHROPIC\|LIVE_PASSCODE\|vendorlens-passcode" dist/` | no matches (the header name is not in dist yet because the client isn't wired) |
| Key only read server-side | grep for `ANTHROPIC_API_KEY` outside `process.env.` in `netlify/functions` | only a comment, a user-facing error string in analyze.mjs, and a comment in check-secrets.mjs |
| Memory fallback locally | `node -e` calling `checkRateLimit` without a Blobs env | `getStore` throws `MissingBlobsEnvironmentError`, so it uses memory and returns `{ ok: true }` |

Not run here: a real Netlify Blobs conditional write (no Netlify login). The Blobs v11.1.6 type definitions confirm `onlyIfMatch` / `onlyIfNew` and `WriteResult.modified`. Verify on the deploy preview: run live mode several times, then exceed `RATE_LIMIT_PER_HOUR` (temporarily set it to 2) and check for a 429.

## Open items and risks
1. **Prompt wording (M1 QA item) is not done.** In `netlify/lib/prompt.mjs` line 7, the main session should add "Do not search the web, browse, or contact the vendor." after "...do not infer capabilities that are not written down."
2. **No brute-force throttle on wrong passcodes.** Failed attempts don't use the rate limit, which is deliberate so guesses can't burn quota, but guessing is also unlimited. The mitigation is a long passphrase (stated in the checklist). A follow-up could count failures per IP in the same store.
3. **Fail closed vs. memory fallback.** The memory fallback is used only when no Blobs environment exists at all. On Netlify that environment is always injected, so Blobs outages give 503s. If Netlify ever stopped injecting it, limits would become per-instance, which is the same as the M1 behaviour.
4. **The per-IP counter is incremented before the global check.** A request denied by the global limit still uses one of that IP's hourly slots. This is minor and matches the previous behaviour.
5. **Blobs cost and latency.** Each allowed request is 2 reads and 2 writes, plus retries under contention. That's fine at these limits.
6. `src/` changes (passcode input) are out of my scope, so PRD M4 test step 2 ("asks for the passcode") can't pass until the client is wired up.
