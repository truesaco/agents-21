# Hero section QA (qa-evidence-auditor)

## Verdict: PASS

Audited: `git diff da8cbdf..HEAD` (commit 442b80c by frontend-ui) on branch `claude/eloquent-pasteur-991nv2`. Date: 2026-10-26. Nothing committed.

Changed files in the diff: `src/components/Hero.jsx` (new), `src/App.jsx`, `src/components/DocumentsStep.jsx`, `src/styles.css`, `docs/reports/hero-frontend-ui.md`. No changes to `netlify/`, `src/lib/`, `src/demo/`, `src/samples/` or the prompt, so `segment.js` and verification did not change.

## Four product rules

| Rule | Result | Evidence |
|---|---|---|
| 1. Closed evidence set | PASS | `netlify/lib/prompt.mjs:7` is unchanged ("complete evidence set ... Do not use outside knowledge"). `netlify/functions/analyze.mjs` is not in the diff, and `tests/rules.test.js` "live request carries no tools" still passes. The hero copy says "using only the documents you upload" and "no API call in demo mode". |
| 2. Traceable claims | PASS | The preview card (R5) builds its quotes from `src/demo/demoResults.json` at import time, with no hard-coded quote text. PulseGate's quote "Harbor City Arena will own all fan and transaction data collected through PulseGate Live." is cited at `pulsegate-proposal.md › Section "6. Your Data"`. Bleacher Box's quote "The venue owns its fan and transaction data." is cited at `bleacher-box-proposal.md › Section "6. Data"`. `verifyEvidence` finds both verbatim at the cited locator (`relocated: false`), the matched source text equals the displayed text, and both appear in the comparison table cell. New test: `tests/hero.test.js`. |
| 3. Explicit gaps | PASS | Turnstile Labs R5 shows "Not documented in provided materials" with no quote, which matches the table. Statuses match `finalizeFindings`: Turnstile is not_documented, PulseGate is addressed and Bleacher Box is partial. The demo still has exactly 4 Not documented cells (Bleacher R4, Turnstile R5, PulseGate R6, Bleacher R7), per `tests/demo.test.js` and the browser run. |
| 4. No winner | PASS | The hero has no score, ranking or recommendation wording. The only banned-word hit is "It never picks a winner" (`Hero.jsx:60`), and the negation exemption covers it. The hero has no pricing, testimonials, logos, images, competitor comparisons, user counts, time-saved claims or accuracy claims (new test plus manual read). The "Fictional sample" tag is on the card (`Hero.jsx:67`), and "Fictional sample data" is in the reassurance line. The hero is hidden in print (`styles.css`, `@media print`), so exports are unaffected. |

## Commands run

| Command | Result |
|---|---|
| `npm test` (before adding tests) | 35/35 pass |
| `npm test` (after adding `tests/hero.test.js`) | 40/40 pass |
| `npm run build` | exit 0. Prebuild `check-secrets: OK. 67 file(s) scanned in source`; postbuild `check-secrets: OK. 7 file(s) scanned in dist/` |
| `node docs/scripts/check-docs.mjs` | 4/4 PASS (env vars match the README table in both directions, README 22 links, demo-script 10 links) |
| `npx vite preview --port 4173 --strictPort` (background) | served 200. Later stopped by PID (4041 npm, 4056 sh, 4057 node). Port 4173 no longer responds |
| `PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node docs/scripts/check-demo-script.mjs http://localhost:4173/`, run from a scratch copy | 9/9 steps PASS, all 24 bold labels seen. The only console error is the expected `/api/status` 404. The committed `docs/screenshots/` were not touched |
| Own Playwright run (`scratchpad/hero-e2e.mjs`, `scratchpad/scroll.mjs`) | see below |

Results of my own Playwright run at 1280x800 (plus a 360/390 mobile check):
- Step 1 has exactly one h1 (the hero headline). Steps 2 and 3 have one h1 ("VendorLens"), and the hero is not rendered there.
- **Try the demo** is reachable by keyboard (third Tab stop). Enter moves focus to `#step-documents-title`. A mouse click does the same. With reduced motion at 390px, the heading lands at 15.5px from the top. At 1280px the page bottoms out (maxScroll 582), so the heading sits at 341px, still in view.
- Flow: Try the demo → Load sample data → Next: review requirements → → Run comparison gives a table with 10 rows, 3 vendor columns and 4 "Not documented in provided materials" cells. Clicking the Turnstile R1 quote opens the source with `<mark>` "Turnstile One includes Turnstile Exchange, a fully integrated resale marketplace."
- The preview card has `role="img"` and a full `aria-label` describing the content. It contains no focusable elements, and the accessibility tree exposes it as an image, not a control.
- At 360px there is no horizontal overflow (scrollWidth 360 = clientWidth 360). No page errors.

## Tests added

`tests/hero.test.js` (5 tests, all pass). I checked each test against a deliberate break in a scratch copy: a one-word change to a demo quote fails test 2, and adding "Saves hours per proposal" to the hero fails test 4.
1. The source still derives the card from `demoResults.json` using `evidence[0]` and `<q>{c.quote}</q>`, with no hard-coded quotes.
2. Every preview quote is verbatim at its cited file and locator, the displayed text equals the source text, the status equals the table's `finalizeFindings` status, and the quote is present in the table cell.
3. The preview illustrates at least one gap and carries the "Fictional sample" label.
4. The hero copy contains no winner, score, rank, pricing, social-proof, time-saved, percentage, accuracy or competitor wording, and no images or logos.
5. Accessibility basics: one `<h1>` in the hero, a `type="button"` CTA, no interactive elements inside the `role="img"` card, the brand h1 demoted to `<p>` on Step 1, and a focusable Step 1 heading target.

## Findings (none blocking)

| # | Severity | file:line | Finding | Suggested fix |
|---|---|---|---|---|
| 1 | Low | `src/components/Hero.jsx:12-14` | The card reads raw `demoResults.json`, not verified findings. If a demo quote ever stopped verifying, or a documented finding had empty `evidence`, the card would still show the status (and possibly an unverified quote, or a status with no quote), while the table would show "Not documented". `tests/hero.test.js` now catches this for the current data. | Derive the cells from `finalizeFindings(SAMPLE.requirements, demoResults[v.id], v.documents)` so the card uses exactly what the table shows. |
| 2 | Low (copy) | `src/components/Hero.jsx:45-47` | The H1 "Compare proposals from every vendor without rereading every page." is a soft efficiency claim. It isn't quantified, but it slightly undercuts the "check the quotes yourself" message. | Optional: use wording such as "Compare vendor proposals against your requirements, with a quote for every claim." Note that the frontend-ui report explains the demo check's `getByRole("heading", { name: "Vendor proposals" })` substring match, so any new H1 must avoid that phrase. |
| 3 | Info | `docs/screenshots/01-*.jpg`, `02-*.jpg` | The committed screenshots predate the hero. | docs-demo can regenerate them by running `check-demo-script.mjs` in the repo. |
| 4 | Info (pre-existing) | `src/components/DocumentsStep.jsx` | The "Upload file" label wraps a hidden input and isn't reachable by Tab, as frontend-ui also noted. This is outside the hero scope. | Follow up separately. |
