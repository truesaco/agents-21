// Walks every step of docs/demo-script.md in demo mode in Chromium and asserts
// the text the script promises. Also saves one screenshot per step to
// docs/screenshots/.
//
// Usage (from the repo root):
//   npm run build && npx vite preview --port 4173 --strictPort &
//   node docs/scripts/check-demo-script.mjs [http://localhost:4173]
//
// Needs Playwright. Set PLAYWRIGHT_MODULE to its entry point if it isn't
// resolvable as "playwright", and CHROMIUM_PATH to a Chromium binary if
// Playwright's own browser isn't installed.
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const BASE = process.argv[2] || "http://localhost:4173/";
const root = new URL("../../", import.meta.url);
const shots = new URL("docs/screenshots/", root);
mkdirSync(shots, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const norm = (s) => s.replace(/\s+/g, " ").trim();
const seen = [];
const snap = async () => seen.push(norm(await page.locator("body").innerText()));
const shot = (name, opts = {}) => page.screenshot({ path: new URL(name, shots).pathname, type: "jpeg", quality: 60, ...opts });
const results = [];
const step = async (name, fn) => {
  await fn();
  await snap();
  results.push(name);
  console.log(`PASS  ${name}`);
};

await page.goto(BASE);

await step("1. Header shows the steps and How it works; panel lists four rules; keyboard and Escape work", async () => {
  for (const label of ["1 Documents", "2 Requirements", "3 Comparison"]) {
    await assert.doesNotReject(page.getByRole("button", { name: label, exact: true }).waitFor());
  }
  const summary = page.locator("header summary", { hasText: "How it works" });
  assert.equal(await summary.innerText(), "How it works");
  const details = page.locator("header details.how-it-works");
  assert.equal(await details.evaluate((d) => d.open), false);
  await summary.click();
  assert.equal(await details.evaluate((d) => d.open), true);
  const panel = page.getByRole("region", { name: "How VendorLens works" });
  const rules = await panel.locator("li strong").allInnerTexts();
  assert.deepEqual(rules, ["Only your documents.", "A quote and a location for every claim.", "Gaps are spelled out.", "You decide."]);
  const text = await panel.innerText();
  assert.match(text, /Not documented in provided materials/);
  assert.match(text, /never picks a winner/);
  assert.doesNotMatch(text, /ANTHROPIC/);
  await shot("01-how-it-works.jpg");
  await snap();
  await page.keyboard.press("Escape");
  assert.equal(await details.evaluate((d) => d.open), false, "Escape closes the panel");
  await summary.focus();
  await page.keyboard.press("Enter");
  assert.equal(await details.evaluate((d) => d.open), true, "Enter opens the panel");
  await page.keyboard.press("Enter");
  assert.equal(await details.evaluate((d) => d.open), false, "Enter closes the panel");
});

await step("2. Load sample data: 4 fictional files, 3 vendors", async () => {
  await page.getByRole("button", { name: "Load sample data", exact: true }).click();
  const items = page.locator(".doc-item");
  assert.equal(await items.count(), 4);
  assert.equal(await page.locator(".doc-item .tag", { hasText: "Fictional sample" }).count(), 4);
  const names = await page.locator(".doc-item .doc-name").allInnerTexts();
  assert.deepEqual(names, ["harbor-city-requirements.md", "turnstile-labs-proposal.md", "pulsegate-proposal.md", "bleacher-box-proposal.md"]);
  const sizes = (await items.allInnerTexts()).map((t) => t.match(/(\d+) sections\/pages/)[1]);
  assert.deepEqual(sizes, ["5", "11", "11", "11"]);
  const vendors = await page.locator(".vendor-name input").evaluateAll((els) => els.map((e) => e.value));
  assert.deepEqual(vendors, ["Turnstile Labs", "PulseGate Ticketing", "Bleacher Box"]);
  for (const h of ["Internal requirements", "Vendor proposals"]) assert.ok(await page.getByRole("heading", { name: h }).isVisible());
  await shot("02-sample-loaded.jpg");
});

await step('3. Sections on turnstile-labs-proposal.md: 11 locators; Section "6. Support" opens', async () => {
  const doc = page.locator(".doc-item", { hasText: "turnstile-labs-proposal.md" });
  await doc.getByRole("button", { name: "Sections", exact: true }).click();
  const locs = await doc.locator(".segment-list li").allInnerTexts();
  assert.equal(locs.length, 11);
  assert.equal(locs[1], 'Section "1. Executive Summary"');
  assert.equal(locs[10], 'Section "10. Implementation"');
  await doc.getByRole("button", { name: 'Section "6. Support"', exact: true }).click();
  const dialog = page.getByRole("dialog", { name: 'turnstile-labs-proposal.md, Section "6. Support"' });
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Event-day support is available 24\/7/);
  await shot("03-sections.jpg");
  await snap();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
});

