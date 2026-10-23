#!/usr/bin/env node
// Fails (exit 1) if anything that looks like an API key or secret is found in
// the source tree or in the built site (dist/). No dependencies.
//
// Usage:
//   node scripts/check-secrets.mjs            scan source and dist/ (if present)
//   node scripts/check-secrets.mjs --source   scan source only (prebuild)
//   node scripts/check-secrets.mjs --dist     scan dist/ only (postbuild; fails if dist/ is missing)
//
// Source files are the git-tracked plus untracked-but-not-ignored files, so a
// key in a new file is caught before it is committed. node_modules, .git and
// dist are never part of the source scan. dist/ has an extra rule: the browser
// bundle must not even name ANTHROPIC_* variables.
//
// To accept a known false positive, put `secret-scan:allow` on the same line.
// Never use it for a real key.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".netlify"]);
const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".docx", ".zip", ".woff", ".woff2", ".ttf", ".otf", ".wasm"]);
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOW_MARKER = "secret-scan:allow";

// Each rule: a name and a global regex. `entropy` rules only count when the
// captured value (group 1) looks random, which keeps ordinary identifiers and
// prose from tripping them.
const RULES = [
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{16,}/g },
  { name: "OpenAI-style secret key", re: /\bsk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/g },
  { name: "AWS access key id", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: "GitHub token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/g },
  { name: "Slack token", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "Stripe secret key", re: /\b[sr]k_live_[0-9A-Za-z]{20,}/g },
  { name: "Private key block", re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g },
  {
    // apiKey: "....", "client_secret": '....', token = `....`
    name: "Key-like value assigned to a key/token/secret name",
    re: /(?:api[_-]?key|apikey|secret|token|passw(?:or)?d|auth[_-]?key|access[_-]?key|private[_-]?key)[\w-]*["']?\s*[:=]\s*["'`]([A-Za-z0-9+/_.=-]{24,})["'`]/gi,
    entropy: true,
  },
  {
    // ANTHROPIC_API_KEY=...  (env-file style, unquoted)
    name: "Key-like value assigned to a *_KEY / *_TOKEN / *_SECRET variable",
    re: /\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET)\s*=\s*([A-Za-z0-9+/_.=-]{24,})/g,
    entropy: true,
  },
];

// Browser bundle only: the env var name itself must never appear.
const DIST_RULES = [{ name: "Anthropic env var name in browser bundle", re: /ANTHROPIC_[A-Z_]*/g, showMatch: true }];

function shannon(s) {
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

// Random-looking: high entropy and at least two of lower/upper/digit.
function looksRandom(v) {
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/].filter((r) => r.test(v)).length;
  return classes >= 2 && shannon(v) >= 3.5;
}

function sourceFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return out
      .split("\0")
      .filter(Boolean)
      .filter((f) => !f.split("/").some((part) => SKIP_DIRS.has(part)))
      .map((f) => join(ROOT, f))
      .filter((f) => existsSync(f));
  } catch {
    return walk(ROOT); // not a git checkout (e.g. a source tarball)
  }
}

function walk(dir, skip = SKIP_DIRS) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) files.push(...walk(join(dir, entry.name), skip));
    } else if (entry.isFile()) files.push(join(dir, entry.name));
  }
  return files;
}

function scanFile(file, rules, findings) {
  if (BINARY_EXT.has(extname(file).toLowerCase())) return;
  const st = statSync(file);
  if (st.size > MAX_BYTES) return;
  const buf = readFileSync(file);
  if (buf.includes(0)) return; // binary
  const text = buf.toString("utf8");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(ALLOW_MARKER)) continue;
    for (const rule of rules) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line))) {
        if (rule.entropy && !looksRandom(m[1])) continue;
        findings.push({ file: relative(ROOT, file).split(sep).join("/"), line: i + 1, col: m.index + 1, rule: rule.name, match: rule.showMatch ? m[0] : redact(m[0]) });
      }
    }
  }
}

// Never echo a full secret into build logs.
function redact(s) {
  return s.length <= 12 ? s : `${s.slice(0, 10)}…(${s.length} chars)`;
}

const args = new Set(process.argv.slice(2));
const doSource = !args.has("--dist");
const doDist = !args.has("--source");
const findings = [];
let scanned = 0;

if (doSource) {
  for (const f of sourceFiles()) {
    scanFile(f, RULES, findings);
    scanned++;
  }
}
if (doDist) {
  if (existsSync(DIST)) {
    for (const f of walk(DIST, new Set())) {
      scanFile(f, [...RULES, ...DIST_RULES], findings);
      scanned++;
    }
  } else if (args.has("--dist")) {
    console.error("check-secrets: dist/ not found; run the build first.");
    process.exit(2);
  }
}

const scope = [doSource && "source", doDist && existsSync(DIST) && "dist/"].filter(Boolean).join(" + ");
if (findings.length) {
  console.error(`check-secrets: FAILED. ${findings.length} possible secret(s) in ${scope}:`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}:${f.col}  ${f.rule}  [${f.match}]`);
  console.error("Remove the value (keep keys in Netlify environment variables only) and rebuild.");
  process.exit(1);
}
console.log(`check-secrets: OK. ${scanned} file(s) scanned in ${scope}, no key-like strings found.`);
