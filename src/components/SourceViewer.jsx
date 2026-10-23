import { useEffect, useRef } from "react";
import { findQuote } from "../lib/verify.js";

export default function SourceViewer({ file, locator, quote, text, onClose }) {
  const markRef = useRef(null);
  const hit = quote ? findQuote(text, quote) : null;

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center" });
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${file}, ${locator}`} onClick={(e) => e.stopPropagation()}>
        <div className="row-between modal-head">
          <div>
            <div className="doc-name">{file}</div>
            <div className="muted small">{locator}</div>
          </div>
          <button className="btn ghost small" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
        <pre className="source-text">
          {hit ? (
            <>
              {text.slice(0, hit.start)}
              <mark ref={markRef}>{text.slice(hit.start, hit.end)}</mark>
              {text.slice(hit.end)}
            </>
          ) : (
            text
          )}
        </pre>
      </div>
    </div>
  );
}
