// "How it works" panel, opened from the header. A native <details> element, so it
// works with the keyboard (Tab to the summary, Enter or Space to toggle) and
// screen readers announce its expanded state. Escape closes it.
export default function HowItWorks() {
  const closeOnEscape = (e) => {
    if (e.key === "Escape" && e.currentTarget.open) {
      e.currentTarget.open = false;
      e.currentTarget.querySelector("summary")?.focus();
    }
  };

  return (
    <details className="how-it-works" onKeyDown={closeOnEscape}>
      <summary className="btn ghost small">How it works</summary>
      <div className="how-panel" role="region" aria-label="How VendorLens works">
        <p className="muted small">VendorLens follows four rules on every comparison.</p>
        <ol>
          <li>
            <strong>Only your documents.</strong> It reads only the files you upload or paste. There is no web search, no browsing, no outside knowledge and no contact with vendors.
          </li>
          <li>
            <strong>A quote and a location for every claim.</strong> Each finding shows the file and page or section, plus a short quote copied word for word. Every quote is checked against the source text before it is shown, and a quote that can't be found is removed. Click a quote to see it highlighted in the original.
          </li>
          <li>
            <strong>Gaps are spelled out.</strong> If a proposal doesn't address a requirement, the cell says &ldquo;Not documented in provided materials.&rdquo; Nothing is guessed or filled in.
          </li>
          <li>
            <strong>You decide.</strong> VendorLens never picks a winner: there are no scores, no rankings and no recommendations. Each vendor is analyzed on its own, and the decision stays with you and your team.
          </li>
        </ol>
      </div>
    </details>
  );
}
