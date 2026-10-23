// M4 (R-4): optional shared passcode for live mode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPasscode, passcodeMatches, passcodeRequired, PASSCODE_HEADER } from "../netlify/lib/passcode.mjs";

const req = (value) => new Request("https://example.test/api/analyze", { method: "POST", headers: value === undefined ? {} : { [PASSCODE_HEADER]: value } });
const ENV = { LIVE_PASSCODE: "correct horse battery" };

test("unset or blank LIVE_PASSCODE leaves live mode open", () => {
  for (const env of [{}, { LIVE_PASSCODE: "" }, { LIVE_PASSCODE: "   " }]) {
    assert.equal(passcodeRequired(env), false);
    assert.equal(checkPasscode(req(), env), true);
    assert.equal(checkPasscode(req("anything"), env), true);
  }
});

test("when set, only the exact passcode in the header is accepted", () => {
  assert.equal(passcodeRequired(ENV), true);
  assert.equal(checkPasscode(req("correct horse battery"), ENV), true);
  assert.equal(checkPasscode(req(), ENV), false);
  assert.equal(checkPasscode(req(""), ENV), false);
  assert.equal(checkPasscode(req("correct horse batter"), ENV), false);
  assert.equal(checkPasscode(req("correct horse battery!"), ENV), false);
  assert.equal(checkPasscode(req("Correct horse battery"), ENV), false);
});

test("passcodeMatches rejects non-strings and oversized input without throwing", () => {
  assert.equal(passcodeMatches(undefined, "x"), false);
  assert.equal(passcodeMatches(123, "x"), false);
  assert.equal(passcodeMatches("x".repeat(10_000), "x"), false);
  assert.equal(passcodeMatches("abc", "abc"), true);
});

test("/api/status reports passcodeRequired as a boolean and never the value", async () => {
  const saved = { k: process.env.ANTHROPIC_API_KEY, p: process.env.LIVE_PASSCODE };
  try {
    process.env.ANTHROPIC_API_KEY = "<placeholder>";
    process.env.LIVE_PASSCODE = "correct horse battery";
    const { default: status } = await import("../netlify/functions/status.mjs");
    const text = await (await status()).text();
    assert.deepEqual(JSON.parse(text), { liveEnabled: true, passcodeRequired: true });
    assert.ok(!text.includes("correct horse") && !text.includes("placeholder"));
    delete process.env.LIVE_PASSCODE;
    assert.deepEqual(await (await status()).json(), { liveEnabled: true, passcodeRequired: false });
  } finally {
    for (const [name, v] of [["ANTHROPIC_API_KEY", saved.k], ["LIVE_PASSCODE", saved.p]]) {
      if (v === undefined) delete process.env[name]; else process.env[name] = v;
    }
  }
});

test("/api/analyze returns 401 passcode_required before parsing the body", async () => {
  const saved = { k: process.env.ANTHROPIC_API_KEY, p: process.env.LIVE_PASSCODE };
  try {
    process.env.ANTHROPIC_API_KEY = "<placeholder>";
    process.env.LIVE_PASSCODE = "correct horse battery";
    const { default: analyze } = await import("../netlify/functions/analyze.mjs");
    const res = await analyze(new Request("https://example.test/api/analyze", { method: "POST", headers: { [PASSCODE_HEADER]: "wrong" }, body: "not json" }), {});
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, "passcode_required");
    assert.ok(!JSON.stringify(body).includes("correct horse"));
    // Right passcode gets past the check (then fails body validation with 400, no API call).
    const ok = await analyze(new Request("https://example.test/api/analyze", { method: "POST", headers: { [PASSCODE_HEADER]: "correct horse battery" }, body: "not json" }), {});
    assert.equal(ok.status, 400);
  } finally {
    for (const [name, v] of [["ANTHROPIC_API_KEY", saved.k], ["LIVE_PASSCODE", saved.p]]) {
      if (v === undefined) delete process.env[name]; else process.env[name] = v;
    }
  }
});
