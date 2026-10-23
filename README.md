# VendorLens

Evidence-backed vendor comparison for operations and procurement teams at sports teams, leagues and venues (ticketing, concessions, sponsorship, stadium tech).

1. Upload or paste vendor proposals and your internal requirements.
2. Review the requirements VendorLens pulled out, and edit them if needed.
3. Get a comparison table where every claim has a source locator (file plus page or section) and a short quote copied word for word from the document.

**Ground rules built into the app**

- The uploaded files are the complete evidence set. No web search, no browsing, no vendor contact.
- Every quote is checked against the source text before it is shown. If a quote can't be found, it is removed, and a cell left with no evidence becomes **"Not documented in provided materials."**
- VendorLens never picks a winner. Each vendor is analyzed in a separate request, so the model never sees vendors side by side. There are no scores, rankings or recommendations. The human decides.

## Demo

Click **Load sample data** on the first screen. It loads a requirements document for a fictional arena (Harbor City Arena) and three fictional ticketing proposals:

| Vendor (fictional) | Deliberately missing |
|---|---|
| Turnstile Labs | Data ownership terms (R5) |
| PulseGate Ticketing | Support SLA (R6) |
| Bleacher Box | PCI DSS compliance (R4), accessibility (R7) |

Demo mode shows precomputed results with **no API call**. It is available only while the sample data is unchanged. The sample files are in `src/samples/` and the precomputed results are in `src/demo/demoResults.json`.

## Live analysis (Claude)

Live mode sends the requirements and each vendor's documents to Claude through a Netlify Function (`netlify/functions/analyze.mjs`). The API key stays on the server.

Set the following in **Netlify → Site configuration → Environment variables**. Never commit them.

| Variable | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — |
| `ANTHROPIC_MODEL` | no | `claude-opus-5-5` |
| `ANTHROPIC_EFFORT` | no | `low` (keeps each vendor's analysis inside Netlify's 60-second streaming limit) |
| `RATE_LIMIT_PER_HOUR` | no | `12` vendor analyses per IP per hour |
| `RATE_LIMIT_GLOBAL_PER_DAY` | no | `150` vendor analyses per day, site-wide |

Rate-limit counters are stored in Netlify Blobs, so no setup is needed on Netlify. Live analysis caps each vendor's documents at 250,000 characters.

## Deploy to Netlify

1. In Netlify, choose **Add new site → Import an existing project**, then pick this repo and the `main` branch.
2. Build settings come from `netlify.toml`: `npm run build`, publish folder `dist`.
3. Add `ANTHROPIC_API_KEY` (above) and redeploy. Without it, the app still works in demo mode.

## Local development

```bash
npm install
npm test          # quote verification + demo data checks
npm run dev       # UI only (demo mode)
npx netlify dev   # UI + functions (live mode; needs ANTHROPIC_API_KEY in your shell)
```

## Supported files

PDF (located by page), DOCX (by heading), TXT/MD (by heading, or by line range if there are no headings). Scanned PDFs need OCR before upload.
