import { test } from "node:test";
import assert from "node:assert/strict";
import { findQuote, verifyEvidence, finalizeFindings, NOT_DOCUMENTED_TEXT } from "../src/lib/verify.js";
import { segmentText } from "../src/lib/segment.js";

const docs = [
  {
    name: "a.md",
    segments: segmentText("# A\n\n## 1. Support\n\nWe offer 24/7   support with a\n15-minute response.\n\n## 2. Fees\n\nThe fee is “$3” per ticket — always."),
  },
];

const SUPPORT = docs[0].segments.find((s) => s.locator.includes("Support")).text;
const FEES = docs[0].segments.find((s) => s.locator.includes("Fees")).text;

test("findQuote tolerates whitespace, case and smart punctuation but returns original text", () => {
  const hit = findQuote(SUPPORT, "we offer 24/7 support with a 15-minute response");
  assert.equal(hit.text, "We offer 24/7   support with a\n15-minute response");
  assert.ok(findQuote(FEES, 'The fee is "$3" per ticket - always.'));
});

test("findQuote rejects paraphrases and tiny quotes", () => {
  assert.equal(findQuote(SUPPORT, "We provide 24/7 support"), null);
  assert.equal(findQuote(SUPPORT, "24/7"), null);
});

test("verifyEvidence corrects a wrong locator", () => {
  const v = verifyEvidence({ file: "a.md", locator: 'Section "2. Fees"', quote: "24/7   support" }, docs);
  assert.equal(v.locator, 'Section "1. Support"');
  assert.equal(v.relocated, true);
});

test("finalizeFindings downgrades unverifiable claims and fills missing requirements", () => {
  const reqs = [{ id: "R1" }, { id: "R2" }, { id: "R3" }];
  const raw = [
    { requirement_id: "R1", status: "addressed", summary: "ok", evidence: [{ file: "a.md", locator: 'Section "1. Support"', quote: "15-minute response" }] },
    { requirement_id: "R2", status: "addressed", summary: "made up", evidence: [{ file: "a.md", locator: "x", quote: "We are PCI DSS Level 1 certified" }] },
  ];
  const out = finalizeFindings(reqs, raw, docs);
  assert.equal(out[0].status, "addressed");
  assert.equal(out[1].status, "not_documented");
  assert.equal(out[1].summary, NOT_DOCUMENTED_TEXT);
  assert.match(out[1].note, /could not be found/);
  assert.equal(out[2].status, "not_documented");
});

test("segmentText falls back to line ranges without headings", () => {
  const segs = segmentText("just some text\nwith no headings");
  assert.equal(segs[0].locator, "Lines 1-2");
});
