// Evidence verification shared by the browser (demo mode) and the Netlify
// function (live mode). Every quote shown in the comparison table must be found
// verbatim in the provided documents; anything that cannot be found is dropped.

export const STATUS = {
  ADDRESSED: "addressed",
  PARTIAL: "partial",
  CONFLICTS: "conflicts",
  NOT_DOCUMENTED: "not_documented",
};

export const STATUS_LABELS = {
  addressed: "Addressed",
  partial: "Partially addressed",
  conflicts: "Conflicts with requirement",
  not_documented: "Not documented in provided materials",
};

export const NOT_DOCUMENTED_TEXT = "Not documented in provided materials.";

const CHAR_FOLDS = {
  "‘": "'", "’": "'", "‚": "'", "′": "'",
  "“": '"', "”": '"', "„": '"', "″": '"',
  "–": "-", "—": "-", "−": "-", " ": " ",
};

// Collapses whitespace, folds smart quotes/dashes and lowercases, while keeping
// a map from each normalized character back to its index in the original text.
export function normalizeWithMap(text) {
  let norm = "";
  const map = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i++) {
    let ch = CHAR_FOLDS[text[i]] ?? text[i];
    if (/\s/.test(ch)) {
      if (lastWasSpace) continue;
      ch = " ";
      lastWasSpace = true;
    } else {
      lastWasSpace = false;
    }
    norm += ch.toLowerCase();
    map.push(i);
  }
  if (norm.endsWith(" ")) {
    norm = norm.slice(0, -1);
    map.pop();
  }
  return { norm, map };
}

function normalizeQuote(quote) {
  return normalizeWithMap(quote.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")).norm;
}

// Returns the exact original substring of `text` matching `quote`, or null.
export function findQuote(text, quote) {
  const q = normalizeQuote(quote || "");
  if (q.length < 8) return null;
  const { norm, map } = normalizeWithMap(text);
  const at = norm.indexOf(q);
  if (at === -1) return null;
  const start = map[at];
  const end = map[at + q.length - 1] + 1;
  return { start, end, text: text.slice(start, end) };
}

// Looks for the quote in the cited segment first, then anywhere in the
// vendor's documents (correcting the locator). Returns verified evidence or null.
export function verifyEvidence(item, documents) {
  if (!item || typeof item.quote !== "string") return null;
  const cited = documents.find((d) => d.name === item.file);
  const ordered = [];
  if (cited) {
    const seg = cited.segments.find((s) => s.locator === item.locator);
    if (seg) ordered.push([cited, seg]);
    for (const s of cited.segments) if (s !== seg) ordered.push([cited, s]);
  }
  for (const d of documents) {
    if (d === cited) continue;
    for (const s of d.segments) ordered.push([d, s]);
  }
  for (const [doc, seg] of ordered) {
    const hit = findQuote(seg.text, item.quote);
    if (hit) {
      return {
        file: doc.name,
        locator: seg.locator,
        quote: hit.text,
        relocated: doc.name !== item.file || seg.locator !== item.locator,
      };
    }
  }
  return null;
}

// Turns raw model (or precomputed) findings into the final, verified set: one
// finding per requirement, unverifiable quotes removed, and any claim left
// without evidence downgraded to "Not documented in provided materials".
export function finalizeFindings(requirements, rawFindings, documents) {
  const byId = new Map();
  for (const f of rawFindings || []) {
    if (f && f.requirement_id && !byId.has(f.requirement_id)) byId.set(f.requirement_id, f);
  }
  return requirements.map((req) => {
    const raw = byId.get(req.id);
    if (!raw || raw.status === STATUS.NOT_DOCUMENTED || !STATUS_LABELS[raw.status]) {
      return notDocumented(req.id);
    }
    const evidence = [];
    let dropped = 0;
    for (const item of raw.evidence || []) {
      const v = verifyEvidence(item, documents);
      if (v && !evidence.some((e) => e.quote === v.quote && e.locator === v.locator)) evidence.push(v);
      else if (!v) dropped++;
    }
    if (evidence.length === 0) {
      return {
        ...notDocumented(req.id),
        note: dropped > 0
          ? "A claim was returned for this requirement, but its supporting quote could not be found in the provided materials, so it was removed."
          : undefined,
      };
    }
    return {
      requirement_id: req.id,
      status: raw.status,
      summary: String(raw.summary || "").trim(),
      evidence,
      note: dropped > 0 ? `${dropped} unverifiable quote(s) removed.` : undefined,
    };
  });
}

function notDocumented(requirementId) {
  return {
    requirement_id: requirementId,
    status: STATUS.NOT_DOCUMENTED,
    summary: NOT_DOCUMENTED_TEXT,
    evidence: [],
  };
}