await step("4. Next: review requirements →: 10 requirements R1-R10 with sources; Demo mode selected", async () => {
  await page.getByRole("button", { name: "Next: review requirements →", exact: true }).click();
  assert.ok(await page.getByRole("heading", { name: "2. Review requirements" }).isVisible());
  const ids = await page.locator(".req-item .req-id").allInnerTexts();
  assert.deepEqual(ids, ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]);
  const sources = await page.locator(".req-item .link").allInnerTexts();
  assert.equal(sources.length, 10);
  for (const s of sources) assert.equal(s, 'Source: harbor-city-requirements.md › Section "3. Requirements"');
  const topics = ["Integrated resale", "Mobile entry", "On-sale capacity", "Payment security", "Data ownership", "Support SLA", "Accessibility", "Fee transparency", "Integrations", "Implementation timeline"];
  const texts = await page.locator(".req-item textarea").evaluateAll((els) => els.map((e) => e.value));
  topics.forEach((t, i) => assert.ok(texts[i].startsWith(t + ":"), `R${i + 1} starts with ${t}`));
  const radios = page.locator('input[name="mode"]');
  assert.equal(await radios.nth(0).isChecked(), true, "Demo mode selected");
  const card = norm(await page.locator(".mode-card").innerText());
  assert.match(card, /Demo mode \(precomputed, no API call\)/);
  assert.match(card, /Live analysis \(Claude reads your documents\)/);
  // Without /api/status (vite preview) live mode is off, as on a site with no key.
  assert.match(card, /Not configured on this site\./);
  await shot("04-requirements.jpg", { fullPage: true });
});

await step("5. Run comparison: demo tag, 10 rows, 3 vendors, 47 quotes, counts", async () => {
  await page.getByRole("button", { name: "Run comparison", exact: true }).click();
  assert.ok(await page.getByRole("heading", { name: "3. Comparison" }).isVisible());
  assert.ok(await page.locator(".tag", { hasText: "Demo mode: precomputed results" }).isVisible());
  assert.equal(await page.locator("table.compare tbody tr").count(), 10);
  const heads = await page.locator("table.compare thead .vendor-head").allInnerTexts();
  assert.deepEqual(heads, ["Turnstile Labs", "PulseGate Ticketing", "Bleacher Box"]);
  assert.equal(await page.locator("table.compare .evidence").count(), 47);
  const counts = await page.locator("table.compare thead th").nth(1).locator(".count").allInnerTexts();
  assert.deepEqual(counts, ["8 addressed", "1 partial", "1 not documented"]);
  await shot("05-comparison.jpg");
});

await step("6. Click the Turnstile R1 quote: source opens with the quote highlighted", async () => {
  const quote = "Turnstile One includes Turnstile Exchange, a fully integrated resale marketplace.";
  const r1 = page.locator("table.compare tbody tr").nth(0);
  assert.match(await r1.locator("th").innerText(), /^R1 Integrated resale/);
  await r1.locator("td").nth(0).locator(".evidence", { hasText: quote }).click();
  const dialog = page.getByRole("dialog", { name: 'turnstile-labs-proposal.md, Section "2. Resale Marketplace"' });
  await dialog.waitFor();
  assert.equal(await dialog.locator("mark").innerText(), quote);
  const bg = await dialog.locator("mark").evaluate((m) => getComputedStyle(m).backgroundColor);
  assert.equal(bg, "rgb(255, 229, 138)", "highlight is yellow");
  await shot("06-quote-highlight.jpg");
  await snap();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
});

