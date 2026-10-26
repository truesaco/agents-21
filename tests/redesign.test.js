// QA tests for the visual redesign (Light/Dark/System theme, new styles.css).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const jsxFiles = [
  ...readdirSync(new URL("src/components/", root)).filter((f) => f.endsWith(".jsx")).map((f) => `src/components/${f}`),
  ...readdirSync(new URL("src/", root)).filter((f) => f.endsWith(".jsx")).map((f) => `src/${f}`),
];

// Minimal browser stand-ins so theme.js can run under node.
function fakeWindow({ storage = "ok", dark = false } = {}) {
  const store = new Map();
  const localStorage =
    storage === "ok"
      ? { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) }
      : null;
  const win = { matchMedia: () => ({ matches: dark, addEventListener() {}, removeEventListener() {} }) };
  Object.defineProperty(win, "localStorage", {
    get() {
      if (storage === "throw") throw new Error("SecurityError: storage blocked");
      return localStorage;
    },
  });
  globalThis.window = win;
  globalThis.document = { documentElement: { dataset: {} } };
  return { store, html: globalThis.document.documentElement };
}

test("theme.js: defaults to system, persists only the choice word, ignores junk", async () => {
  const { readThemeChoice, saveThemeChoice, initTheme } = await import("../src/components/theme.js");
  const { store, html } = fakeWindow({ dark: true });
  assert.equal(readThemeChoice(), "system");
  assert.equal(initTheme(), "system");
  assert.equal(html.dataset.theme, "dark", "system follows prefers-color-scheme");
  saveThemeChoice("light");
  assert.deepEqual([...store.entries()], [["vendorlens.theme", "light"]]);
  assert.equal(initTheme(), "light");
  assert.equal(html.dataset.theme, "light");
  store.set("vendorlens.theme", "<script>");
  assert.equal(readThemeChoice(), "system");
});

test("theme.js: blocked storage (throwing getter) never throws and falls back to system", async () => {
  const { readThemeChoice, saveThemeChoice, applyTheme, initTheme } = await import("../src/components/theme.js");
  const { html } = fakeWindow({ storage: "throw", dark: false });
  assert.equal(readThemeChoice(), "system");
  assert.doesNotThrow(() => saveThemeChoice("dark"));
  assert.equal(initTheme(), "system");
  assert.equal(html.dataset.theme, "light");
  applyTheme("dark");
  assert.equal(html.dataset.theme, "dark", "choice still applies for the visit");
  delete globalThis.window;
  delete globalThis.document;
});

test("CSP: no inline style attributes or dangerouslySetInnerHTML in JSX", () => {
  for (const f of jsxFiles) {
    const src = read(f);
    assert.doesNotMatch(src, /\bstyle=\{/, `${f} uses a style attribute`);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/, `${f} injects HTML`);
  }
});

test("CSP: index.html has no inline scripts/styles and styles.css loads no external assets", () => {
  const html = read("index.html");
  for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    assert.match(m[0], /\bsrc=/, "script tags must have src");
    assert.equal(m[1].trim(), "", "no inline script body");
  }
  assert.doesNotMatch(html, /<style\b|\sstyle="/);
  assert.doesNotMatch(html, /https?:\/\//, "no external assets in index.html");
  const css = read("src/styles.css");
  assert.doesNotMatch(css, /@import|url\(\s*["']?(https?:)?\/\//, "no external CSS assets");
  const csp = read("netlify.toml").match(/Content-Security-Policy = "([^"]+)"/)[1];
  assert.match(csp, /style-src 'self';/);
  assert.match(csp, /script-src 'self';/);
});

test("styles: gap badge is distinguishable without colour and no vendor column is singled out", () => {
  const css = read("src/styles.css");
  // Gap cells get a hollow marker plus an outline, not only a different hue.
  assert.match(css, /\.status-not_documented\s*\{[^}]*--dot:\s*transparent/);
  assert.match(css, /\.badge\.status-not_documented\s*\{[^}]*box-shadow:\s*inset/);
  // Nothing hidden or faded for the gap state.
  const nd = [...css.matchAll(/[^{}]*not_documented[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join(";");
  assert.doesNotMatch(nd, /display:\s*none|visibility:\s*hidden|opacity:\s*0(\.\d+)?\s*(;|$)/);
  // No positional emphasis on vendor columns (e.g. highlighting the first vendor).
  // (Row-level rules such as "tr:last-child" are fine; column-level ones are not.)
  assert.doesNotMatch(css, /(td|th|col|vendor-head|\.cell)\s*:(nth-child|nth-of-type|first-child|first-of-type|last-child|last-of-type)/);
  assert.doesNotMatch(css, /\.(winner|best|top|leader|recommended|score|rank)\b/i);
  // The label text itself remains the primary, colour-independent signal.
  assert.match(read("src/components/ComparisonStep.jsx"), /STATUS_LABELS\[finding\.status\]/);
  assert.match(read("src/lib/verify.js"), /not_documented: "Not documented in provided materials"/);
});

test("styles: print forces the light palette regardless of data-theme", () => {
  const css = read("src/styles.css");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /:root,\s*:root\[data-theme\]\s*\{\s*color-scheme:\s*light;/);
  assert.match(print, /body\s*\{\s*background:\s*#fff;/);
});
