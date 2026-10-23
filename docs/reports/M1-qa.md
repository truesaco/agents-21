# M1 QA report (Deployment prep)

**Verdict: PASS**

Auditor: qa-evidence-auditor. Diff audited: `git diff e33ee47..HEAD` (721f74a, 89a7734).

## M1 scope (docs/PRD.md, "M1 — Deployment prep")

| Item | Result | Evidence |
|---|---|---|
| CSP, no-referrer, frame-deny headers | Pass | `netlify.toml` `[[headers]] for="/*"`: `Content-Security-Policy` (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), `X-Frame-Options = "DENY"`, `Referrer-Policy = "no-referrer"`, plus nosniff, Permissions-Policy, COOP |
| check-secrets runs before build and scans dist/ | Pass | `package.json` `prebuild` runs `--source`, `postbuild` runs `--dist`. Probe: a fake `sk-ant-...` in an untracked file gave exit 1. `ANTHROPIC_API_KEY` written into `dist/probe.js` gave exit 1. Both probe files were removed afterwards. |
| Key only via `process.env` in `netlify/functions/` | Pass | The only reads are in `netlify/functions/analyze.mjs:44` and `netlify/functions/status.mjs:3`. `src/` has no `process.env` or `ANTHROPIC` |
| Never in bundle | Pass | `grep -r "sk-ant\|ANTHROPIC" dist/` gives no output. 89a7734 removed the env var name from `src/components/RequirementsStep.jsx:90` |
| Checklist: manual steps + 4 test steps | Pass | `docs/netlify-checklist.md` sections 1-5 cover the manual steps (connect repo, previews, key scoped to Functions, deploy, URL). Section 6 has all 4 PRD test steps |

## Four product rules

| Rule | Result | Evidence |
|---|---|---|
| 1. Closed evidence set | Pass | The diff does not touch `netlify/lib/prompt.mjs` or the request body. `prompt.mjs:7` forbids outside knowledge. `analyze.mjs` has no `tools` (new test) |
| 2. Traceable claims | Pass | The diff does not touch `verify.js`, `segment.js` or the demo data. Demo quotes still resolve to their cited locators (`tests/demo.test.js`). Ellipsis-spliced quotes are rejected (new test) |
| 3. Explicit gaps | Pass | Demo gaps are unchanged: Turnstile R5, PulseGate R6, Bleacher R4 and R7. A not_documented finding never carries evidence (new test) |
| 4. No winner | Pass | The new UI string is neutral. The only banned-word hits are disclaimers (`ComparisonStep.jsx:43` "does not pick a winner", `App.jsx:176` "never recommends", `prompt.mjs:17` "do not recommend") |

## Commands

| Command | Result |
|---|---|
| `npm test` | 14/14 pass (10 existing + 4 new) |
| `npm run build` | exit 0. Prebuild: `check-secrets: OK. 42 file(s)`. Postbuild: `OK. 7 file(s) scanned in dist/` |
| `grep -r "sk-ant\|ANTHROPIC" dist/` | no output |
| `git diff e33ee47..HEAD --stat -- src/lib src/demo src/samples netlify/lib netlify/functions tests` | empty (none of these paths changed) |

## Tests added

`tests/rules.test.js`:
- Quotes spliced with `...` or `…` are not verified, and the finding is downgraded to not_documented.
- `finalizeFindings` never returns a not_documented finding with evidence.
- The prompt and all `.jsx` files have no recommend/best/winner/top choice/preferred wording. Negated disclaimer lines are allowed.
- `analyze.mjs` sends no `tools` and no web_search/web_fetch.

## Findings

| Severity | Location | Finding | Suggested fix |
|---|---|---|---|
| Low (not blocking, older than M1) | `netlify/lib/prompt.mjs:7` | The prompt forbids outside knowledge but does not literally say "no web search or browsing". No tools are sent, so the model cannot browse either way | Add "Do not search the web, browse, or contact the vendor." to line 7 in a later milestone |
