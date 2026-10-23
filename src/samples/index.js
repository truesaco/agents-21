import requirementsText from "./harbor-city-requirements.md?raw";
import turnstileText from "./turnstile-labs-proposal.md?raw";
import pulsegateText from "./pulsegate-proposal.md?raw";
import bleacherText from "./bleacher-box-proposal.md?raw";
import { buildSampleSet } from "./sampleSet.js";

export const SAMPLE = buildSampleSet({
  requirements: requirementsText,
  turnstile: turnstileText,
  pulsegate: pulsegateText,
  bleacher: bleacherText,
});
