# Redesign QA (commit 570d1ee, range 94976a3..HEAD)

**Verdict: PASS**

Auditor: qa-evidence-auditor. Scope: visual refresh by frontend-ui. It rewrites `src/styles.css`, edits `src/App.jsx` and `src/main.jsx`, adds `src/components/ThemeToggle.jsx` and `src/components/theme.js`, and adds `docs/reports/redesign-frontend-ui.md`.

## Changes that touch the four rules

`git diff 94976a3..HEAD --stat` shows no changes to `src/lib/`, `netlify/`, `src/demo/demoResults.json`, `src/samples/` or `netlify.toml`. The only rule-relevant surface is presentation:

- **Rule 3:** gap badge styling (`src/styles.css:273-275`).
- **Rule 4:** any per-vendor emphasis, and new UI strings in `ThemeToggle.jsx`.
- **Header layout:** the "How it works" panel was moved into `.header-actions` (`src/App.jsx`).

## Four rules

| Rule | Result | Evidence |
|---|---|---|
| 1. Closed evidence set | PASS | `netlify/lib/prompt.mjs` and `netlify/functions/analyze.mjs` are unchanged in the range. The existing `tests/rules.test.js` checks (closed-set wording, no tools) still pass. The browser run made 0 external requests: every non-localhost request was aborted and counted, and the count was 0. |
| 2. Traceable claims | PASS | `src/lib/verify.js`, `segment.js` and the demo data are unchanged, so the existing `tests/demo.test.js` and `tests/verify.test.js` checks still pass. In both themes, clicking a quote opened the source dialog with a visible, non-transparent `<mark>` highlight (the light-theme check ran with the OS set to dark, and the reverse). |
| 3. Explicit gaps | PASS | In Light, in Dark and with storage blocked, there are exactly 4 `.badge.status-not_documented` cells, each reading "Not documented in provided materials": Bleacher R4, Turnstile R5, PulseGate R6, Bleacher R7. Each badge has opacity 1, is visible and is more than 10px tall. 0 quote buttons appear in gap cells. Colour is not the only cue: the badge has a text label, a hollow marker (`--dot: transparent` with a ring) and an inset outline, unlike the filled dots on other statuses. "Fictional sample" appears on all 4 documents in both themes, and on the hero preview. |
| 4. No winner | PASS | `tests/rules.test.js` scans every `.jsx` file for banned words, including the new `ThemeToggle.jsx`, and passes. The new strings are only "Light", "Dark", "System" and "Color theme". In both themes the 3 vendor header cells and body cells have identical computed background, border, font-weight, colour, box-shadow and outline. The CSS has no positional selectors on columns and no winner, score or rank classes. The "VendorLens does not pick a winner" note is still present. |

## Commands run

| Command | Result |
|---|---|
| `npm test` (before adding tests) | 40/40 pass |
| `npm test` (after adding tests) | 46/46 pass |
| `npm run build` | OK. The prebuild and postbuild secret checks pass (7 files in dist/). |
| `node docs/scripts/check-docs.mjs` | All PASS: env table and links in README and demo-script |
| `npx vite preview --port 4173 --strictPort` (background) | Served `dist/`. Stopped afterwards with `kill <pid>` on the npx PID and then the vite child PID 9100 (port confirmed closed). |
| `check-demo-script.mjs http://localhost:4173/`, run from a scratch `git archive` copy so the committed `docs/screenshots/` were not touched | 9/9 steps PASS. All 24 bold labels were found, and the only console error was the expected `/api/status` 404. |
| Custom Playwright audit `theme-qa.mjs` (scratchpad, not committed) | ALL PASS. Details below. |

### Browser audit details (Chromium, 1280x800, with the production CSP from `netlify.toml` injected on every response)

- **Flow in Light and in Dark (each chosen via the toggle):** Try the demo → Load sample data → Next: review requirements → → Run comparison gives 10 rows and 3 vendors (Turnstile Labs, PulseGate Ticketing, Bleacher Box). There are 4 visible gap badges, and clicking a quote opens the highlighted source. The theme holds through the whole flow. Body background is `rgb(250,250,249)` in light and `rgb(14,14,16)` in dark.
- **CSP:** 0 `securitypolicyviolation` events and 0 console errors in both themes. `dist/index.html` has one `<script type="module" src>` and one `<link rel="stylesheet">`, with no inline script or style. There are no `style=` attributes or `dangerouslySetInnerHTML` in any JSX. `styles.css` has no `@import` or external `url()`. The theme is applied from `main.jsx` (bundled), not from an inline script.
- **Persistence:** after choosing Dark and reloading, the page is still dark, the Dark option has `aria-checked=true`, and `localStorage["vendorlens.theme"]` is `"dark"`.
- **Keyboard:** Tab reaches only the checked option (exactly one radio has `tabindex=0`). ArrowRight, ArrowLeft, Home and End move focus and select. The focus outline is visible.
- **System:** follows OS `prefers-color-scheme` changes live.
- **Storage blocked:** with a `localStorage` getter that throws, the app renders and falls back to System. The toggle applies for the visit, the full demo flow passes, there are no errors, and the theme reverts to System after reload.
- **Print with Dark selected:** computed `color-scheme` is light, the body is `#fff` with text `rgb(24,24,26)`, table text is dark, the gap badge has a light background with dark text, and the header is hidden. A PDF was generated.

## Tests added

`tests/redesign.test.js` (6 tests):

1. `theme.js` defaults to system, stores only the choice word under `vendorlens.theme`, and ignores invalid stored values.
2. `theme.js` with a throwing `localStorage` never throws, falls back to system, and still applies a choice for the visit.
3. CSP: no `style={...}` and no `dangerouslySetInnerHTML` in any `.jsx` file.
4. CSP: `index.html` has no inline script or style and no external URLs, `styles.css` has no external imports or URLs, and the CSP in `netlify.toml` keeps `script-src 'self'` and `style-src 'self'`.
5. Gap badge stays distinguishable without colour (hollow marker and inset outline) and is never hidden or faded; no column-positional or winner/score/rank selectors; the label still comes from `STATUS_LABELS` ("Not documented in provided materials").
6. The print block forces `color-scheme: light` over `[data-theme]` and a white body.

No existing test was changed.

## Findings (none blocking)

| # | Severity | Location | Finding | Suggested fix |
|---|---|---|---|---|
| 1 | Low | `src/styles.css:5-50` | All colour tokens use `light-dark()`, which needs Chrome/Edge 123+, Safari 17.5+ or Firefox 120+. In older browsers the declarations are invalid, so badge backgrounds and status colours are dropped. The badge text, including "Not documented in provided materials", still renders, so rule 3 holds, but the styling degrades. | If older browsers matter, declare plain light values first (for example `--bg: #fafaf9;` before the `light-dark()` line) and put dark overrides under `:root[data-theme="dark"]`. |
| 2 | Info | `src/styles.css:273` | The comment says "dashed edge", but the rule on line 275 draws a solid inset outline (`box-shadow: inset 0 0 0 1px`). The behaviour is fine and the comment is just inaccurate. | Change the comment to "outlined edge". |
| 3 | Info | `src/App.jsx` (new `useEffect` on `step`) | Each step change now scrolls to the top. This is intended and the checks are unaffected. | None. |

Artifacts (scratchpad, not committed):

- `/tmp/claude-0/-home-user-agents-21/67dc0090-c405-5f46-9337-49ca766f624f/scratchpad/qa/theme-qa.mjs`
- `compare-light.jpg`, `compare-dark.jpg`, `source-light.jpg`, `source-dark.jpg` and `print-dark-selected.pdf` in the same directory.
