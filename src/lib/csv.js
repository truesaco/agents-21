import { STATUS_LABELS } from "./verify.js";

const cell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// One row per evidence item, so each claim keeps its own source and quote.
export function toCsv(requirements, vendors, results) {
  const rows = [["Requirement ID", "Requirement", "Vendor", "Status", "Summary", "Source file", "Locator", "Supporting quote"]];
  for (const req of requirements) {
    for (const vendor of vendors) {
      const finding = results[vendor.id]?.findings?.find((f) => f.requirement_id === req.id);
      if (!finding) continue;
      const base = [req.id, req.text, vendor.name, STATUS_LABELS[finding.status], finding.summary];
      if (finding.evidence.length === 0) rows.push([...base, "", "", ""]);
      for (const e of finding.evidence) rows.push([...base, e.file, e.locator, e.quote]);
    }
  }
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadText(filename, text, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
