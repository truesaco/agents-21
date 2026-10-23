# VendorLens — Product Requirements Document

Status: **Draft for review**. Nothing is merged to `main` until this PRD is approved.
Branch: `claude/eloquent-pasteur-991nv2` (commit `0d53027` holds the current build).

---

## 1. Problem

Operations and procurement managers at sports teams, leagues and venues compare vendor proposals (ticketing, concessions, sponsorship, stadium tech) by hand. Proposals use different structures and wording, and they often leave out the items that matter most. Reviewers lose time finding where, or whether, each requirement is addressed, and summaries drift from what the vendor actually committed to in writing.

## 2. Users

- **Primary:** Operations or procurement manager running a vendor selection.
- **Secondary:** Finance, IT/security, fan-experience and legal stakeholders who review the comparison and need to check claims for themselves.

## 3. Product principles (non-negotiable)

1. **Closed evidence set.** Only the uploaded or pasted files are used. No web search, no browsing, no outside knowledge, no vendor contact.
2. **Every claim is traceable.** Each claim shows a source locator (file plus page or section) and a short quote copied word for word from that location.
3. **Gaps are explicit.** Anything required but not addressed shows as **"Not documented in provided materials."**
4. **Humans decide.** The app supports the decision and never picks a winner. No overall scores, rankings or recommendations.

## 4. What is already built (v0.1)

| Area | What exists | Where |
|---|---|---|
| Three-step UI | Documents → Requirements → Comparison, with a clickable stepper | `src/App.jsx`, `src/components/` |
| Document intake | Upload PDF (located by page), DOCX (by heading), TXT/MD (by heading, or by line range when there are no headings); paste text | `src/lib/parse.js`, `src/lib/segment.js` |
| Requirement extraction | Lines starting `R1.` (fallback: numbered or bulleted lines) become requirements; user can edit, add or remove them | `src/lib/requirements.js`, `RequirementsStep.jsx` |
| Statuses | Addressed · Partially addressed · Conflicts with requirement · Not documented in provided materials | `src/lib/verify.js` |
| Quote verification | Every quote is matched against the source text, tolerating whitespace, case and smart punctuation; the original text is displayed; wrong locators are corrected; unverifiable quotes are dropped; a claim left with no evidence becomes "Not documented" | `src/lib/verify.js` |
| Live analysis | Netlify Function calls Claude once per vendor (vendors analyzed separately, so none are compared), streamed NDJSON, structured JSON output, server-side quote verification | `netlify/functions/analyze.mjs`, `netlify/lib/prompt.mjs` |
| Secrets | `ANTHROPIC_API_KEY` read only from Netlify env vars; `/api/status` reports only whether live mode is on | `netlify/functions/status.mjs` |
| Rate limit | 12 vendor analyses per IP per hour, 150 per day site-wide (configurable); stored in Netlify Blobs with an in-memory fallback | `netlify/lib/rateLimit.mjs` |
| Demo mode | 3 fictional ticketing proposals + fictional arena requirements; precomputed results, no API call; available only while the sample data is unchanged | `src/samples/`, `src/demo/demoResults.json` |
| Source viewer | Click any quote to see the full section with the quote highlighted | `SourceViewer.jsx` |
| Export | CSV (one row per evidence item), print/PDF | `src/lib/csv.js` |
| Tests | 10 unit tests: every demo quote is verbatim at its cited locator; each vendor has the intended gaps; verification edge cases | `tests/` |

**Sample vendors and their intended gaps:** Turnstile Labs has no data ownership terms (R5). PulseGate Ticketing has no support SLA (R6). Bleacher Box has no PCI DSS documentation (R4) and no accessibility commitment (R7).

### Verified so far
- `npm test`: 10/10 pass.
- `npm run build` succeeds.
- Browser click-through of demo mode in Chromium: 10 requirements, 47 quotes, 4 "Not documented" cells, quote highlighting works, demo mode turns off after a requirement is edited, mobile layout renders, no console errors.
- Function error paths: missing key → 503; malformed body → 400; rejected key → streamed error message.

### Not yet verified
- **Live mode with a real API key.** No end-to-end run has happened yet.
- **Netlify deployment.** Functions, Blobs and the 60-second streaming limit have not been tested on Netlify itself.
- **Real-world PDFs and DOCX files.** Only the Markdown samples have been tested.

## 5. Known gaps and risks

| # | Risk | Impact | Planned in |
|---|---|---|---|
| R-1 | Live mode is untested end to end | May fail on deploy | M2 |
| R-2 | Effort is set to `low` to stay under Netlify's 60-second streaming limit | Lower recall on long or subtle proposals | M2 (measure), M3 (smaller calls) |
| R-3 | The rate-limit counter is read-then-write, not atomic | Small overshoot under concurrent bursts | M5 |
| R-4 | No access control; anyone with the URL can spend the live quota | Cost exposure, capped by the rate limit | M5 |
| R-5 | Work is lost on page refresh | Annoying in a long review | M4 |
| R-6 | Scanned PDFs (no text layer) are rejected | Some proposals can't be used | Out of scope (documented) |
| R-7 | The numbered-heading heuristic can mistake short list items for headings | Odd locators on some text files | M4 |
| R-8 | A quote can be verbatim yet not actually support the claim | Misleading cell | M3 (QA checker) |

## 6. Milestones

Each milestone ends with **something you can click**, plus test steps. A milestone is done only when its test steps pass and you sign off.

