// Splits plain text or Markdown into locatable segments. Each heading starts a
// new section; documents without headings are split into numbered line ranges.

const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const NUMBERED_HEADING = /^\s*((?:section\s+)?\d+(?:\.\d+)*\.?)\s+([A-Z][^.!?]{2,80})$/i;

export function segmentText(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const segments = [];
  let current = null;
  let sawHeading = false;

  const flush = () => {
    if (current && current.lines.join("\n").trim()) {
      segments.push({ locator: current.locator, text: current.lines.join("\n").trim() });
    }
  };

  for (const line of lines) {
    const md = line.match(HEADING);
    const numbered = !md && isLikelyHeading(line) ? line.match(NUMBERED_HEADING) : null;
    if (md || numbered) {
      flush();
      sawHeading = true;
      const label = md ? md[2] : `${numbered[1]} ${numbered[2]}`;
      current = { locator: `Section "${label.trim()}"`, lines: [] };
    } else {
      if (!current) current = { locator: "Opening text", lines: [] };
      current.lines.push(line);
    }
  }
  flush();

  if (!sawHeading) return segmentByLines(lines);
  return segments;
}

function isLikelyHeading(line) {
  const t = line.trim();
  return t.length > 0 && t.length <= 90 && !/[.:;,]$/.test(t);
}

function segmentByLines(lines, size = 40) {
  const segments = [];
  for (let i = 0; i < lines.length; i += size) {
    const chunk = lines.slice(i, i + size).join("\n").trim();
    if (chunk) segments.push({ locator: `Lines ${i + 1}-${Math.min(i + size, lines.length)}`, text: chunk });
  }
  return segments;
}
