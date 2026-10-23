import { useState } from "react";
import { ACCEPTED, parseFile, documentFromPaste, newId } from "../lib/parse.js";

export default function DocumentsStep({ requirementsDoc, setRequirementsDoc, vendors, setVendors, loadSample, reset, onView, onNext, ready }) {
  const [error, setError] = useState("");
  const empty = !requirementsDoc && vendors.length === 0;

  const updateVendor = (id, patch) => setVendors(vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addVendor = () => setVendors([...vendors, { id: newId("vendor"), name: `Vendor ${vendors.length + 1}`, documents: [] }]);

  const handleFiles = async (files, onDoc) => {
    setError("");
    for (const file of files) {
      try {
        onDoc(await parseFile(file));
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>1. Add your documents</h2>
          <p className="muted">Upload or paste your internal requirements and each vendor's proposal. These files are the complete evidence set.</p>
        </div>
        {!empty && (
          <button className="btn ghost" onClick={reset}>
            Start over
          </button>
        )}
      </div>

      <div className="demo-banner">
        <div>
          <strong>Want to see it work first?</strong> Load a sample ticketing RFP for a fictional arena with three fictional vendor proposals.
        </div>
        <button className="btn primary" onClick={loadSample}>
          Load sample data
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Internal requirements</h3>
          <p className="muted small">
            Lines starting with an ID like <code>R1.</code> become requirements. Otherwise numbered or bulleted lines are used. You can edit the list in the next step.
          </p>
          {requirementsDoc ? (
            <DocItem doc={requirementsDoc} onRemove={() => setRequirementsDoc(null)} onView={onView} />
          ) : (
            <DocInput label="requirements" onFiles={(f) => handleFiles(f, setRequirementsDoc)} onPaste={(text) => setRequirementsDoc(documentFromPaste("Pasted requirements", text))} />
          )}
        </div>

        <div className="card">
          <div className="row-between">
            <h3>Vendor proposals</h3>
            <button className="btn small" onClick={addVendor}>
              + Add vendor
            </button>
          </div>
          {vendors.length === 0 && <p className="muted small">No vendors yet. Add one for each proposal you are comparing.</p>}
          {vendors.map((v) => (
            <div key={v.id} className="vendor-block">
              <div className="row-between">
                <label className="vendor-name">
                  <span className="sr-only">Vendor name</span>
                  <input value={v.name} onChange={(e) => updateVendor(v.id, { name: e.target.value })} placeholder="Vendor name" />
                </label>
                <button className="btn ghost small" onClick={() => setVendors(vendors.filter((x) => x.id !== v.id))} aria-label={`Remove ${v.name}`}>
                  Remove
                </button>
              </div>
              {v.documents.map((d) => (
                <DocItem key={d.id} doc={d} onView={onView} onRemove={() => updateVendor(v.id, { documents: v.documents.filter((x) => x.id !== d.id) })} />
              ))}
              <DocInput
                compact
                label={v.name}
                onFiles={(files) => {
                  const added = [];
                  handleFiles(files, (doc) => added.push(doc)).then(() => {
                    if (added.length) updateVendor(v.id, { documents: [...v.documents, ...added] });
                  });
                }}
                onPaste={(text) => updateVendor(v.id, { documents: [...v.documents, documentFromPaste(`Pasted text ${v.documents.length + 1}`, text)] })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="actions">
        <span className="muted small">{ready ? "" : "Add a requirements document and at least one vendor with a document."}</span>
        <button className="btn primary" disabled={!ready} onClick={onNext}>
          Next: review requirements →
        </button>
      </div>
    </section>
  );
}

function DocItem({ doc, onRemove, onView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="doc-item">
      <div className="row-between">
        <div>
          <span className="doc-name">{doc.name}</span>
          {doc.sample && <span className="tag">Fictional sample</span>}
          <span className="muted small"> · {doc.segments.length} sections/pages</span>
        </div>
        <div className="row">
          <button className="btn ghost small" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Hide" : "Sections"}
          </button>
          <button className="btn ghost small" onClick={onRemove} aria-label={`Remove ${doc.name}`}>
            ✕
          </button>
        </div>
      </div>
      {open && (
        <ul className="segment-list">
          {doc.segments.map((s) => (
            <li key={s.locator}>
              <button className="link" onClick={() => onView(doc, s)}>
                {s.locator}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocInput({ onFiles, onPaste, compact, label }) {
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  return (
    <div className={`doc-input ${compact ? "compact" : ""}`}>
      <div className="row">
        <label className="btn small">
          Upload file
          <input
            type="file"
            accept={ACCEPTED}
            multiple
            hidden
            onChange={(e) => {
              onFiles([...e.target.files]);
              e.target.value = "";
            }}
          />
        </label>
        <button className="btn ghost small" onClick={() => setPasting(!pasting)}>
          {pasting ? "Cancel paste" : "Paste text"}
        </button>
        <span className="muted small">PDF, DOCX, TXT, MD</span>
      </div>
      {pasting && (
        <div className="paste-box">
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text here. Markdown headings (## Section) become section locators."
            aria-label={`Paste text for ${label}`}
          />
          <button
            className="btn small primary"
            disabled={!text.trim()}
            onClick={() => {
              onPaste(text);
              setText("");
              setPasting(false);
            }}
          >
            Add pasted text
          </button>
        </div>
      )}
    </div>
  );
}
