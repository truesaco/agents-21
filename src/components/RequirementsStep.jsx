import { useEffect } from "react";
import { extractRequirements, nextRequirementId } from "../lib/requirements.js";

export default function RequirementsStep({
  requirementsDoc,
  requirements,
  setRequirements,
  vendors,
  mode,
  setMode,
  demoAvailable,
  liveEnabled,
  ready,
  onBack,
  onRun,
  onViewSource,
}) {
  useEffect(() => {
    if (requirements.length === 0 && requirementsDoc) {
      const found = extractRequirements(requirementsDoc);
      if (found.length) setRequirements(found);
    }
    // Only extract when arriving with an empty list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirementsDoc]);

  const update = (id, text) => setRequirements(requirements.map((r) => (r.id === id ? { ...r, text } : r)));
  const remove = (id) => setRequirements(requirements.filter((r) => r.id !== id));
  const add = () => setRequirements([...requirements, { id: nextRequirementId(requirements), text: "", source: null }]);

  const canRun = ready && ((mode === "demo" && demoAvailable) || (mode === "live" && liveEnabled));

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>2. Review requirements</h2>
          <p className="muted">
            These were pulled from <strong>{requirementsDoc?.name}</strong>. Edit, add or remove before running the comparison.
          </p>
        </div>
      </div>

      {requirements.length === 0 && (
        <p className="notice">No requirement lines were detected automatically. Add them below.</p>
      )}

      <ol className="req-list">
        {requirements.map((r) => (
          <li key={r.id} className="req-item">
            <span className="req-id">{r.id}</span>
            <div className="req-body">
              <textarea rows={3} value={r.text} onChange={(e) => update(r.id, e.target.value)} aria-label={`Requirement ${r.id}`} />
              {r.source && (
                <button className="link small" onClick={() => onViewSource(r.source.file, r.source.locator)}>
                  Source: {r.source.file} › {r.source.locator}
                </button>
              )}
            </div>
            <button className="btn ghost small" onClick={() => remove(r.id)} aria-label={`Remove ${r.id}`}>
              ✕
            </button>
          </li>
        ))}
      </ol>
      <button className="btn small" onClick={add}>
        + Add requirement
      </button>

      <div className="card mode-card">
        <h3>How to run the comparison</h3>
        <label className={`mode-option ${!demoAvailable ? "disabled" : ""}`}>
          <input type="radio" name="mode" checked={mode === "demo"} disabled={!demoAvailable} onChange={() => setMode("demo")} />
          <div>
            <strong>Demo mode</strong> (precomputed, no API call)
            <p className="muted small">
              {demoAvailable
                ? "Shows saved results for the sample proposals. Quotes are still checked against the files."
                : "Only available for the unmodified sample data. Load the sample data and leave the requirements unchanged to use it."}
            </p>
          </div>
        </label>
        <label className={`mode-option ${!liveEnabled ? "disabled" : ""}`}>
          <input type="radio" name="mode" checked={mode === "live"} disabled={!liveEnabled} onChange={() => setMode("live")} />
          <div>
            <strong>Live analysis</strong> (Claude reads your documents)
            <p className="muted small">
              {liveEnabled
                ? `Sends the requirements and each vendor's documents to Claude for analysis: ${vendors.length} request(s), rate limited. Each vendor is analyzed on its own, and every quote is verified before it is shown.`
                : "Not configured on this site. An admin needs to add the Anthropic API key in the Netlify environment settings."}
            </p>
          </div>
        </label>
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn primary" disabled={!canRun} onClick={onRun}>
          Run comparison
        </button>
      </div>
    </section>
  );
}
