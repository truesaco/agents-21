# Hero section report (frontend-ui)

Date: 2026-10-26. Branch `claude/eloquent-pasteur-991nv2` (based on `main` da8cbdf). Nothing has been committed or pushed.

## Files changed
| File | Change |
|---|---|
| `src/components/Hero.jsx` | New. Hero shown above Step 1: eyebrow, scenario line, H1, a one-sentence description, a **Try the demo** button with a reassurance line, three feature chips, a static "Example result" preview card, and a "How a review works" strip with 4 numbered steps |
| `src/App.jsx` | Imports `Hero` and renders it only on Step 1 (`step === 0`). The brand name in the header is a `<p className="brand-name">` on Step 1 (the hero headline is the page's only h1 there) and stays an `<h1>` on Steps 2 and 3 |
| `src/components/DocumentsStep.jsx` | The Step 1 section gets `id="step-documents"` and `aria-labelledby`; its heading gets `id="step-documents-title"`, `tabIndex={-1}` and the class `step-heading`, so the hero button can move focus to it. The visible text is unchanged |
| `src/styles.css` | `.brand h1` became `.brand-name` (same look for `p` and `h1`). Hero styles appended, using only the existing CSS variables, with breakpoints at 960px, 820px and 520px. The hero is hidden when printing |

Not touched: `src/lib/`, `netlify/`, `src/demo/demoResults.json`, the sample files, quote verification, `HowItWorks.jsx`, the committed `docs/screenshots/`.

## What the hero contains
- **Eyebrow:** "Vendor proposal review for sports and live-event teams"
- **Scenario:** "Three ticketing proposals, one board meeting on Friday."
- **H1:** "Compare proposals from every vendor without rereading every page." I changed the suggested wording ("Compare vendor proposals ...") because the demo check uses `getByRole("heading", { name: "Vendor proposals" })`, which matches substrings without regard to case. With the suggested wording that lookup also hit the H1 and failed in strict mode.
- **Description:** "VendorLens compares vendor proposals against your requirements using only the documents you upload, with a quote and location for every claim."
- **CTA:** "Try the demo" scrolls to the Step 1 heading. It scrolls smoothly unless `prefers-reduced-motion: reduce` is set, in which case it jumps. It then focuses the heading with `focus({ preventScroll: true })`, so the next Tab goes to **Load sample data**. Reassurance line: "Fictional sample data, no sign-up and no API call in demo mode."
- **Chips:** "Every claim cites a quote" · "Missing items show 'Not documented in provided materials'" · "It never picks a winner".
- **Preview card:** labelled "Example result" with the existing "Fictional sample" tag. It shows requirement R5 "Data ownership" for all three sample vendors. The card builds itself at import time from `SAMPLE` and `src/demo/demoResults.json` (read only), with labels from `STATUS_LABELS`, so the quotes stay verbatim and in sync with the data:
  - Turnstile Labs: Not documented in provided materials
  - PulseGate Ticketing: Addressed, "Harbor City Arena will own all fan and transaction data collected through PulseGate Live." from `pulsegate-proposal.md › Section "6. Your Data"`
  - Bleacher Box: Partially addressed, "The venue owns its fan and transaction data." from `bleacher-box-proposal.md › Section "6. Data"`

  The card has `role="img"` and an `aria-label` that reads out the same content and begins "Illustration of a fictional sample result ...". It contains no buttons and no `.evidence`, `.doc-item` or table classes, so it can't be confused with the interactive table or picked up by the demo-check selectors.
- **"How a review works" (H2) strip:** four steps that use the real button labels: **Load sample data** / **Upload file** / **Paste text**; **Next: review requirements →**; **Run comparison** (demo mode or live analysis); clicking a quote, then **Export CSV** / **Print / PDF**. A closing line points to the header's **How it works** panel. The header panel is unchanged, and the hero adds no duplicate ids.

Nothing in the hero mentions pricing, testimonials, logos, competitors, user counts, time saved, accuracy or ANTHROPIC. The only phrase that matches the banned-word regex is "It never picks a winner", and the negation exemption covers it. The hero uses no inline scripts, no `style` attributes, no external fonts and no images, so the CSP needs no change.

## Check results
| Check | Result |
|---|---|
| `npm test` | 35/35 pass |
| `npm run build` | exit 0; `check-secrets: OK` in both prebuild and postbuild (7 dist files) |
| `docs/scripts/check-demo-script.mjs` against `npx vite preview --port 4173`, run from a scratch copy so `docs/screenshots/` was not rewritten | 9/9 steps pass; all 24 bold labels were seen on screen; the only console error is the expected `/api/status` 404. The first run failed on the H1 wording (see above). It passed after the rewording |
| Ad hoc Playwright (`scratchpad/hero-check.mjs`), light and dark at 1280px and 390px | No horizontal page scroll at either width; exactly one `h1` on Step 1; a computed AA contrast check of all 45 text elements in the hero (alpha-blended over the effective background, 4.5:1 for normal text and 3:1 for large text) found 0 failures in both schemes |
| Ad hoc keyboard, with and without reduced motion | Tab order: `1 Documents` > `How it works` > `Try the demo` > `Load sample data` > `Paste text` > `+ Add vendor`. The CTA shows a solid focus ring. Enter moves focus to `#step-documents-title` and scrolls the heading into view (the page is only tall enough to bring it to 341px from the top at 1280x800), and the next Tab is `Load sample data` |
| Ad hoc: Steps 2 and 3 | The hero is gone and the header brand `VendorLens` is the only `h1` |

The preview server was stopped by PID: the npm wrapper (2604), the shell (2617) and the vite node process (2618, which had been reparented to init). Port 4173 no longer responds afterwards.

## Screenshots (not committed; scratchpad)
- `/tmp/claude-0/-home-user-agents-21/67dc0090-c405-5f46-9337-49ca766f624f/scratchpad/hero-1280-light.png` / `hero-1280-light-full.png`
- `/tmp/claude-0/-home-user-agents-21/67dc0090-c405-5f46-9337-49ca766f624f/scratchpad/hero-1280-dark.png` / `hero-1280-dark-full.png`
- `/tmp/claude-0/-home-user-agents-21/67dc0090-c405-5f46-9337-49ca766f624f/scratchpad/hero-390-light.png` / `hero-390-light-full.png`
- `/tmp/claude-0/-home-user-agents-21/67dc0090-c405-5f46-9337-49ca766f624f/scratchpad/hero-390-dark.png` / `hero-390-dark-full.png`

(The `-full` files are element screenshots of the whole hero. The others are viewport captures.)

## Open items / notes for QA
- No axe scan was run: `@axe-core/playwright` is not installed, and adding it was out of scope for this brief. The contrast and heading checks above were computed by hand in the page instead.
- An existing issue I didn't fix: the "Upload file" control is a `<label>` wrapping a `hidden` file input, so Tab skips it. This is outside the hero scope.
- `docs/demo-script.md` and the README screenshots now show the hero above Step 1. The committed `docs/screenshots/01..02` predate it, so docs-demo may want to regenerate them.
- The hero is roughly one screen tall at 1280x800, so Step 1 starts below the fold. The CTA and the scroll target handle this.
