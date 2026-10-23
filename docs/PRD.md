# VendorLens — Product Requirements Document

Status: **Draft for review (rev 2)**. Nothing is merged to `main` until this PRD is approved.
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
| R-2 | Effort is set to `low` to stay under Netlify's 60-second streaming limit | Lower recall on long or subtle proposals | M2 (measure and tune) |
| R-3 | The rate-limit counter is read-then-write, not atomic | Small overshoot under concurrent bursts | M4 |
| R-4 | No access control; anyone with the URL can spend the live quota | Cost exposure, capped by the rate limit | M4 |
| R-5 | Work is lost on page refresh | Annoying in a long review | M3 |
| R-6 | Scanned PDFs (no text layer) are rejected | Some proposals can't be used | Out of scope (documented) |
| R-7 | The numbered-heading heuristic can mistake short list items for headings | Odd locators on some text files | M3 |
| R-8 | A quote can be verbatim yet not actually support the claim | Misleading cell | Future enhancement (section 7) |

## 6. Build process and milestones

The remaining work is done by **build-time sub-agents** defined in `.claude/agents/` (approved and created). The app's runtime analysis flow is unchanged: one Claude call per vendor in live mode, and no API call in demo mode.

| Agent | Role | Milestones |
|---|---|---|
| `deploy-security-reviewer` | Netlify config, headers, secret scanning, rate-limit hardening | M1, M4 (security items) |
| `live-mode-tester` | End-to-end live tests, timing and effort tuning, failure handling | M2 |
| `frontend-ui` | UI polish, persistence, accessibility | M3 |
| `qa-evidence-auditor` | Independent gate: quote verification, demo data, no-winner rule | Runs after every milestone |
| `docs-demo` | README, demo script, screenshots, "How it works" panel | M4 |

**Priority order (rev 3):** M1 → M4. M2 and M3 are optional and run only on request. `qa-evidence-auditor` still runs after every milestone that runs.

**How each milestone runs**
1. The main Claude Code session dispatches the milestone's agent with this PRD section as its brief.
2. The agent makes its changes and writes a report to `docs/reports/<milestone>-<agent>.md`.
3. `qa-evidence-auditor` reviews the diff and writes `docs/reports/<milestone>-qa.md` with a PASS or BLOCK verdict.
4. The main session commits each agent's work separately, tagged `[agent: <name>]`, and pushes to the feature branch. Agents never push, and nothing goes to `main` without your approval.
5. You open the clickable result, follow the test steps, and sign off.

Each milestone ends with **something you can click**, plus test steps. A milestone is done only when its test steps pass, QA says PASS, and you sign off.

### M1 — Deployment prep (preview site)
**Agent:** `deploy-security-reviewer` · **Gate:** `qa-evidence-auditor`

**Scope**
- Add security headers (CSP, no-referrer, frame-deny) in `netlify.toml`.
- Add `scripts/check-secrets.mjs`, run before every build, which fails if anything that looks like an API key is in the source or in `dist/`.
- Confirm `ANTHROPIC_API_KEY` is read only through `process.env` inside `netlify/functions/`, and never ends up in the browser bundle.
- Write the Netlify setup checklist that you follow.

