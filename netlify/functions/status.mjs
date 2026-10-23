import { passcodeRequired } from "../lib/passcode.mjs";

// Tells the browser whether live analysis is available and whether it needs the
// shared passcode. Booleans only: never the key or the passcode.
export default async () =>
  new Response(
    JSON.stringify({ liveEnabled: Boolean(process.env.ANTHROPIC_API_KEY), passcodeRequired: passcodeRequired() }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );

export const config = { path: "/api/status" };
