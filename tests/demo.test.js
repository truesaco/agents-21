import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSampleSet } from "../src/samples/sampleSet.js";
import { finalizeFindings, verifyEvidence, STATUS } from "../src/lib/verify.js";

const read = (f) => readFileSync(new URL(`../src/samples/${f}`, import.meta.url), "utf8");
const sample = buildSampleSet({
  requirements: read("harbor-city-requirements.md"),
  turnstile: read("turnstile-labs-proposal.md"),
  pulsegate: read("pulsegate-proposal.md"),
  bleacher: read("bleacher-box-proposal.md"),
});
const demo = JSON.parse(read("../demo/demoResults.json"));

test("sample requirements doc yields R1-R10", () => {
  assert.deepEqual(sample.requirements.map((r) => r.id), ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]);
  for (const r of sample.requirements) assert.equal(r.source.locator, 'Section "3. Requirements"');
});

test("every demo quote is verbatim in the cited file and section", () => {
  for (const vendor of sample.vendors) {
    for (const f of demo[vendor.id]) {
      for (const e of f.evidence) {
        const v = verifyEvidence(e, vendor.documents);
        assert.ok(v, `${vendor.id} ${f.requirement_id}: quote not found: ${e.quote}`);
        assert.equal(v.relocated, false, `${vendor.id} ${f.requirement_id}: wrong locator ${e.locator}`);
      }
    }
  }
});

test("demo covers every requirement for every vendor and nothing is dropped", () => {
  for (const vendor of sample.vendors) {
    const final = finalizeFindings(sample.requirements, demo[vendor.id], vendor.documents);
    assert.equal(final.length, 10);
    for (const f of final) assert.equal(f.note, undefined, `${vendor.id} ${f.requirement_id} had dropped quotes`);
  }
});

test("each sample vendor has at least one Not documented requirement", () => {
  const missing = (id) => demo[id].filter((f) => f.status === STATUS.NOT_DOCUMENTED).map((f) => f.requirement_id);
  assert.deepEqual(missing("turnstile-labs"), ["R5"]); // no data ownership terms
  assert.deepEqual(missing("pulsegate"), ["R6"]); // no support SLA
  assert.deepEqual(missing("bleacher-box"), ["R4", "R7"]); // no PCI, no accessibility
});

test("sample proposals really are silent on their Not documented topics", () => {
  const text = (id) => sample.vendors.find((v) => v.id === id).documents[0].segments.map((s) => s.text).join("\n").toLowerCase();
  assert.doesNotMatch(text("turnstile-labs"), /own|export|termination/);
  assert.doesNotMatch(text("pulsegate"), /support|sla|severity|response time/);
  assert.doesNotMatch(text("bleacher-box"), /pci|attestation|wcag|accessib|ada\b/);
});
