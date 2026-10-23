import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SYSTEM_PROMPT, OUTPUT_SCHEMA, buildUserMessage } from "../lib/prompt.mjs";
import { checkRateLimit } from "../lib/rateLimit.mjs";
import { checkPasscode } from "../lib/passcode.mjs";
import { finalizeFindings } from "../../src/lib/verify.js";

// Live analysis of one vendor's documents against the requirements.
// The API key is read from the ANTHROPIC_API_KEY environment variable set in
// Netlify; it never reaches the browser. The response is streamed as NDJSON so
// the connection stays open within Netlify's 60-second streaming limit.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = process.env.ANTHROPIC_EFFORT || "low";
const MAX_DOC_CHARS = 250_000;

const Segment = z.object({ locator: z.string().min(1).max(200), text: z.string().max(MAX_DOC_CHARS) });
const Body = z.object({
  requirements: z.array(z.object({ id: z.string().min(1).max(20), text: z.string().min(1).max(2000) })).min(1).max(40),
  vendor: z.object({
    name: z.string().min(1).max(120),
    documents: z
      .array(z.object({ name: z.string().min(1).max(200), segments: z.array(Segment).min(1).max(2000) }))
      .min(1)
      .max(10),
  }),
});

const ModelOutput = z.object({
  findings: z.array(
    z.object({
      requirement_id: z.string(),
      status: z.enum(["addressed", "partial", "conflicts", "not_documented"]),
      summary: z.string(),
      evidence: z.array(z.object({ file: z.string(), locator: z.string(), quote: z.string() })),
    }),
  ),
});

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return json(503, { error: "Live analysis is not configured on this site. Set ANTHROPIC_API_KEY in Netlify, or use demo mode." });
  }

  // Optional shared passcode (LIVE_PASSCODE). Checked before parsing or rate
  // limiting so wrong guesses don't consume the live quota.
  if (!checkPasscode(req)) {
    return json(401, { error: "Live mode needs the site passcode. Enter it and try again, or use demo mode.", code: "passcode_required" });
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json(400, { error: "Request was not in the expected format, or the documents exceed the size limits." });
  }
  const totalChars = body.vendor.documents.reduce((n, d) => n + d.segments.reduce((m, s) => m + s.text.length, 0), 0);
  if (totalChars > MAX_DOC_CHARS) {
    return json(413, { error: `${body.vendor.name}'s documents are too long for live analysis (${totalChars.toLocaleString()} characters; limit ${MAX_DOC_CHARS.toLocaleString()}).` });
  }

  const limit = await checkRateLimit(context?.ip);
  if (!limit.ok) return json(limit.status ?? 429, { error: limit.message });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      let chars = 0;
      const heartbeat = setInterval(() => send({ type: "progress", chars }), 3000);
      try {
        const client = new Anthropic({ timeout: 55_000, maxRetries: 0 });
        const messageStream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: EFFORT, format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserMessage(body.requirements, body.vendor) }],
        });
        messageStream.on("text", (delta) => {
          chars += delta.length;
        });
        const message = await messageStream.finalMessage();

        if (message.stop_reason === "refusal") {
          send({ type: "error", error: "The model declined to analyze these documents." });
        } else if (message.stop_reason === "max_tokens") {
          send({ type: "error", error: "The analysis was cut off before it finished. Try fewer requirements or shorter documents." });
        } else {
          const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
          const parsed = ModelOutput.parse(JSON.parse(text));
          const findings = finalizeFindings(body.requirements, parsed.findings, body.vendor.documents);
          send({ type: "result", findings, model: message.model });
        }
      } catch (err) {
        console.error("analyze failed", err);
        send({ type: "error", error: describeError(err) });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
};

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key configured on this site was rejected.";
  if (err instanceof Anthropic.RateLimitError) return "The Anthropic API is rate limiting this site. Wait a minute and try again.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "The analysis took too long. Try fewer requirements or shorter documents.";
  if (err instanceof Anthropic.APIError) return `The Anthropic API returned an error (${err.status ?? "network"}).`;
  if (err instanceof SyntaxError || err instanceof z.ZodError) return "The model's response could not be read. Please try again.";
  return "Live analysis failed unexpectedly.";
}

export const config = { path: "/api/analyze" };
