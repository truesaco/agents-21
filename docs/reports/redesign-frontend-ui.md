# Visual refresh and theme toggle report (frontend-ui)

Date: 2026-10-26. Branch `claude/eloquent-pasteur-991nv2` (HEAD 94976a3). Nothing has been committed or pushed.

## Goal
The user said the UI felt "too AI-ish and like it's from 2006". This change gives it a restrained, modern product look and adds a Light / Dark / System theme switch. All labels, hero copy, data, verification logic and demo-script selectors are unchanged.

## Files changed
| File | Change |
|---|---|
| `src/styles.css` | Rewritten. Design tokens on `:root` for color, spacing, radius, shadow and type scale. Colors use `light-dark()`, and the build (Lightning CSS) turns them into `color-scheme` fallbacks. `html[data-theme]` sets `color-scheme`. Every existing class name is kept. Print always uses light colors |
| `src/components/theme.js` | New. Reads and writes the choice (`vendorlens.theme` in localStorage, each access wrapped in try/catch), resolves System through `prefers-color-scheme`, sets `<html data-theme="light\|dark">` and `data-theme-choice`, and watches for OS changes |
| `src/components/ThemeToggle.jsx` | New. Header control: `role="radiogroup"` ("Color theme") with three `role="radio"` buttons (Light, Dark, System) that use `aria-checked`. It has a roving tabindex (one Tab stop), and Arrow, Home and End keys select an option. Icons are inline `aria-hidden` SVG, so there are no external assets |
| `src/main.jsx` | Calls `initTheme()` before `createRoot().render()`. No inline script is needed under the CSP |
| `src/App.jsx` | Removes the `◎` ring glyph (the logo is now a CSS mark), wraps `<HowItWorks />` and `<ThemeToggle />` in `.header-actions`, and scrolls to the top when the step changes (but not on first load). The `BrandName` and `<Hero targetId=…>` lines that the tests look for are unchanged |

Not touched: `src/lib/`, `netlify/`, demo data, samples, quote verification, `Hero.jsx` and every other component's markup and text. No dependencies were added.

## Design changes
- **Palette:** slightly warm neutrals (page `#fafaf9` / `#0e0e10`). The primary action is ink (near-black, or near-white in dark) rather than bright blue. One restrained iris accent (`#4743c4` / `#a3a3ff`) is used only for links, focus rings, requirement IDs, hover on quote rules, and the small marker dots.
- **Status:** small 5px-radius labels with a colored dot instead of pills. "Not documented in provided materials" keeps its grey fill. In light mode that fill is `#eceef2`, which the demo check asserts. It also gets a hairline outline and a hollow ring marker, so the gaps stand out without relying on color. Table-header counts are plain text with dots and tabular numerals.
- **Type:** system UI stack (Inter removed). Monospace is used for file names, locators and requirement IDs. Hero H1 is `clamp(2rem…3.4rem)`, weight 650, tracking -0.04em, left-aligned. Headings use `text-wrap: balance`.
- **Structure:**
  - The hero and the step panels are no longer boxed. They sit on the page with hairline dividers.
  - Only one surface level remains: the Step 1 cards, the comparison table wrapper, the hero preview card, the modal and the popover.
  - Document rows and requirement rows are separated by hairlines, not nested boxes.
  - Quotes are a 2px left rule that turns accent-colored on hover. Locators are monospace.
  - The hero's numbered circles became `01…04` mono labels over a rule.
- **Header:** sticky and translucent with a blur, and it stops being sticky at 820px or narrower. The stepper uses quiet tabs with a numbered square that fills with ink when active. The tagline appears only at 1360px or wider. The How it works panel is a popover with a soft shadow. At 720px or narrower it is anchored to the header's full width.
- **Buttons and inputs:** 34px buttons (30px for small) with a 1px border and a hairline shadow. There are three variants: primary ink, secondary surface and ghost. Inputs show an accent border plus a 3px focus halo. Every button, summary, input and tabindex element gets a 2px accent `:focus-visible` ring. The selected demo/live mode option is highlighted with `:has(input:checked)`.
- **Source viewer:** blurred backdrop and a rounded modal. The highlight is still `#ffe58a` in light mode (the demo check asserts it) and muted amber `#65500f` in dark mode.
- **Motion:** turned off under `prefers-reduced-motion`.

