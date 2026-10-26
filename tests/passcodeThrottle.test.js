// M4 pass 2 (R-4 follow-up): per-IP throttling of wrong live-mode passcodes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore, createPasscodeGuard } from "../netlify/lib/rateLimit.mjs";
import { PASSCODE_HEADER } from "../netlify/lib/passcode.mjs";

test("guard locks an IP after N failures, per IP and per hour", async () => {
  let t = new Date("2026-10-26T10:15:00Z");
  const guard = createPasscodeGuard({ store: createMemoryStore(), failuresPerHour: 3, now: () => t, backoffMs: 0 });
  for (let i = 0; i < 3; i++) {
    assert.equal(await guard.isLocked("1.1.1.1"), false);
    await guard.recordFailure("1.1.1.1");
  }
  assert.equal(await guard.isLocked("1.1.1.1"), true);
  assert.equal(await guard.isLocked("2.2.2.2"), false, "other IPs are unaffected");
  t = new Date("2026-10-26T11:00:00Z");
  assert.equal(await guard.isLocked("1.1.1.1"), false, "lock clears in the next hour window");
});

test("concurrent failures never push the stored count past the limit", async () => {
  const store = createMemoryStore();
  const guard = createPasscodeGuard({ store, failuresPerHour: 5, backoffMs: 0, maxAttempts: 50 });
  await Promise.all(Array.from({ length: 20 }, () => guard.recordFailure("9.9.9.9")));
  assert.equal(await guard.isLocked("9.9.9.9"), true);
});

test("recordFailure swallows store errors; isLocked surfaces them", async () => {
  const broken = { getWithMetadata: async () => { throw new Error("down"); }, setJSON: async () => { throw new Error("down"); } };
  const guard = createPasscodeGuard({ store: broken, failuresPerHour: 3, backoffMs: 0 });
  await guard.recordFailure("1.1.1.1");
  await assert.rejects(guard.isLocked("1.1.1.1"));
});

test("/api/analyze: wrong guesses get 401, then 429 passcode_locked even with the right passcode", async () => {
  const saved = { k: process.env.ANTHROPIC_API_KEY, p: process.env.LIVE_PASSCODE, f: process.env.PASSCODE_FAILS_PER_HOUR };
  try {
    process.env.ANTHROPIC_API_KEY = "<placeholder>";
    process.env.LIVE_PASSCODE = "correct horse battery";
    const { default: analyze } = await import("../netlify/functions/analyze.mjs");
    const call = (pc, ip) =>
      analyze(new Request("https://example.test/api/analyze", { method: "POST", headers: { [PASSCODE_HEADER]: pc }, body: "not json" }), { ip });
    const ip = "203.0.113.77";
    // Default limit is 10 failures per IP per hour.
    for (let i = 0; i < 10; i++) assert.equal((await call("wrong" + i, ip)).status, 401);
    const locked = await call("wrong-again", ip);
    assert.equal(locked.status, 429);
    const body = await locked.json();
    assert.equal(body.code, "passcode_locked");
    assert.ok(!JSON.stringify(body).includes("correct horse"));
    assert.equal((await call("correct horse battery", ip)).status, 429, "right passcode does not reveal itself while locked");
    // A different IP is unaffected and the right passcode still gets past the gate (400 = body check, no API call).
    assert.equal((await call("correct horse battery", "203.0.113.78")).status, 400);
  } finally {
    for (const [name, v] of [["ANTHROPIC_API_KEY", saved.k], ["LIVE_PASSCODE", saved.p], ["PASSCODE_FAILS_PER_HOUR", saved.f]]) {
      if (v === undefined) delete process.env[name]; else process.env[name] = v;
    }
  }
});
