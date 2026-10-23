# M1 — Deployment prep: deploy-security-reviewer report

Date: 2026-10-23. Agent: `deploy-security-reviewer`. Nothing has been committed or pushed.

## Status: one blocker for the main session

`npm run build` in the repo **fails on purpose** at the new post-build scan. The browser bundle contains the literal text `ANTHROPIC_API_KEY`. It comes from a UI string in `src/components/RequirementsStep.jsx:90`:

```
: "Not configured on this site. An admin needs to set ANTHROPIC_API_KEY in Netlify."}
```

This is only the variable's name, not a key, but it breaks PRD M1 test step 2 ("search the JS for `ANTHROPIC` ... no matches"). `src/components/` is outside the files this agent may edit, so I left it as is. Suggested one-line fix, for the main session or `frontend-ui` to apply:

```
: "Not configured on this site. An admin needs to add the Anthropic API key in the Netlify environment settings."}
```

I applied that exact change in a scratch copy of the repo. With it, `npm run build` passes, `dist/` has no matches for `sk-ant` or `ANTHROPIC`, and the headless-browser checks below all pass.

## What changed

| File | Change |
|---|---|
| `netlify.toml` | `[[headers]]` for `/*`: CSP, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`. Long-lived immutable cache for `/assets/*` (hashed files). Comments on routing and on never using a `VITE_` prefix for the key. |
| `scripts/check-secrets.mjs` | New. Scanner with no dependencies (details below). |
| `package.json` (scripts only) | `prebuild` = source scan, `postbuild` = dist scan, plus `check-secrets` to run both by hand. |
| `docs/netlify-checklist.md` | New. Netlify setup steps for the user, plus the 4 M1 test steps. |
| `docs/reports/M1-deploy-security-reviewer.md` | This report. |

Not touched: the prompt, statuses, `src/lib/verify.js`, demo data, the one-call-per-vendor flow, and `netlify/lib/rateLimit.mjs` (no M1 changes needed).

### CSP
```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self';
connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none';
form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests
```
How I chose it: the built `index.html` has one module script and one stylesheet, both same-origin, and nothing inline. `src/` has no `style=` attributes, no external origins, no fonts and no `<form>`. The only fetches are `/api/status` and `/api/analyze`. `vite.config.js` has no `define` or `envPrefix`. pdf.js loads its worker from same-origin `/assets/pdf.worker.min-*.mjs`, so `blob:` is **not** needed in `worker-src`. This was confirmed in the browser (see check 6). The CSV export uses an `<a download>` with a blob URL, which is a navigation and isn't governed by `connect-src`.

### Routing
`/api/status` and `/api/analyze` are routed by each function's `export const config = { path }` (Netlify Functions v2). No redirects exist or are needed. The app has no client-side routes, so I added no SPA fallback. `[[headers]]` apply to static responses. Function responses (JSON) set their own headers.

### Secret scanner (`scripts/check-secrets.mjs`)
- Source set: `git ls-files --cached --others --exclude-standard`, meaning tracked files plus untracked files that aren't ignored, so a new file is caught before its first commit. It skips `node_modules`, `.git`, `dist` and `.netlify`, plus binaries. If there's no git checkout, it walks the directory tree instead.
- What it looks for: `sk-ant-…`, OpenAI-style `sk-…`, AWS `AKIA/ASIA…`, GitHub `ghp_/gho_/…/github_pat_`, Slack `xox?-`, Google `AIza…`, Stripe `sk_live_`, PEM private key headers. It also flags a key-like value assigned to a `*key/secret/token/password*` name, and env-file `*_KEY=/*_TOKEN=/*_SECRET=` values. Those two only count when the value looks random (Shannon entropy at least 3.5 and at least 2 character classes), so placeholders and prose don't trip them.
- In `dist/` only, any `ANTHROPIC_*` name also counts as a finding.
- Output is `file:line:col rule [redacted match]`, and the exit code is 1 on findings. Secret values are cut to 10 characters so a real key is never fully printed into the build log.
- Escape hatch: put `secret-scan:allow` on the line. It's unused today.
- The scanner doesn't flag its own regex definitions or docs that just name the env var. Verified: it scans 41 source files with 0 findings, including `README.md`, `docs/` and this report.

## Checks and evidence

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Unit tests | `npm test` | **PASS**: `# tests 10 / # pass 10 / # fail 0` |
| 2a | Build in repo as it stands | `npm run build` | **FAIL (intended)**: prebuild `check-secrets: OK. 40 file(s) scanned in source`; Vite `✓ built`; postbuild `FAILED ... dist/assets/index-C7A8pcYa.js:183:8512 Anthropic env var name in browser bundle [ANTHROPIC_API_KEY]`; exit 1. Cause: the UI string above. |
| 2b | Build with the one-line UI fix (scratch copy) | `npm run build` | **PASS**: prebuild OK, `✓ built`, postbuild `check-secrets: OK. 7 file(s) scanned in dist/`; exit 0 |
| 3a | Planted fake key in source makes the build fail | wrote `src/__planted_fake_key.js` with an obviously fake Anthropic-format string (the `sk-ant-` prefix followed by `FAKEKEYFORTESTING-notreal-0…`, built by shell concatenation so it never sat in a kept file); `node scripts/check-secrets.mjs --source`; `npm run build` | **FAIL as expected**: `src/__planted_fake_key.js:1:17 Anthropic API key [sk-ant-FAK…(43 chars)]`, exit 1. The build stopped at prebuild and Vite never ran. **File removed**; the rescan is OK. |
| 3b | Key leaking into dist through a `VITE_` var (scratch copy) | added `console.log(import.meta.env.VITE_LEAK_TEST)` and built with a fake `sk-ant-` value in that env var | **FAIL as expected**: the source scan is OK, but postbuild reports `dist/assets/index-DoyebhK0.js:184:8078 Anthropic API key`, exit 1. This shows the post-build gate catches leaks that come in at build time. Reverted; the rebuild exits 0. |
| 3c | Other rules (scratch copy) | planted a `.js` file in dist with a fake sk-ant key and `apiKey:"<random 30 chars>"`, plus an env-style `MY_SERVICE_TOKEN=<random>` in a scripts file, and a low-entropy `token = "placeholder-…"` line | 3 findings (sk-ant, apiKey assignment, *_TOKEN), and the placeholder line is correctly **not** flagged. Removed; the rescan is OK. |
| 4 | No key or env name in dist | `grep -r "sk-ant\|ANTHROPIC" dist/` | Repo as it stands: **1 match** (the UI string, `ANTHROPIC_API_KEY`), no `sk-ant`. With the fix: **0 matches** in all 7 files. |
| 5 | Headers present | `python3 -c "import tomllib…"` parses `netlify.toml`; `curl -sI` against a local server that applies its `[[headers]]` | CSP, X-Frame-Options DENY, Referrer-Policy no-referrer, X-Content-Type-Options nosniff and Permissions-Policy are all present on `/`; `/assets/*` gets the immutable Cache-Control too |
| 6 | Built app works under the CSP (Playwright, Chromium `/opt/pw-browsers/chromium`, fixed build served with the toml headers, `/api/status` stubbed to `{"liveEnabled":false}`) | scratch scripts `serve.mjs` + `csp-test.mjs` | Demo flow Load sample data → Next → Run comparison: **11 table rows (header + 10 requirements), 4 "Not documented in provided materials" cells**. A PDF upload parses (1 page) and the **real pdf.js worker** starts from `/assets/pdf.worker.min-*.mjs`. A DOCX upload parses (1 section). **CSP violations: [] · console errors/warnings: [] · page errors: []** |
| 6b | Negative control for check 6 | same test with `worker-src 'none'` | Console shows `Creating a worker ... violates ... "worker-src 'none'"` and `Setting up fake worker`. So the test does detect CSP breakage, and the real policy has none. |
| 7 | Key only read via `process.env` in functions | `grep -rn ANTHROPIC` (excluding node_modules/dist/.git) and `grep VITE_\|import.meta.env\|envPrefix\|define:` | Code reads it only as `process.env.ANTHROPIC_API_KEY` in `netlify/functions/status.mjs:3` and `netlify/functions/analyze.mjs:44`. The SDK's `new Anthropic()` (analyze.mjs) also reads it from `process.env` on its own. Other mentions are comments or user-facing text naming the variable (analyze.mjs:8 and :45, README, netlify.toml, the scanner) plus the UI string in the blocker. There is no `VITE_` usage, no `import.meta.env`, and no `define`/`envPrefix` in vite.config.js. API error messages are generic and never echo `err.message`. |
| 8 | `/api/status` returns only a boolean | imported `status.mjs` and called it with the key unset and set to a placeholder | unset → `200 {"liveEnabled":false}`; set → `200 {"liveEnabled":true}`; the only key is `liveEnabled`, its type is boolean, and the response does not contain the value; `config.path = "/api/status"` |

## Netlify checklist
See `docs/netlify-checklist.md`: connect the repo, turn on deploy previews and branch deploys, add `ANTHROPIC_API_KEY` scoped to **Functions only**, optional variables, trigger a deploy, find the preview URL, and the 4 M1 test steps. I have not configured anything in Netlify; all of it is for the user to do.

## Left for the user / open risks
1. **Blocker:** apply the one-line UI string fix above, or the build stays red (on Netlify too).
2. **Manual Netlify setup** per the checklist. Headers, `/api/status` and the 60-second streaming limit have not yet been seen on real Netlify infrastructure. Check them on the deploy preview (M1 test step 4).
3. **`netlify dev` and the CSP:** Netlify CLI applies `[[headers]]` locally too. Vite's dev server injects `<style>` tags for HMR, which `style-src 'self'` blocks, so local `npx netlify dev` may show unstyled pages or CSP console errors. Production builds are unaffected. If this gets in the way, run plain `npm run dev` for UI work, or add a dev-only override later. I didn't loosen the production policy for it.
4. **Future pdf.js features:** text extraction needs no WebAssembly or fonts. If a later milestone renders pages or sets `wasmUrl`, `standardFontDataUrl` or `cMapUrl` to another origin, the CSP needs a matching change (for example `'wasm-unsafe-eval'`). The CSP test in check 6 should be rerun after M3.
5. **The scanner uses heuristics.** It catches known key formats and random-looking assignments. It won't catch a key split across strings or base64-wrapped. The Functions-only scope on Netlify is the main control, and the scanner backs it up.
6. HSTS isn't set in `netlify.toml`. Netlify adds HSTS on its HTTPS domains on its own.
7. R-3 (rate-limit atomicity) and R-4 (passcode) are still open for M4, as planned.
