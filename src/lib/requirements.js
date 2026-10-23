// Pulls a starting list of requirements out of the requirements document.
// The user reviews and edits this list before any analysis runs.

const R_ID = /^\s*(?:[-*•]\s*)?\**(R\s?-?\d+)\**[.):\s-]+\s*(.+)$/i;
const LIST_ITEM = /^\s*(?:\d+[.)]|[-*•])\s+(.+)$/;

export function extractRequirements(doc) {
  const withIds = [];
  const listed = [];
  for (const seg of doc.segments) {
    for (const line of seg.text.split("\n")) {
      const r = line.match(R_ID);
      if (r) {
        withIds.push({ id: r[1].replace(/[\s-]/g, "").toUpperCase(), text: r[2].trim(), locator: seg.locator });
        continue;
      }
      const l = line.match(LIST_ITEM);
      if (l && l[1].trim().length > 15) listed.push({ text: l[1].trim(), locator: seg.locator });
    }
  }
  const found = withIds.length > 0 ? withIds : listed.map((r, i) => ({ id: `R${i + 1}`, ...r }));
  return dedupeIds(found).map((r) => ({ ...r, source: { file: doc.name, locator: r.locator } }));
}

function dedupeIds(reqs) {
  const seen = new Set();
  return reqs.map((r) => {
    let id = r.id;
    let n = 2;
    while (seen.has(id)) id = `${r.id}-${n++}`;
    seen.add(id);
    return { ...r, id };
  });
}

export function nextRequirementId(reqs) {
  let max = 0;
  for (const r of reqs) {
    const m = r.id.match(/^R(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `R${max + 1}`;
}
