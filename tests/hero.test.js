// QA (hero): guards added by qa-evidence-auditor for src/components/Hero.jsx.
// Hero.jsx uses JSX and Vite "?raw" imports, so it can't be imported under node --test.
// These tests read its source, mirror the preview-card derivation, and check the result
// against the verified demo findings that the comparison table shows.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSampleSet } from "../src/samples/sampleSet.js";
import { finalizeFindings, verifyEvidence, STATUS, STATUS_LABELS } from "../src/lib/verify.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const sample = buildSampleSet({
  requirements: read("src/samples/harbor-city-requirements.md"),
  turnstile: read("src/samples/turnstile-labs-proposal.md"),
  pulsegate: read("src/samples/pulsegate-proposal.md"),
  bleacher: read("src/samples/bleacher-box-proposal.md"),
});
const demo = JSON.parse(read("src/demo/demoResults.json"));
const hero = read("src/components/Hero.jsx");

const previewReq = hero.match(/const PREVIEW_REQ = "(R\d+)";/)?.[1];

test("hero preview card derivation is the one these tests mirror", () => {
  assert.ok(previewReq, "PREVIEW_REQ constant not found in Hero.jsx");
  assert.ok(sample.requirements.some((r) => r.id === previewReq), `${previewReq} is not a sample requirement`);
  // The card reads raw demo data and shows evidence[0]; if this changes, update the mirror below.
  assert.match(hero, /from "\.\.\/demo\/demoResults\.json"/);
  assert.match(hero, /f\.evidence\[0\]/);
  // The card contains no hard-coded quote text: every <q> renders c.quote.
  assert.match(hero, /<q>\{c\.quote\}<\/q>/);
});

test("every hero preview quote is verbatim at its cited locator and the status matches the table", () => {
  for (const vendor of sample.vendors) {
    const raw = demo[vendor.id].find((x) => x.requirement_id === previewReq);
    const shown = finalizeFindings(sample.requirements, demo[vendor.id], vendor.documents).find((x) => x.requirement_id === previewReq);
    const status = raw && STATUS_LABELS[raw.status] ? raw.status : STATUS.NOT_DOCUMENTED;
    assert.equal(status, shown.status, `${vendor.id} ${previewReq}: hero status ${status} != table status ${shown.status}`);
    if (status === STATUS.NOT_DOCUMENTED) {
      assert.equal(shown.evidence.length, 0);
      continue;
    }
    const ev = raw.evidence[0];
    assert.ok(ev && ev.quote, `${vendor.id} ${previewReq}: documented status shown with no quote`);
    const v = verifyEvidence(ev, vendor.documents);
    assert.ok(v, `${vendor.id} ${previewReq}: hero quote not found in source: ${ev.quote}`);
    assert.equal(v.relocated, false, `${vendor.id} ${previewReq}: hero locator ${ev.locator} is wrong`);
    assert.equal(v.file, ev.file);
    // The displayed text must be the original source text, and the table must show the same quote.
    assert.equal(v.quote, ev.quote, `${vendor.id} ${previewReq}: hero quote differs from the source text`);
    assert.ok(shown.evidence.some((e) => e.quote === ev.quote && e.locator === ev.locator), `${vendor.id} ${previewReq}: hero quote not in the table cell`);
  }
});

test("hero preview keeps at least one Not documented cell and is labelled as fictional", () => {
  const nd = sample.vendors.filter((v) => demo[v.id].find((x) => x.requirement_id === previewReq)?.status === STATUS.NOT_DOCUMENTED);
  assert.ok(nd.length >= 1, "preview should illustrate a gap");
  assert.match(hero, /<span className="tag">Fictional sample<\/span>/);
  assert.match(hero, /Fictional sample data/);
});

test("hero copy has no winner, score, pricing, social proof or unverifiable claims", () => {
  const banned = /\b(recommend\w*|best|winners?|top choice|preferred|scor(e|es|ed|ing)|rank(s|ed|ing|ings)?|pric(e|es|ing)|\$\d|free trial|testimonial|trusted by|customers?|users|teams use|loved|faster|saves?|hours?|minutes?|\d+\s*%|percent|accura\w*|guarantee\w*|AI-powered|competitor\w*|vs\.?)\b/i;
  hero.split("\n").forEach((line, i) => {
    const m = line.match(banned);
    if (m && !/\b(not|never|no)\b/i.test(line)) assert.fail(`src/components/Hero.jsx:${i + 1} contains "${m[0]}": ${line.trim()}`);
  });
  assert.doesNotMatch(hero, /<img\b|<svg\b|logo/i, "hero must not show logos or images");
});

test("hero accessibility basics: one h1, a real button, non-interactive preview card", () => {
  assert.equal((hero.match(/<h1\b/g) || []).length, 1);
  assert.match(hero, /<button type="button"[^>]*onClick=\{goToStep1\}/);
  const card = hero.slice(hero.indexOf('className="hero-preview"'), hero.indexOf('className="hero-how"'));
  assert.match(card, /role="img"/);
  assert.doesNotMatch(card, /<(button|a|input|select|textarea)\b|tabIndex|onClick/);
  // App.jsx demotes the brand h1 to a <p> on Step 1, where the hero h1 is shown.
  const app = read("src/App.jsx");
  assert.match(app, /const BrandName = step === 0 \? "p" : "h1";/);
  assert.match(app, /\{step === 0 && <Hero targetId="step-documents-title" \/>\}/);
  assert.match(read("src/components/DocumentsStep.jsx"), /id="step-documents-title"[^>]*tabIndex=\{-1\}/);
});
