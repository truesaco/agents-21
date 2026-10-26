# M4 QA report: README, demo script and production deploy

**Verdict: BLOCK**

All four product rules pass, and every automated check is green. M4 is still blocked on one item. PRD M4 test step 2 ("Turn the passcode on ... try live mode. It asks for the passcode.") cannot pass, because the app has no passcode input. Section 6 of the PRD says "A milestone is done only when its test steps pass", and this step is known to fail. It is not just unverified. The fix is either a small frontend change or a PRD change that only you can approve (see B-1).

Auditor: `qa-evidence-auditor`. Diff audited: `git diff 14dc973..HEAD` (bead2e8, deac0d6, ca0751a merge, 66adf02, d17b637, 958f44e) on `main`.

## The four rules

| Rule | Result | Evidence |
|---|---|---|
| 1. Closed evidence set | Pass (one older wording gap, F-4) | `netlify/lib/prompt.mjs` is unchanged in the diff. `prompt.mjs:7` says "The documents are the complete evidence set ... Do not use outside knowledge". `analyze.mjs` sends no `tools` and makes one request per vendor (`tests/rules.test.js`). M4 adds only the passcode gate and `limit.status` (`analyze.mjs:49-68, 82`). The request body is not changed. The How it works panel (`HowItWorks.jsx:19`) and README:9 describe the rule correctly. |
| 2. Traceable claims | Pass | `src/lib/verify.js`, `src/lib/segment.js`, `src/lib/requirements.js`, `src/demo/demoResults.json` and `src/samples/` are all unchanged (`git diff --stat 14dc973..HEAD` on these paths is empty). Every demo quote still resolves to its cited locator (`tests/demo.test.js`). Ellipsis-spliced quotes are rejected (`tests/rules.test.js`). Demo-script step 6 quote and locator are confirmed in the demo data (new test). |
| 3. Explicit gaps | Pass | `finalizeFindings` never returns not_documented with evidence (`tests/rules.test.js`, and the new test over all shown demo findings). The intended gaps are unchanged: Turnstile R5, PulseGate R6, Bleacher R4 and R7 (`tests/demo.test.js` plus the new test, which checks exactly those four cells). The panel uses the exact label "Not documented in provided materials." (`HowItWorks.jsx:25`). |
| 4. No winner | Pass | The new UI strings, README, demo script and Netlify checklist only use banned words in negated disclaimers: `HowItWorks.jsx:28` "never picks a winner: there are no scores, no rankings and no recommendations"; README:3, 12, 47; demo-script:87-88. New test `tests/m4Docs.test.js` checks these four files for recommend/best/winner/top choice/preferred/score/rank. Each live request still sees one vendor. |

## M4 scope vs. delivered (docs/PRD.md section 6, M4)

| Scope item | Delivered | Notes |
|---|---|---|
| README with 5-minute demo script, screenshots, setup, env-var reference | Yes | `README.md`, `docs/demo-script.md`, 9 screenshots. `check-docs.mjs` confirms that the env-var table matches the code in both directions, and that all links resolve. |
| In-app "How it works" panel, four principles | Yes | `src/components/HowItWorks.jsx`, rendered at `src/App.jsx:122` |
| Atomic rate-limit write with Blobs conditional writes (R-3) | Yes | `netlify/lib/rateLimit.mjs:65-88` uses `onlyIfMatch` / `onlyIfNew` and a bounded retry. `@netlify/blobs` 11.1.6 supports both options and returns `{ modified }`. |
| Optional shared passcode for live mode (R-4) | **Server side only** | `netlify/lib/passcode.mjs` and the gate in `analyze.mjs`. There is no UI input, and `src/lib/api.js` never sends `X-VendorLens-Passcode` (no `passcode` reference anywhere in `src/`). See B-1. |
| Merge to `main` through a reviewed PR; production from `main` | Partly: PR #1 merged (ca0751a) | Commits 66adf02, d17b637 and 958f44e sit on `main` after the merge. Check whether they went through review (manual). |

