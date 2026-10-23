import { segmentText } from "../lib/segment.js";
import { extractRequirements } from "../lib/requirements.js";

// Builds the demo data set from raw sample text. Kept free of Vite-specific
// imports so tests can load the same files from disk.
export function buildSampleSet(texts) {
  const requirementsDoc = {
    id: "sample-requirements",
    name: "harbor-city-requirements.md",
    segments: segmentText(texts.requirements),
    sample: true,
  };
  const vendors = [
    { id: "turnstile-labs", name: "Turnstile Labs", file: "turnstile-labs-proposal.md", text: texts.turnstile },
    { id: "pulsegate", name: "PulseGate Ticketing", file: "pulsegate-proposal.md", text: texts.pulsegate },
    { id: "bleacher-box", name: "Bleacher Box", file: "bleacher-box-proposal.md", text: texts.bleacher },
  ].map((v) => ({
    id: v.id,
    name: v.name,
    sample: true,
    documents: [{ id: `${v.id}-doc`, name: v.file, segments: segmentText(v.text), sample: true }],
  }));
  return { requirementsDoc, requirements: extractRequirements(requirementsDoc), vendors };
}
