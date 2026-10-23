// Tells the browser whether live analysis is available, without exposing the key.
export default async () =>
  new Response(JSON.stringify({ liveEnabled: Boolean(process.env.ANTHROPIC_API_KEY) }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const config = { path: "/api/status" };
