// QA (M1): product-rule guards added by qa-evidence-auditor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { findQuote, finalizeFindings, STATUS } from "../src/lib/verify.js";
import { segmentText } from "../src/lib/segment.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const docs = [{ name: "a.md", segments: segmentText("# A\n\n## 1. Support\n\nWe offer 24/7 support with a 15-minute response for every severity one incident.") }];
const SUPPORT = docs[0].segments.find((s) => s.locator.includes("Support")).text;

test("a quote that splices text with an ellipsis is not verified", () => {
  assert.equal(findQuote(SUPPORT, "We offer 24/7 support ... every severity one incident"), null);
  assert.equal(findQuote(SUPPORT, "We offer 24/7 support … every severity one incident"), null);
  const out = finalizeFindings([{ id: "R1" }], [{ requirement_id: "R1", status: "addressed", summary: "s", evidence: [{ file: "a.md", locator: 'Section "1. Support"', quote: "We offer 24/7 support … every severity one incident" }] }], docs);
  assert.equal(out[0].status, STATUS.NOT_DOCUMENTED);
});

test("finalizeFindings never returns a not_documented finding with evidence", () => {
  const reqs = [{ id: "R1" }, { id: "R2" }, { id: "R3" }];
  const raw = [
    { requirement_id: "R1", status: "not_documented", summary: "x", evidence: [{ file: "a.md", locator: 'Section "1. Support"', quote: "We offer 24/7 support with a 15-minute response" }] },
    { requirement_id: "R2", status: "addressed", summary: "x", evidence: [{ file: "a.md", locator: "x", quote: "We are SOC 2 Type II certified annually" }] },
  ];
  for (const f of finalizeFindings(reqs, raw, docs)) {
    if (f.status === STATUS.NOT_DOCUMENTED) assert.equal((f.evidence || []).length, 0, `${f.requirement_id} carries evidence`);
  }
});

test("prompt and UI strings contain no recommendation wording", () => {
  const banned = /\b(recommend\w*|best|winners?|top choice|preferred)\b/i;
  const files = ["netlify/lib/prompt.mjs", ...readdirSync(new URL("src/components/", root)).filter((f) => f.endsWith(".jsx")).map((f) => `src/components/${f}`)];
  for (const f of readdirSync(new URL("src/", root))) if (f.endsWith(".jsx")) files.push(`src/${f}`);
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      const m = line.match(banned);
      // Disclaimers that negate the behaviour ("does not pick a winner", "never recommends") are allowed.
      if (m && !/\b(not|never|no)\b/i.test(line)) assert.fail(`${f}:${i + 1} contains "${m[0]}"`);
    });
  }
});

test("live request carries no tools and one vendor only", () => {
  const src = read("netlify/functions/analyze.mjs");
  assert.doesNotMatch(src, /\btools\s*:/);
  assert.doesNotMatch(src, /web_search|web_fetch/);
});
