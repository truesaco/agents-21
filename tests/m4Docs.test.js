// QA (M4): guards added by qa-evidence-auditor for the README, demo script,
// "How it works" panel and the built bundle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { buildSampleSet } from "../src/samples/sampleSet.js";
import { finalizeFindings, STATUS } from "../src/lib/verify.js";
import { toCsv } from "../src/lib/csv.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const sample = buildSampleSet({
  requirements: read("src/samples/harbor-city-requirements.md"),
  turnstile: read("src/samples/turnstile-labs-proposal.md"),
  pulsegate: read("src/samples/pulsegate-proposal.md"),
  bleacher: read("src/samples/bleacher-box-proposal.md"),
});
const demo = JSON.parse(read("src/demo/demoResults.json"));
// What the comparison table shows in demo mode: findings after verification.
const shown = Object.fromEntries(sample.vendors.map((v) => [v.id, finalizeFindings(sample.requirements, demo[v.id], v.documents)]));

test("README, demo script, checklist and How it works contain no recommendation or scoring wording", () => {
  const banned = /\b(recommend\w*|best|winners?|top choice|preferred|scor(e|es|ed|ing)|rank(s|ed|ing|ings)?)\b/i;
  const files = ["README.md", "docs/demo-script.md", "docs/netlify-checklist.md", "src/components/HowItWorks.jsx"];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      const m = line.match(banned);
      // Lines that negate the behaviour ("never picks a winner", "no score or winner") are allowed,
      // as are references to the qa agent's "no-winner rule" and the "does not pick a winner" UI note.
      if (m && !/\b(not|never|no|no-winner)\b/i.test(line)) assert.fail(`${f}:${i + 1} contains "${m[0]}": ${line.trim()}`);
    });
  }
});

test("How it works panel states all four rules, with the exact gap label", () => {
  const src = read("src/components/HowItWorks.jsx");
  assert.match(src, /no web search, no browsing, no outside knowledge and no contact with vendors/);
  assert.match(src, /word for word/);
  assert.match(src, /a quote that can't be found is removed/);
  assert.match(src, /Not documented in provided materials\./);
  assert.match(src, /never picks a winner/);
  assert.match(src, /Each vendor is analyzed on its own/);
  assert.match(read("src/App.jsx"), /<HowItWorks \/>/, "panel is rendered in the app header");
});

test("demo numbers quoted in the README and demo script match the demo data", () => {
  const quotes = Object.values(shown).flat().reduce((n, f) => n + f.evidence.length, 0);
  assert.equal(quotes, 47);
  assert.match(read("README.md"), /47 quotes/);
  assert.match(read("docs/demo-script.md"), /47 quotes in total/);

  const gaps = sample.vendors.flatMap((v) => shown[v.id].filter((f) => f.status === STATUS.NOT_DOCUMENTED).map((f) => `${v.name} ${f.requirement_id}`));
  assert.deepEqual(gaps.sort(), ["Bleacher Box R4", "Bleacher Box R7", "PulseGate Ticketing R6", "Turnstile Labs R5"]);
  for (const f of Object.values(shown).flat()) {
    if (f.status === STATUS.NOT_DOCUMENTED) assert.equal(f.evidence.length, 0);
    else assert.ok(f.evidence.length > 0, `${f.requirement_id} has a status but no quote`);
  }

  const count = (id, s) => shown[id].filter((f) => f.status === s).length;
  assert.deepEqual([count("turnstile-labs", STATUS.ADDRESSED), count("turnstile-labs", STATUS.PARTIAL), count("turnstile-labs", STATUS.NOT_DOCUMENTED)], [8, 1, 1]);

  const r1 = shown["turnstile-labs"].find((f) => f.requirement_id === "R1");
  assert.ok(
    r1.evidence.some((e) => e.locator === 'Section "2. Resale Marketplace"' && e.quote === "Turnstile One includes Turnstile Exchange, a fully integrated resale marketplace."),
    "the demo-script step 6 quote is in the demo data at the cited locator",
  );

  const results = Object.fromEntries(Object.entries(shown).map(([id, findings]) => [id, { findings }]));
  const csvRows = toCsv(sample.requirements, sample.vendors, results).split("\r\n").length - 1;
  assert.equal(csvRows, 51);
  assert.match(read("docs/demo-script.md"), /51 rows for the sample/);
});

test("built bundle (if present) carries no key, no passcode variable and no ANTHROPIC_ names", { skip: !existsSync(new URL("dist/assets/", root)) }, () => {
  for (const f of readdirSync(new URL("dist/assets/", root))) {
    if (!/\.(m?js|css|html)$/.test(f)) continue;
    const text = read(`dist/assets/${f}`);
    assert.doesNotMatch(text, /sk-ant-/, f);
    assert.doesNotMatch(text, /ANTHROPIC_|LIVE_PASSCODE|PASSCODE_FAILS_PER_HOUR|RATE_LIMIT_/, f);
  }
});
