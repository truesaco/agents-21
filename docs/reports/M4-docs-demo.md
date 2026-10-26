# M4 docs-demo report

Date: 2026-10-23. Agent: `docs-demo`. Nothing has been committed or pushed.

## Files changed
| File | Change |
|---|---|
| `README.md` | Rewritten: pitch, four rules, a 30-second quick start, a 9-step demo table linking screenshots, local development (the build runs `check-secrets` before and after), live-mode setup with an env-var table (6 variables, including `LIVE_PASSCODE`), the passcode contract, deployment (links `docs/netlify-checklist.md`; production deploys from `main`), supported files, limitations, "How this was built", and "Checking the docs" |
| `docs/demo-script.md` | New. A 5-minute script in 9 numbered steps. Each step gives Do / Say / Viewer sees, plus a screenshot |
| `docs/screenshots/01..09-*.jpg` | New. 9 JPEGs at 1280x800, quality 60, about 900 KB in total |
| `docs/scripts/check-demo-script.mjs` | New. Playwright walk of every step with assertions; it also refreshes the screenshots |
| `docs/scripts/check-docs.mjs` | New. Env var parity between `netlify/` and the README table, plus relative-link and image checks |
| `src/components/HowItWorks.jsx` | New. A `<details>`/`<summary>` panel opened from the header that explains the four rules. Works with the keyboard (Tab, Enter/Space; Escape closes it). It recommends no vendor and contains no `ANTHROPIC` text |
| `src/App.jsx` | 2 lines: the import and `<HowItWorks />` in the header. The brief said "a single line", but the import needs a second one |
| `src/styles.css` | Panel styles appended, including a rule for screens 720px or narrower (the panel overflowed off-screen at 390px before this fix) |

## Check results
| Check | Result |
|---|---|
| `npm test` | 27/27 pass |
| `npm run build` | exit 0; `check-secrets: OK` in prebuild (61 files) and postbuild (7 dist files) |
| `node docs/scripts/check-demo-script.mjs` against `npx vite preview` (Chromium `/opt/pw-browsers/chromium`) | 9/9 steps pass. Header shows `1 Documents`/`2 Requirements`/`3 Comparison`/`How it works`; the panel lists the 4 rules; Enter and Escape toggle it. 4 files tagged Fictional sample; 11 Turnstile sections; 10 requirements R1-R10, each with a Source link; Demo mode selected; 10 rows, 47 quotes, Turnstile counts 8/1/1; R1 quote opens `Section "2. Resale Marketplace"` with the exact quote in `<mark>` (yellow); exactly 4 "Not documented in provided materials" cells (Bleacher R4, Turnstile R5, PulseGate R6, Bleacher R7), none with a quote; no-winner note; `vendorlens-comparison.csv` has 51 data rows; editing R1 disables Demo mode and Run comparison. All 24 bold labels in the script and the README demo table were seen on screen. Only console error: the expected 404 for `/api/status` under vite preview |
| Ad hoc: live mode stubbed on (`/api/status` returns `liveEnabled:true`) | Steps 1-8 are unchanged (demo still the default). After an edit, Live analysis is selected and Run comparison is enabled, so step 9 now says this |
| Ad hoc: panel at 390/600/721/1024/1280px, light and dark | Fits the viewport, no horizontal scroll (after the narrow-screen fix) |
| `node docs/scripts/check-docs.mjs` | Env vars in code and in the README match exactly (ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ANTHROPIC_EFFORT, RATE_LIMIT_PER_HOUR, RATE_LIMIT_GLOBAL_PER_DAY, LIVE_PASSCODE). All relative links resolve. Negative control: removing the LIVE_PASSCODE row and breaking an image path both fail as expected |

## Changes from the draft demo script
- "Click **Next**": the real label is **Next: review requirements →**.
- Gaps: the draft named only Turnstile and PulseGate. There are 4 cells, and Bleacher Box R4 and R7 are now included. The table rows are tall, so the presenter has to scroll through R4-R7.
- "Grey cells": only the badge is grey, not the whole cell. The script now says "grey badges".
- CSV: one row per quote plus one row per Not documented cell (51 rows), not just "one row per evidence item".
- Added steps for How it works, for clicking a section locator, and an optional step showing demo mode turning off after an edit.

## Mismatches and concerns
- The **passcode UI is not built** (out of scope). The README says plainly that with `LIVE_PASSCODE` set, live mode shows the 401 message and goes no further, and it advises leaving the variable unset for now. PRD M4 test step 2 can't pass yet.
- Live mode, Netlify deployment, the Blobs atomic writes and real PDF/DOCX files are all **untested**, and the README says so.
- The demo was validated on a local `vite preview`, not on the production URL (no access).
- `App.jsx` needed 2 lines, not 1 (see above).

## Pass 2 (audit on `main` at ca0751a)

**Scope:** audited README.md, docs/demo-script.md and the How it works panel against PRD section "M4 — README, demo script and production deploy" and the current code.

**Verified (no change needed)**
- README covers every M4 scope item: 5-minute demo script with screenshots, setup, environment-variable reference, Netlify deploy (production branch `main`), and the How it works panel reachable from the header (`src/App.jsx` renders `<HowItWorks />`).
- Every UI string quoted in the docs exists in `src/` ("Not configured on this site.", "Only available for the unmodified sample data.", "Demo mode: precomputed results", "VendorLens does not pick a winner.", step labels).
- Env-var defaults in the README match the code: `ANTHROPIC_MODEL` = `claude-opus-5-5`, `ANTHROPIC_EFFORT` = `low`, `RATE_LIMIT_PER_HOUR` = 12, `RATE_LIMIT_GLOBAL_PER_DAY` = 150.
- No passcode handling exists anywhere in `src/` (confirmed by grep). The app shows the server's 401 error text as-is.
- Sample vendors are still called fictional throughout. Live mode is still described as untested end to end.

**Changed**
- README.md: the passcode status line now says plainly "server-side only": no UI input, the app never sends `X-VendorLens-Passcode`, every live analysis fails while `LIVE_PASSCODE` is set, leave it unset. It also says PRD M4 test 2 can't pass yet. The `LIVE_PASSCODE` table row now says "server-side only for now; leave unset".

**Check results**
- `node docs/scripts/check-docs.mjs`: PASS. The 6 env vars match in both directions. README has 22 relative links and docs/demo-script.md has 10, and all resolve.
- `check-demo-script.mjs` against `vite preview --port 4173` (Chromium): 9/9 steps PASS. All 24 bold labels appeared on screen. The only console error was the expected `/api/status` 404. The preview server was stopped by PID afterwards.
- `npm test`: 27/27 pass. `npm run build`: passes, and both `check-secrets: OK` scans pass.

**Mismatch still open (not a docs fix):** PRD M4 test 2 (the passcode prompt) needs a passcode input in the app. That is outside docs-demo scope.
- Follow-up: added the `PASSCODE_FAILS_PER_HOUR` row to the README env table (default 10; wrong passcode attempts per IP per hour before HTTP 429 `passcode_locked`; Functions scope; only matters when `LIVE_PASSCODE` is set) and a mention in the passcode status note. `check-docs.mjs` passes again: the 7 env vars match both ways and all links resolve. `npm test`: 31/31 pass.
