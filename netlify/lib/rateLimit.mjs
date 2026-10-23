import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";

// Basic fixed-window rate limit for live analysis, stored in Netlify Blobs so it
// holds across function instances. Each vendor analysis counts as one request.
// Falls back to per-instance memory when Blobs is unavailable (e.g. plain local dev).

const PER_IP_PER_HOUR = intEnv("RATE_LIMIT_PER_HOUR", 12);
const GLOBAL_PER_DAY = intEnv("RATE_LIMIT_GLOBAL_PER_DAY", 150);

const memory = new Map();

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

async function bump(store, key) {
  if (store) {
    try {
      const current = (await store.get(key, { type: "json" })) ?? { count: 0 };
      const next = { count: current.count + 1 };
      await store.setJSON(key, next);
      return next.count;
    } catch {
      // Blobs not reachable: fall through to memory.
    }
  }
  const count = (memory.get(key) ?? 0) + 1;
  memory.set(key, count);
  return count;
}

export async function checkRateLimit(ip) {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const ipHash = createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 16);
  const store = openStore();

  const ipCount = await bump(store, `ip-${ipHash}-${hour}`);
  if (ipCount > PER_IP_PER_HOUR) {
    return { ok: false, message: `Rate limit reached: ${PER_IP_PER_HOUR} vendor analyses per hour. Try again later, or use demo mode.` };
  }
  const globalCount = await bump(store, `global-${day}`);
  if (globalCount > GLOBAL_PER_DAY) {
    return { ok: false, message: "This site's daily limit for live analysis has been reached. Try again tomorrow, or use demo mode." };
  }
  return { ok: true };
}