await step("7. Exactly 4 Not documented cells: Bleacher R4, Turnstile R5, PulseGate R6, Bleacher R7", async () => {
  const vendors = ["Turnstile Labs", "PulseGate Ticketing", "Bleacher Box"];
  const found = [];
  const rows = page.locator("table.compare tbody tr");
  for (let i = 0; i < 10; i++) {
    const cells = rows.nth(i).locator("td");
    for (let j = 0; j < 3; j++) {
      const badge = await cells.nth(j).locator(".badge").innerText();
      if (badge === "Not documented in provided materials") {
        found.push(`R${i + 1} ${vendors[j]}`);
        assert.equal(await cells.nth(j).locator(".evidence").count(), 0, "gap cells carry no quote");
      }
    }
  }
  assert.deepEqual(found, ["R4 Bleacher Box", "R5 Turnstile Labs", "R6 PulseGate Ticketing", "R7 Bleacher Box"]);
  const grey = await page.locator(".badge.status-not_documented").first().evaluate((b) => getComputedStyle(b).backgroundColor);
  assert.equal(grey, "rgb(236, 238, 242)", "gap badge is grey");
  await page.locator("table.compare tbody tr").nth(3).scrollIntoViewIfNeeded();
  await shot("07-gaps.jpg");
});

await step("8. No-winner note; Export CSV downloads vendorlens-comparison.csv (51 rows); Print / PDF present", async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  const note = norm(await page.locator(".decision-note").innerText());
  assert.equal(note, "VendorLens does not pick a winner. It shows what each proposal documents against your requirements. Weighing trade-offs and making the decision is up to you and your team.");
  const body = await page.locator("main").innerText();
  assert.doesNotMatch(body, /\b(score|rank|winner is|recommended)\b/i);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV", exact: true }).click()]);
  assert.equal(download.suggestedFilename(), "vendorlens-comparison.csv");
  const csv = readFileSync(await download.path(), "utf8");
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Requirement ID,Requirement,Vendor,Status,Summary,Source file,Locator,Supporting quote");
  // Requirement text has no line breaks, so each CSV record is one line.
  assert.equal(lines.length - 1, 51, "47 quotes + 4 Not documented rows");
  assert.ok(await page.getByRole("button", { name: "Print / PDF", exact: true }).isEnabled());
  await shot("08-export.jpg");
});

await step("9. ← Back to requirements, edit R1: Demo mode greyed out, Run comparison disabled", async () => {
  await page.getByRole("button", { name: "← Back to requirements", exact: true }).click();
  const r1 = page.getByLabel("Requirement R1", { exact: true });
  await r1.press("End");
  await r1.pressSequentially(" Updated");
  const radios = page.locator('input[name="mode"]');
  assert.equal(await radios.nth(0).isDisabled(), true);
  assert.match(norm(await page.locator(".mode-card").innerText()), /Only available for the unmodified sample data\./);
  assert.equal(await page.getByRole("button", { name: "Run comparison", exact: true }).isDisabled(), true);
  await page.locator(".mode-card").scrollIntoViewIfNeeded();
  await shot("09-edited.jpg");
  await page.getByRole("button", { name: "1 Documents", exact: true }).click();
  await page.getByRole("button", { name: "Load sample data", exact: true }).click();
  await page.getByRole("button", { name: "Next: review requirements →", exact: true }).click();
  assert.equal(await radios.nth(0).isDisabled(), false, "Load sample data restores demo mode");
});

// Every bold label in the script's steps and the README demo table must have appeared on screen.
const md = readFileSync(new URL("docs/demo-script.md", root), "utf8");
const stepsText = md.slice(md.indexOf("### 1."), md.indexOf("## Tips"));
const readme = readFileSync(new URL("README.md", root), "utf8");
const readmeDemo = readme.slice(readme.indexOf("## 5-minute demo script"), readme.indexOf("## Local development"));
const bold = [...new Set([...(stepsText + readmeDemo).matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]).filter((b) => !/^(Do|Say|Viewer sees|Then|Note):?$/.test(b) && !b.startsWith("[")))];
const all = seen.join("\n");
const missing = bold.filter((b) => !all.includes(norm(b)));
assert.deepEqual(missing, [], `bold labels not seen on screen: ${missing.join(", ")}`);
console.log(`PASS  all ${bold.length} bold labels in docs/demo-script.md and the README demo table appeared on screen: ${bold.join(" | ")}`);

// The only expected console error is the 404 for /api/status under vite preview.
const unexpected = consoleErrors.filter((e) => !/404/.test(e));
assert.deepEqual(unexpected, [], "unexpected console errors");
console.log(`PASS  no console errors other than ${consoleErrors.length} expected 404 (no /api/status under vite preview)`);

await browser.close();
console.log(`\n${results.length}/9 steps passed.`);