| PRD M4 test step | Result |
|---|---|
| 1. Follow the README demo script word for word on the production URL | **Manual.** QA cannot reach production. As a proxy, the demo script was run against the local production build in Chromium and passed 9/9 steps (below). |
| 2. Passcode on, private window, live mode asks for the passcode | **Fails by design.** No input exists. With `LIVE_PASSCODE` set, live mode returns HTTP 401 "Live mode needs the site passcode..." and the user has no way to enter it. README:88 documents this. |
| 3. Netlify shows `main` as production branch, deploy log green | **Manual.** Not checkable from here. |

## Security

| Check | Result | Evidence |
|---|---|---|
| Rate-limit atomicity | Pass | Read with ETag, then a conditional write. On `modified: false` it re-reads, at most 5 attempts with jitter. Tests: no overshoot under 20 concurrent calls, a lost write is retried, a counter at the limit is not rewritten (`tests/rateLimit.test.js`). |
| Fail closed | Pass, with F-2 | A Blobs read/write error or exhausted retries returns 503 (`rateLimit.mjs:121-124`, tests). If the passcode throttle check throws, the result is 503 (`analyze.mjs:54-57`). Exception: if `getStore()` itself throws, the code falls back to per-instance memory (`rateLimit.mjs:129, 169`). See F-2. |
| Passcode constant-time compare | Pass | Both sides are SHA-256 hashed, then compared with `timingSafeEqual` on equal-length digests (`passcode.mjs:24-28`). Non-strings, empty input and inputs over 256 chars are rejected without throwing. The gate runs before body parsing and rate limiting. A locked IP gets 429 even with the right passcode. |
| `/api/status` returns only booleans | Pass | `status.mjs:6-9` returns `{ liveEnabled, passcodeRequired }`, both `Boolean`. A test confirms that neither the passcode nor the key value appears in the output. |
| No secret / ANTHROPIC text in `dist/` | Pass | `check-secrets: OK. 7 file(s) scanned in dist/`. `grep` finds no `sk-ant`, `ANTHROPIC_`, `LIVE_PASSCODE`, `PASSCODE_FAILS_PER_HOUR` or `RATE_LIMIT_`. The only hit is the mixed-case word "Anthropic" in the M1 UI string `RequirementsStep.jsx:90`, which was there before M4 (F-5). |

## Commands run

| Command | Result |
|---|---|
| `npm test` (before adding tests) | 31/31 pass |
| `npm run build` | OK. prebuild and postbuild `check-secrets: OK` |
| `node docs/scripts/check-docs.mjs` | 4/4 PASS (env vars match README in both directions; 22 README and 10 demo-script links resolve) |
| `docs/scripts/check-demo-script.mjs` against `vite preview` of `dist/`, Playwright 1.63 + Chromium 1243 | 9/9 steps PASS, all 24 bold labels seen on screen, no console errors apart from the expected `/api/status` 404. Run from a scratch copy so the committed screenshots were not overwritten. |
| `npm test` (after adding tests) | 35/35 pass |
| `git diff --stat 14dc973..HEAD -- src/lib src/demo src/samples netlify/lib/prompt.mjs` | empty (unchanged) |

## Tests added

`tests/m4Docs.test.js` (4 tests):
1. README, demo script, Netlify checklist and `HowItWorks.jsx` contain no recommend/best/winner/top choice/preferred/score/rank wording, except on negated lines.
2. The How it works panel states all four rules, including the exact label "Not documented in provided materials.", and is rendered in `App.jsx`.
3. The numbers in the docs match the demo data after verification: 47 quotes; exactly four Not documented cells (Bleacher R4, Turnstile R5, PulseGate R6, Bleacher R7) with no quotes; every other cell has at least one quote; Turnstile counts are 8/1/1; the step 6 quote is at `Section "2. Resale Marketplace"`; the CSV export has 51 rows. The README and demo script must contain these figures.
4. If `dist/` exists, it contains no `sk-ant-`, `ANTHROPIC_`, `LIVE_PASSCODE`, `PASSCODE_FAILS_PER_HOUR` or `RATE_LIMIT_` strings.

The minimum checks from the brief (ellipsis split, not_documented without evidence, banned words in prompt and `.jsx`, intended demo gaps, demo quotes at their locators) already exist in `tests/rules.test.js` and `tests/demo.test.js` and still pass. `segment.js` did not change.

## Findings