**Manual steps (yours; the agent can't log into your Netlify account)**
- Connect the repo in Netlify with deploy previews on, and add `ANTHROPIC_API_KEY` scoped to Functions.

**You click:** the Netlify **deploy preview URL** for this branch.
**How to test**
1. Open the preview URL, then click **Load sample data → Next → Run comparison**. The demo table appears.
2. In DevTools, open Sources and search the JS for `sk-ant` and `ANTHROPIC`. There are no matches.
3. Visit `/api/status`. It returns `{"liveEnabled":true}` and no key.
4. In DevTools, open Network, click the page request, and check the response headers. `Content-Security-Policy` and `X-Frame-Options` are there.

### M2 — Live mode testing and hardening
**Agent:** `live-mode-tester` · **Gate:** `qa-evidence-auditor`

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

### M3 — UI polish
**Agent:** `frontend-ui` · **Gate:** `qa-evidence-auditor`

**Scope**
- Show a "Live mode on / off" indicator in the header.
- Save work to the browser (localStorage) so a refresh doesn't lose documents, requirements or results, plus a "Clear saved work" button.
- Drag and drop to upload; a progress state while files are parsed.
- Comparison table: sticky requirement column on wide tables, filters by status and by vendor, and a "Copy citation" button on each quote.
- Empty, loading and error states reviewed. Keyboard navigation and focus order checked. Color contrast at WCAG AA in light and dark mode.
- Fix the numbered-heading false positives (R-7).

**You click:** the deploy preview.
**How to test**
1. The header shows "Live mode on" on the preview site.
2. Load the sample data, run it, then refresh the page. Everything is still there.
3. Drag a PDF onto a vendor card. It's added with a progress state.
4. Scroll the table sideways on a laptop screen. The requirement column stays visible.
5. Tab through the whole flow without a mouse. Every action can be reached and has a visible focus ring.
6. Switch your operating system to dark mode. Everything stays readable.

### M4 — README, demo script and production deploy
**Agents:** `docs-demo` (README, demo script, "How it works" panel) and `deploy-security-reviewer` (atomic rate limit, passcode) · **Gate:** `qa-evidence-auditor` · **Merge:** the main session opens the PR; you approve it

**Scope**
- README with a **5-minute demo script** (below), screenshots, setup and environment-variable reference. *(docs-demo)*
- In-app "How it works" panel explaining the four principles. *(docs-demo)*
- Make the rate-limit write atomic using Blobs conditional writes (R-3). Optional shared passcode for live mode (R-4). *(deploy-security-reviewer)*
- Merge to `main` through a reviewed PR; Netlify deploys production from `main`.

**You click:** the **production URL** and the README on GitHub.
**How to test**
1. Follow the README demo script word for word on the production URL. Every step matches what you see.
2. Turn the passcode on, open the site in a private window, and try live mode. It asks for the passcode.
3. Netlify shows `main` as the production branch, and the deploy log is green.

**Draft demo script (to be finalized in M4)**
1. *"This is VendorLens. It compares vendor proposals against our requirements using only the documents we give it."* Click **Load sample data**.
2. *"Three fictional ticketing vendors and our arena's requirements."* Open **Sections** on one proposal to show the locators.
3. Click **Next**. *"It pulled out 10 requirements. I can edit them."*
4. Click **Run comparison**. *"Every claim has a quote and a location."* Click a quote to show the highlight.
5. Point to the grey cells. *"Not documented in provided materials. Turnstile never mentions data ownership, and PulseGate has no support SLA."*
6. *"Notice there's no score or winner. That decision stays with us."* Click **Export CSV**.

## 7. Future enhancements (not planned for v1)

**Runtime specialist analysts.** Split each vendor's live analysis into domain analysts (Finance & Contract, Operations, Fan Experience), each seeing only its assigned requirements, plus a runtime QA checker. The checker would confirm each verbatim quote actually *supports* its claim (risk R-8). It could only lower a status, never raise it, and would give a reason for every change. Vendors would stay isolated, and no agent would compare vendors or recommend one.
- **Why later:** about 4× the API calls per comparison, and more calls to fit inside Netlify's 60-second limit.
- **v1 decision:** keep one call per vendor. Do not add runtime API calls.

## 8. Out of scope (v1)
- Web research, vendor outreach, or any data outside the uploaded files.
- Scoring, weighting, ranking or recommending vendors.
- OCR for scanned PDFs.
- User accounts and server-side storage of documents.
- Additional runtime API calls (see section 7).

## 9. Approval checklist
- [ ] PRD approved
- [ ] Build-time agent proposal approved (or changed)
- [x] M1 signed off · [ ] M2 · [ ] M3 · [ ] M4
- [ ] PR to `main` approved