### M1 — Deployment prep (preview site)
**Scope**
- Connect the Netlify site to the repo with deploy previews for branches and pull requests.
- Add `ANTHROPIC_API_KEY` in Netlify, scoped to Functions. Confirm it never appears in the browser bundle.
- Add security headers (CSP, no-referrer, frame-deny) in `netlify.toml`.
- Add a build check that fails if anything that looks like an API key is in the code.
- Show a "Live mode on / off" indicator in the header.

**You click:** the Netlify **deploy preview URL** for this branch.
**How to test**
1. Open the preview URL. The header shows the live-mode indicator.
2. Click **Load sample data → Next → Run comparison**. The demo table appears.
3. In DevTools, open Sources and search the JS for `sk-ant`. There are no matches.
4. Visit `/api/status`. It returns `{"liveEnabled":true}` and no key.

### M2 — Live mode testing and hardening
**Scope**
- Run live analysis on the sample set and compare it with the precomputed demo. Record the differences in `docs/live-test-log.md`.
- Upload at least one real PDF and one DOCX (non-confidential) and check the page and section locators.
- Measure time per vendor on Netlify. Tune `ANTHROPIC_EFFORT` (low vs. medium) against the 60-second limit, and document the result.
- Exercise the failure paths: rate limit hit, oversized document, timeout, model refusal, malformed output. Each one shows a clear message.
- Add a "Retry this vendor" button for a vendor that failed.

**You click:** the deploy preview with live mode on.
**How to test**
1. Load the sample data, edit R1 (this forces live mode), then click **Run comparison**.
2. Each vendor column shows "Analyzing…" and then fills in, all within 60 seconds.
3. Click 5 random quotes. Each one opens highlighted in the source.
4. Check that the Not documented cells match the intended gaps (Turnstile R5, PulseGate R6, Bleacher R4 and R7). Any differences are explained in the test log.
5. Run 13 analyses within an hour from one browser. The 13th shows the rate-limit message.
6. Upload a PDF. Its quotes show "Page N" locators.

### M3 — Specialist analysis agents (proposal; needs approval before any build)
**Scope:** Split each vendor's analysis into domain analysts plus an evidence checker and a synthesizer. Roles, inputs, boundaries and checks are proposed separately and **are not created until approved**. Each requirement is routed to one domain analyst (shown and editable in Step 2). Vendors stay isolated: no agent ever sees more than one vendor.

**You click:** the deploy preview → Step 2 shows an **Analyst** column per requirement; Step 3 cells show which analyst produced each finding and a "QA checked" mark.
**How to test**
1. Load the sample and switch to live mode. Each requirement has an analyst assigned, and you can change it.
2. Run the comparison. Every cell shows the analyst and the QA result.
3. Open a cell the QA checker downgraded. It explains why the quote didn't support the claim.
4. Search the output for words like "recommend", "best" or "winner". Nothing is found (an automated test also checks this).

### M4 — UI polish
**Scope**
- Save work to the browser (localStorage) so a refresh doesn't lose documents, requirements or results, plus a "Clear saved work" button.
- Drag and drop to upload; a progress state while files are parsed.
- Comparison table: sticky requirement column on wide tables, filters by status and by vendor, and a "Copy citation" button on each quote.
- Empty, loading and error states reviewed. Keyboard navigation and focus order checked. Color contrast at WCAG AA in light and dark mode.
- Fix the numbered-heading false positives (R-7).

**You click:** the deploy preview.
**How to test**
1. Load the sample data, run it, then refresh the page. Everything is still there.
2. Drag a PDF onto a vendor card. It's added with a progress state.
3. Scroll the table sideways on a laptop screen. The requirement column stays visible.
4. Tab through the whole flow without a mouse. Every action can be reached and has a visible focus ring.
5. Switch your operating system to dark mode. Everything stays readable.

### M5 — README, demo script and production deploy
**Scope**
- README with a **5-minute demo script** (below), screenshots, setup and environment-variable reference.
- In-app "How it works" panel explaining the four principles.
- Make the rate-limit write atomic using Blobs conditional writes (R-3). Optional shared passcode for live mode (R-4).
- Merge to `main` through a reviewed PR; Netlify deploys production from `main`.

**You click:** the **production URL** and the README on GitHub.
**How to test**
1. Follow the README demo script word for word on the production URL. Every step matches what you see.
2. Turn the passcode on, open the site in a private window, and try live mode. It asks for the passcode.
3. Netlify shows `main` as the production branch, and the deploy log is green.

**Draft demo script (to be finalized in M5)**
1. *"This is VendorLens. It compares vendor proposals against our requirements using only the documents we give it."* Click **Load sample data**.
2. *"Three fictional ticketing vendors and our arena's requirements."* Open **Sections** on one proposal to show the locators.
3. Click **Next**. *"It pulled out 10 requirements. I can edit them."*
4. Click **Run comparison**. *"Every claim has a quote and a location."* Click a quote to show the highlight.
5. Point to the grey cells. *"Not documented in provided materials. Turnstile never mentions data ownership, and PulseGate has no support SLA."*
6. *"Notice there's no score or winner. That decision stays with us."* Click **Export CSV**.

## 7. Out of scope (v1)
- Web research, vendor outreach, or any data outside the uploaded files.
- Scoring, weighting, ranking or recommending vendors.
- OCR for scanned PDFs.
- User accounts and server-side storage of documents.

## 8. Approval checklist
- [ ] PRD approved
- [ ] Sub-agent proposal approved (or changed)
- [ ] M1 signed off · [ ] M2 · [ ] M3 · [ ] M4 · [ ] M5
- [ ] PR to `main` approved