| ID | Severity | Location | Finding | Fix |
|---|---|---|---|---|
| B-1 | **Blocking** | `src/components/RequirementsStep.jsx` (live option, around :83-92), `src/App.jsx:34`, `src/lib/api.js` | PRD M4 test step 2 cannot pass: the app reads only `liveEnabled` from `/api/status`, has no passcode input, and never sends `X-VendorLens-Passcode`. | **Option A (completes M4 as written):** have `frontend-ui` or `docs-demo` read `passcodeRequired` in `App.jsx:34`. When it is true, show a password input under **Live analysis** in `RequirementsStep.jsx`, kept in memory only (not localStorage). Send it as `X-VendorLens-Passcode` on every `POST /api/analyze` in `src/lib/api.js`. On `code: "passcode_required"`, show the server message and keep the input. On `code: "passcode_locked"`, show the 429 message. Disable **Run comparison** in live mode while the field is empty. Then update README:81, 88, 115 to drop "leave unset", and re-run QA. **Option B (needs your approval):** amend PRD M4 to defer the passcode UI. Change test step 2 to "With `LIVE_PASSCODE` set, `/api/status` returns `passcodeRequired: true` and a live run is refused with 'Live mode needs the site passcode'", and move the UI to M3. QA can then pass M4 without code changes, apart from F-1. |
| F-1 | Medium (must fix with B-1) | `docs/netlify-checklist.md:38`, `docs/netlify-checklist.md:73` | The checklist says "When set, live analysis asks for it" and "try live mode. It asks for the passcode". Neither is true today, and this contradicts README:88. Following the checklist turns on a passcode that nobody can enter, so live mode breaks. | Option A: no change needed once the input ships. Option B: change :38 to "Server-side only for now; leave unset (see README)." and change step 7.4 at :73 to "Live mode is refused with 'Live mode needs the site passcode'. The app has no input yet." |
| F-2 | Medium | `netlify/lib/rateLimit.mjs:129`, `:169`; README:85; `docs/netlify-checklist.md:76` | If `getStore()` throws (for example, the Blobs environment is missing on a deployed function), the limiter silently falls back to per-instance memory. That is effectively unmetered across instances, but the docs say "If Blobs can't be reached, live analysis is refused (503)". Read/write failures do fail closed. | Fall back to memory only off Netlify, for example `openStore() ?? (process.env.NETLIFY || process.env.SITE_ID ? null : memoryStore)`, and return `UNAVAILABLE` / 503 when the store is null. Or reword README:85 and checklist:76 to "If Blobs reads or writes fail, ...; if the Blobs environment is missing, the limit falls back to per-instance memory." Prefer the code fix. |
| F-3 | Low | `netlify/lib/rateLimit.mjs:112-119` | The per-IP counter is incremented before the global check. When the global daily cap is hit, every refused request still uses one of that IP's hourly allowance. This does not fail open. | Optional: check the global cap first, or accept as is and note it. |
| F-4 | Low (carried over from M1-qa, not fixed) | `netlify/lib/prompt.mjs:7` | Rule 1 says the prompt must state no web search, browsing, outside knowledge or vendor contact. It forbids outside knowledge but does not mention the web or vendor contact. No tools are sent, so behaviour is safe. The README and How it works panel now make the full claim. | Append "Do not search the web, browse, or contact the vendor." to `prompt.mjs:7` (owner: `live-mode-tester` or main session). |
| F-5 | Info (from M1) | `src/components/RequirementsStep.jsx:90` | The bundle contains the word "Anthropic" ("add the Anthropic API key"). DevTools search is case-insensitive by default, so PRD M1 test 2 ("search for `ANTHROPIC` ... no matches") would show one hit. There is no secret or env-var name. | Optional: reword to "add the API key in the Netlify environment settings". |
| F-6 | Info | `main` history | 66adf02, d17b637 and 958f44e landed on `main` after the PR #1 merge, so the PRD's "merge through a reviewed PR" may not cover them. | Confirm on GitHub that they were reviewed, or open a follow-up PR for them. |

## What unblocks M4

1. Resolve B-1 with Option A, or approve Option B as a PRD change, and apply the matching F-1 doc fix.
2. Re-run `qa-evidence-auditor` on the change.
3. Run manual test steps 1 and 3 on the production URL and Netlify dashboard.

F-2 is recommended in the same pass but does not block on its own.