## Theme behaviour
- The default is System. The resolved value follows the OS live, and this was tested by flipping the emulated color scheme.
- The choice persists across reloads. With storage blocked, the toggle still works and the page throws no errors.
- **Flash of the wrong theme:**
  - Before JS runs, the CSS default `color-scheme: light dark` already follows the OS, so System users never get a flash.
  - For explicit Light/Dark choices that differ from the OS, `initTheme()` runs in the entry module before the first React render. The only thing that could paint first is the empty page background, for at most a frame before the bundle executes.
  - Removing even that frame would need an inline script in `index.html`, which the CSP forbids.

## Check results
| Check | Result |
|---|---|
| `npm test` | 40/40 pass (includes `tests/hero.test.js` and `tests/m4Docs.test.js`) |
| `npm run build` | exit 0; check-secrets OK for source (71 files) and dist (7 files) |
| `node docs/scripts/check-docs.mjs` | all PASS |
| `check-demo-script.mjs http://localhost:4173/`, run from a scratch copy (`scratchpad/democopy/`) so `docs/screenshots/` was not overwritten | 9/9 steps pass. All 24 bold labels were seen. The only console error was the expected `/api/status` 404 |
| `grep -rn ANTHROPIC src/` | no matches |
| Contrast scan in the page (`scratchpad/verify.mjs`): every visible text element, foreground alpha-blended over its effective background, needing 4.5:1 (3:1 for large text), on hero + How it works, Documents (Sections open), Requirements, Comparison and the Source viewer | **0 failures in both themes** (light: 70/115/66/212/217 elements, dark: the same). The first dark run reported 5 failures on buttons; these came from scanning during the 120ms color transition right after switching themes, and passed once the transition finished |
| Toggle a11y | Tab order is `1 Documents > How it works > System > Try the demo > Load sample data`, so the radiogroup is one Tab stop. Focus ring is `solid 2px`. ArrowLeft selects and focuses Dark, then Light. `aria-checked` reflects the choice |
| Print emulation with Dark chosen | body `rgb(255,255,255)` / text `rgb(24,24,26)` (light) |
| No horizontal page scroll at 360px and 390px, light and dark | 0px on the hero, the open How it works panel, Documents, Requirements and Comparison (the table scrolls inside its own wrapper) |

### Key contrast pairs (computed from the resolved tokens)
| Pair | Light | Dark |
|---|---|---|
| text / bg | 16.98 | 16.48 |
| text-2 / bg | 10.00 | 11.45 |
| muted / bg | 5.79 | 7.25 |
| muted / surface-2 | 5.49 | 6.39 |
| accent / bg | 7.01 | 8.49 |
| ink-text / ink (primary button) | 16.98 | 16.12 |
| Addressed fg / bg | 6.08 | 9.07 |
| Partially addressed fg / bg | 6.06 | 8.83 |
| Conflicts fg / bg | 6.13 | 8.47 |
| Not documented fg / bg | 10.14 | 10.64 |
| text / highlight mark | 14.21 | 6.63 |

## Screenshots (scratchpad, not committed)
Directory: `/tmp/claude-0/-home-user-agents-21/67dc0090-c405-5f46-9337-49ca766f624f/scratchpad/redesign/`
- Before: `before-{light,dark}-{1280,390}-{hero,documents,requirements,comparison,source}.png`
- After: `after-{light,dark}-{1280,390}-{hero,documents,requirements,comparison,source}.png`
- Extra: `after-light-360-hero.png`, `after-{light,dark}-360-how-it-works.png`, `after-toggle-light-on-dark-os.png`

## Notes and open items
- No axe scan was run because `@axe-core/playwright` is not installed and this brief allows no new dependencies. Contrast and keyboard checks were computed in the page instead.
- The committed `docs/screenshots/` predate this refresh. The docs owner may want to regenerate them with `check-demo-script.mjs`.
- Already known and unchanged: "Upload file" is a `<label>` around a hidden input, so Tab skips it.
- The stepper still renders all three steps at 360px; labels shrink to 12px to fit.
