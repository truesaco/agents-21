import { createHash, timingSafeEqual } from "node:crypto";

// Optional shared passcode for live mode (R-4).
// When LIVE_PASSCODE is set (scoped to Functions in Netlify), /api/analyze
// requires the request header below to match it. When unset or blank, live
// mode behaves exactly as before. The value is never returned to the browser.

export const PASSCODE_HEADER = "x-vendorlens-passcode";
const MAX_LEN = 256;

const sha256 = (s) => createHash("sha256").update(s, "utf8").digest();

export function configuredPasscode(env = process.env) {
  const v = (env.LIVE_PASSCODE ?? "").trim();
  return v.length > 0 ? v : null;
}

export function passcodeRequired(env = process.env) {
  return configuredPasscode(env) !== null;
}

// Constant-time check: both sides are hashed to fixed-length digests first, so
// timingSafeEqual never sees different lengths and length isn't leaked.
export function passcodeMatches(supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string") return false;
  if (supplied.length === 0 || supplied.length > MAX_LEN) return false;
  return timingSafeEqual(sha256(supplied), sha256(expected));
}

// Returns true when the request may proceed.
export function checkPasscode(req, env = process.env) {
  const expected = configuredPasscode(env);
  if (expected === null) return true;
  const supplied = req.headers.get(PASSCODE_HEADER) ?? "";
  return passcodeMatches(supplied, expected);
}
