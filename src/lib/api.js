// Browser side of live analysis: one streamed request per vendor.

export async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) return { liveEnabled: false };
    return await res.json();
  } catch {
    return { liveEnabled: false };
  }
}

export async function analyzeVendor(requirements, vendor, onProgress) {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requirements: requirements.map((r) => ({ id: r.id, text: r.text })),
      vendor: {
        name: vendor.name,
        documents: vendor.documents.map((d) => ({ name: d.name, segments: d.segments })),
      },
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.type === "progress") onProgress?.(msg.chars);
      else if (msg.type === "result") return msg.findings;
      else if (msg.type === "error") throw new Error(msg.error);
    }
    if (done) break;
  }
  throw new Error("The analysis ended without a result (it may have hit the 60-second limit). Try fewer requirements or shorter documents.");
}
