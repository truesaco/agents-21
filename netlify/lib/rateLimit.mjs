import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

// Fixed-window rate limit for live analysis, stored in Netlify Blobs so it holds
// across function instances. Each vendor analysis counts as one request.
//
// Writes are atomic (R-3): each counter is read with its ETag and written back
// with a conditional write (`onlyIfMatch` for an existing counter, `onlyIfNew`
// for a new one). If another request wrote in between, the write reports
// `modified: false` and we re-read and retry, a bounded number of times.
//
// Failure handling:
// - Blobs store cannot be opened at all (no Netlify Blobs environment, e.g. plain
//   `vite` / `node` local dev): fall back to per-instance memory.
// - Store opened but a read/write throws, or retries are exhausted: fail closed
//   (deny the request with 503) rather than allow unmetered spending.

const DEFAULT_PER_IP_PER_HOUR = intEnv("RATE_LIMIT_PER_HOUR", 12);
const DEFAULT_GLOBAL_PER_DAY = intEnv("RATE_LIMIT_GLOBAL_PER_DAY", 150);
const MAX_ATTEMPTS = 5;

function intEnv(name, fallback) {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function openStore() {
  try {
    return getStore({ name: "vendorlens-rate-limits", consistency: "strong" });
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RateLimitStoreError extends Error {}

// In-memory store with the same conditional-write contract as Netlify Blobs.
// Used for local dev without Blobs, and handy in tests.
export function createMemoryStore() {
  const data = new Map();
  let seq = 0;
  return {
    async getWithMetadata(key) {
      const e = data.get(key);
      return e ? { data: structuredClone(e.value), etag: e.etag, metadata: {} } : null;
    },
    async setJSON(key, value, opts = {}) {
      const cur = data.get(key);
      if (opts.onlyIfNew && cur) return { modified: false };
      if (opts.onlyIfMatch !== undefined && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
      const etag = `"m${++seq}"`;
      data.set(key, { value: structuredClone(value), etag });
      return { modified: true, etag };
    },
  };
}

const memoryStore = createMemoryStore();

// Atomically increments `key` unless it is already at `limit`.
// Returns { allowed, count }. Throws RateLimitStoreError on persistent conflict.
export async function incrementIfBelow(store, key, limit, { maxAttempts = MAX_ATTEMPTS, backoffMs = 15 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const entry = await store.getWithMetadata(key, { type: "json" });
    const raw = entry?.data?.count;
    const count = Number.isInteger(raw) && raw >= 0 ? raw : 0;
    if (count >= limit) return { allowed: false, count };

    const next = { count: count + 1 };
    let result;
    if (entry) {
      if (!entry.etag) throw new RateLimitStoreError("Counter has no ETag; cannot write conditionally.");
      result = await store.setJSON(key, next, { onlyIfMatch: entry.etag });
    } else {
      result = await store.setJSON(key, next, { onlyIfNew: true });
    }
    if (result?.modified) return { allowed: true, count: next.count };

    // Lost the race: someone else wrote first. Back off briefly with jitter, then re-read.
    if (attempt < maxAttempts && backoffMs > 0) await sleep(backoffMs * attempt + Math.random() * backoffMs);
  }
  throw new RateLimitStoreError(`Rate-limit counter ${key} kept conflicting after ${maxAttempts} attempts.`);
}

const UNAVAILABLE = {
  ok: false,
  status: 503,
  message: "Live analysis is temporarily unavailable because the usage limit could not be checked. Try again shortly, or use demo mode.",
};

export function createRateLimiter({
  store,
  perIpPerHour = DEFAULT_PER_IP_PER_HOUR,
  globalPerDay = DEFAULT_GLOBAL_PER_DAY,
  now = () => new Date(),
  maxAttempts = MAX_ATTEMPTS,
  backoffMs = 15,
} = {}) {
  return async function check(ip) {
    const iso = now().toISOString();
    const hour = iso.slice(0, 13);
    const day = iso.slice(0, 10);
    const ipHash = createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 16);
    const opts = { maxAttempts, backoffMs };

    try {
      const perIp = await incrementIfBelow(store, `ip-${ipHash}-${hour}`, perIpPerHour, opts);
      if (!perIp.allowed) {
        return { ok: false, status: 429, message: `Rate limit reached: ${perIpPerHour} vendor analyses per hour. Try again later, or use demo mode.` };
      }
      const global = await incrementIfBelow(store, `global-${day}`, globalPerDay, opts);
      if (!global.allowed) {
        return { ok: false, status: 429, message: "This site's daily limit for live analysis has been reached. Try again tomorrow, or use demo mode." };
      }
      return { ok: true };
    } catch (err) {
      console.error("rate limit check failed; denying request", err?.message ?? err);
      return UNAVAILABLE;
    }
  };
}

export async function checkRateLimit(ip) {
  const store = openStore() ?? memoryStore;
  return createRateLimiter({ store })(ip);
}
