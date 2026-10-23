// Docs consistency checks for the README:
//  1. Every environment variable read in netlify/ (process.env.X, env.X on a
//     process.env default, and names passed to intEnv("X")) is in the README's
//     environment-variable table, and every variable in that table is read in netlify/.
//  2. Every relative link and image path in README.md and docs/demo-script.md
//     points to an existing file.
// Usage: node docs/scripts/check-docs.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let failed = false;
const fail = (msg) => { failed = true; console.log(`FAIL  ${msg}`); };
const pass = (msg) => console.log(`PASS  ${msg}`);

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// 1. Environment variables
const codeVars = new Map();
for (const file of walk(join(root, "netlify")).filter((f) => /\.(m?js|ts)$/.test(f))) {
  const src = readFileSync(file, "utf8");
  const rel = file.slice(root.length + 1);
  const patterns = [/process\.env\.([A-Z][A-Z0-9_]*)/g, /\benv\.([A-Z][A-Z0-9_]*)/g, /intEnv\(\s*"([A-Z][A-Z0-9_]*)"/g, /process\.env\[\s*"([A-Z][A-Z0-9_]*)"\s*\]/g];
  for (const re of patterns) for (const m of src.matchAll(re)) {
    if (!codeVars.has(m[1])) codeVars.set(m[1], new Set());
    codeVars.get(m[1]).add(rel);
  }
}
const readme = readFileSync(join(root, "README.md"), "utf8");
const tableStart = readme.indexOf("| Variable | Required |");
const table = readme.slice(tableStart, readme.indexOf("\n\n", tableStart));
const docVars = new Set([...table.matchAll(/^\| `([A-Z][A-Z0-9_]*)` \|/gm)].map((m) => m[1]));
console.log(`code reads: ${[...codeVars].map(([k, v]) => `${k} (${[...v].join(", ")})`).join("; ")}`);
console.log(`README table: ${[...docVars].join(", ")}`);
const undocumented = [...codeVars.keys()].filter((v) => !docVars.has(v));
const unused = [...docVars].filter((v) => !codeVars.has(v));
undocumented.length ? fail(`read in netlify/ but not in the README table: ${undocumented.join(", ")}`) : pass("every env var read in netlify/ is in the README table");
unused.length ? fail(`in the README table but not read in netlify/: ${unused.join(", ")}`) : pass("every env var in the README table is read in netlify/");

// 2. Relative links and images
for (const doc of ["README.md", "docs/demo-script.md"]) {
  const text = readFileSync(join(root, doc), "utf8");
  const targets = [...text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((t) => !/^(https?:|mailto:|#)/.test(t));
  const missing = targets.filter((t) => !existsSync(join(root, dirname(doc), decodeURIComponent(t.split("#")[0]))));
  missing.length ? fail(`${doc}: ${missing.length} broken relative link(s): ${missing.join(", ")}`) : pass(`${doc}: all ${targets.length} relative links and images resolve`);
}

process.exit(failed ? 1 : 0);
