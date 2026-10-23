// M4 (R-3): atomic rate limiter using Blobs-style conditional writes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore, createRateLimiter, incrementIfBelow } from "../netlify/lib/rateLimit.mjs";

const fixedNow = () => new Date("2026-10-23T10:15:00Z");
const quiet = (fn) => async (...a) => {
  const orig = console.error;
  console.error = () => {};
  try { return await fn(...a); } finally { console.error = orig; }
};

test("per-IP hourly limit allows exactly N then returns 429", async () => {
  const check = createRateLimiter({ store: createMemoryStore(), perIpPerHour: 3, globalPerDay: 100, now: fixedNow, backoffMs: 0 });
  for (let i = 0; i < 3; i++) assert.deepEqual(await check("1.2.3.4"), { ok: true });
  const denied = await check("1.2.3.4");
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 429);
  assert.match(denied.message, /3 vendor analyses per hour/);
  assert.equal((await check("5.6.7.8")).ok, true, "other IPs are unaffected");
});

test("global daily limit applies across IPs", async () => {
  const check = createRateLimiter({ store: createMemoryStore(), perIpPerHour: 100, globalPerDay: 2, now: fixedNow, backoffMs: 0 });
  assert.equal((await check("a")).ok, true);
  assert.equal((await check("b")).ok, true);
  const denied = await check("c");
  assert.equal(denied.status, 429);
  assert.match(denied.message, /daily limit/);
});

test("new counter is created with onlyIfNew, existing one updated with onlyIfMatch", async () => {
  const base = createMemoryStore();
  const calls = [];
  const store = { getWithMetadata: base.getWithMetadata, setJSON: (k, v, o) => { calls.push(o); return base.setJSON(k, v, o); } };
  await incrementIfBelow(store, "k", 10, { backoffMs: 0 });
  await incrementIfBelow(store, "k", 10, { backoffMs: 0 });
  assert.deepEqual(calls[0], { onlyIfNew: true });
  assert.ok(typeof calls[1].onlyIfMatch === "string" && !("onlyIfNew" in calls[1]));
});

test("a conflicting write is retried and the count is not lost", async () => {
  const base = createMemoryStore();
  let injected = false;
  const store = {
    getWithMetadata: base.getWithMetadata,
    async setJSON(key, value, opts) {
      if (!injected) {
        // Another instance sneaks in a write between our read and our write.
        injected = true;
        await base.setJSON(key, { count: 1 }, {});
      }
      return base.setJSON(key, value, opts);
    },
  };
  const r = await incrementIfBelow(store, "k", 10, { backoffMs: 0 });
  assert.deepEqual(r, { allowed: true, count: 2 });
  assert.equal((await base.getWithMetadata("k")).data.count, 2);
});

test("concurrent requests never overshoot the limit", async () => {
  const base = createMemoryStore();
  // Yield between read and write so requests interleave like real network calls.
  const store = {
    async getWithMetadata(k) { const r = await base.getWithMetadata(k); await new Promise((res) => setImmediate(res)); return r; },
    setJSON: base.setJSON,
  };
  const check = createRateLimiter({ store, perIpPerHour: 5, globalPerDay: 1000, now: fixedNow, maxAttempts: 50, backoffMs: 0 });
  const results = await Promise.all(Array.from({ length: 12 }, () => check("same-ip")));
  assert.equal(results.filter((r) => r.ok).length, 5);
  assert.ok(results.filter((r) => !r.ok).every((r) => r.status === 429));
});

test("persistent conflicts fail closed with 503", quiet(async () => {
  const store = {
    async getWithMetadata() { return { data: { count: 1 }, etag: '"x"' }; },
    async setJSON() { return { modified: false }; },
  };
  const check = createRateLimiter({ store, perIpPerHour: 10, globalPerDay: 10, now: fixedNow, maxAttempts: 3, backoffMs: 0 });
  const r = await check("ip");
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
}));

test("Blobs read or write errors fail closed with 503", quiet(async () => {
  const failingRead = { async getWithMetadata() { throw new Error("blobs down"); }, async setJSON() { return { modified: true }; } };
  const failingWrite = { async getWithMetadata() { return null; }, async setJSON() { throw new Error("blobs down"); } };
  for (const store of [failingRead, failingWrite]) {
    const r = await createRateLimiter({ store, now: fixedNow, backoffMs: 0 })("ip");
    assert.deepEqual([r.ok, r.status], [false, 503]);
  }
}));

test("a counter at the limit is not written again", async () => {
  const base = createMemoryStore();
  await base.setJSON("k", { count: 2 }, {});
  let writes = 0;
  const store = { getWithMetadata: base.getWithMetadata, setJSON: (...a) => { writes++; return base.setJSON(...a); } };
  assert.deepEqual(await incrementIfBelow(store, "k", 2), { allowed: false, count: 2 });
  assert.equal(writes, 0);
});
