import { useState } from "react";
import { STATUS_LABELS } from "../lib/verify.js";
import { toCsv, downloadText } from "../lib/csv.js";

const STATUS_ORDER = ["addressed", "partial", "conflicts", "not_documented"];

export default function ComparisonStep({ requirements, vendors, results, mode, onBack, onViewEvidence }) {
  const [gapsOnly, setGapsOnly] = useState(false);
  const allDone = vendors.every((v) => results[v.id]?.state === "done" || results[v.id]?.state === "error");

  const findingFor = (vendor, reqId) => results[vendor.id]?.findings?.find((f) => f.requirement_id === reqId);
  const rows = gapsOnly
    ? requirements.filter((r) => vendors.some((v) => {
        const f = findingFor(v, r.id);
        return f && f.status !== "addressed";
      }))
    : requirements;

  return (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <h2>3. Comparison</h2>
          <p className="muted">
            Every claim links to its source. Click a quote to see it highlighted in the original document.
            {mode === "demo" && <span className="tag">Demo mode: precomputed results</span>}
          </p>
        </div>
        <div className="row no-print">
          <label className="toggle">
            <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} /> Show only rows with gaps
          </label>
          <button className="btn small" disabled={!allDone} onClick={() => downloadText("vendorlens-comparison.csv", toCsv(requirements, vendors, results))}>
            Export CSV
          </button>
          <button className="btn small" disabled={!allDone} onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>

      <div className="decision-note">
        <strong>VendorLens does not pick a winner.</strong> It shows what each proposal documents against your requirements. Weighing trade-offs and making the decision is up to you and your team.
      </div>

      <div className="table-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th className="req-col">Requirement</th>
              {vendors.map((v) => (
                <th key={v.id}>
                  <div className="vendor-head">{v.name}</div>
                  <VendorStatus result={results[v.id]} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="req-col">
                  <span className="req-id">{r.id}</span> {r.text}
                </th>
                {vendors.map((v) => (
                  <td key={v.id}>
                    <Cell result={results[v.id]} finding={findingFor(v, r.id)} onViewEvidence={(e) => onViewEvidence(v, e)} />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={vendors.length + 1} className="muted">
                  No gaps: every vendor addresses every requirement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="actions no-print">
        <button className="btn ghost" onClick={onBack}>
          ← Back to requirements
        </button>
      </div>
    </section>
  );
}

function VendorStatus({ result }) {
  if (!result) return null;
  if (result.state === "loading") {
    return <div className="muted small">Analyzing… {result.progress ? `(${result.progress.toLocaleString()} chars)` : ""}</div>;
  }
  if (result.state === "error") return <div className="error small">{result.error}</div>;
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  for (const f of result.findings) counts[f.status]++;
  return (
    <div className="counts small">
      {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
        <span key={s} className={`count status-${s}`} title={STATUS_LABELS[s]}>
          {counts[s]} {shortLabel(s)}
        </span>
      ))}
    </div>
  );
}

const shortLabel = (s) => ({ addressed: "addressed", partial: "partial", conflicts: "conflicts", not_documented: "not documented" })[s];

function Cell({ result, finding, onViewEvidence }) {
  if (!result || result.state === "loading") return <div className="skeleton" aria-label="Loading" />;
  if (result.state === "error") return <span className="muted small">No result</span>;
  if (!finding) return null;
  return (
    <div className="cell">
      <span className={`badge status-${finding.status}`}>{STATUS_LABELS[finding.status]}</span>
      {finding.status !== "not_documented" && <p className="summary">{finding.summary}</p>}
      {finding.evidence.map((e, i) => (
        <button key={i} className="evidence" onClick={() => onViewEvidence(e)}>
          <q>{e.quote}</q>
          <span className="locator">
            {e.file} › {e.locator}
          </span>
        </button>
      ))}
      {finding.note && <p className="note small">{finding.note}</p>}
    </div>
  );
}
