import { SAMPLE } from "../samples/index.js";
import demoResults from "../demo/demoResults.json";
import { STATUS_LABELS } from "../lib/verify.js";

// Intro shown above Step 1. The preview card is a static illustration built from
// the real fictional sample data (requirement R5 for all three sample vendors), so
// every quote and locator in it is copied verbatim from src/demo/demoResults.json.
const PREVIEW_REQ = "R5";
const requirement = SAMPLE.requirements.find((r) => r.id === PREVIEW_REQ);
const topic = requirement ? requirement.text.split(":")[0] : PREVIEW_REQ;
const previewCells = SAMPLE.vendors.map((v) => {
  const f = (demoResults[v.id] || []).find((x) => x.requirement_id === PREVIEW_REQ);
  const status = f && STATUS_LABELS[f.status] ? f.status : "not_documented";
  const ev = status === "not_documented" ? null : f.evidence[0];
  return { vendor: v.name, status, quote: ev?.quote, locator: ev ? `${ev.file} › ${ev.locator}` : null };
});
const previewLabel =
  `Illustration of a fictional sample result for ${PREVIEW_REQ} ${topic}. ` +
  previewCells
    .map((c) => `${c.vendor}: ${STATUS_LABELS[c.status]}${c.quote ? `, quoting "${c.quote}" from ${c.locator}` : ""}.`)
    .join(" ");

const STEPS = [
  { title: "Add your documents", body: <>Choose <strong>Load sample data</strong>, or use <strong>Upload file</strong> or <strong>Paste text</strong> for your requirements and each vendor proposal.</> },
  { title: "Review requirements", body: <>Select <strong>Next: review requirements →</strong>, then edit, add or remove requirements before anything is compared.</> },
  { title: "Run the comparison", body: <>Pick demo mode or live analysis, then select <strong>Run comparison</strong>. Each vendor is read on its own.</> },
  { title: "Check quotes and export", body: <>Click any quote to see it highlighted in the source file, then use <strong>Export CSV</strong> or <strong>Print / PDF</strong>.</> },
];

export default function Hero({ targetId }) {
  const goToStep1 = () => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
  };

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-main">
        <div className="hero-copy">
          <p className="hero-eyebrow">Vendor proposal review for sports and live-event teams</p>
          <p className="hero-scenario">Three ticketing proposals, one board meeting on Friday.</p>
          <h1 id="hero-title" className="hero-title">
            Compare proposals from every vendor without rereading every page.
          </h1>
          <p className="hero-lede">
            VendorLens compares vendor proposals against your requirements using only the documents you upload, with a quote and location for every claim.
          </p>
          <div className="hero-cta">
            <button type="button" className="btn primary hero-btn" onClick={goToStep1}>
              Try the demo
            </button>
            <p className="muted small hero-reassure">Fictional sample data, no sign-up and no API call in demo mode.</p>
          </div>
          <ul className="hero-points" aria-label="What every comparison does">
            <li>Every claim cites a quote</li>
            <li>Missing items show &ldquo;Not documented in provided materials&rdquo;</li>
            <li>It never picks a winner</li>
          </ul>
        </div>

        <div className="hero-preview" role="img" aria-label={previewLabel}>
          <div className="hero-preview-head">
            <span className="hero-preview-title">Example result</span>
            <span className="tag">Fictional sample</span>
          </div>
          <p className="hero-preview-req">
            <span className="req-id">{PREVIEW_REQ}</span> {topic}
          </p>
          <ul className="hero-preview-list">
            {previewCells.map((c) => (
              <li key={c.vendor} className="hero-preview-cell">
                <span className="vendor-head">{c.vendor}</span>
                <span className={`badge status-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                {c.quote && (
                  <span className="hero-preview-quote">
                    <q>{c.quote}</q>
                    <span className="locator">{c.locator}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="hero-how" aria-labelledby="hero-how-title">
        <h2 id="hero-how-title">How a review works</h2>
        <ol className="hero-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="hero-step-num" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p className="muted small">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="muted small">The rules behind every result are in <strong>How it works</strong> at the top of the page.</p>
      </section>
    </section>
  );
}
