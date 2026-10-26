import { useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE } from "./samples/index.js";
import demoResults from "./demo/demoResults.json";
import { finalizeFindings } from "./lib/verify.js";
import { fetchStatus, analyzeVendor } from "./lib/api.js";
import DocumentsStep from "./components/DocumentsStep.jsx";
import RequirementsStep from "./components/RequirementsStep.jsx";
import ComparisonStep from "./components/ComparisonStep.jsx";
import SourceViewer from "./components/SourceViewer.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import Hero from "./components/Hero.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";

const STEPS = ["Documents", "Requirements", "Comparison"];

const signature = (requirementsDoc, requirements, vendors) =>
  JSON.stringify({
    r: requirementsDoc?.id,
    q: requirements.map((r) => [r.id, r.text]),
    v: vendors.map((v) => [v.id, v.documents.map((d) => d.id)]),
  });

const SAMPLE_SIGNATURE = signature(SAMPLE.requirementsDoc, SAMPLE.requirements, SAMPLE.vendors);

export default function App() {
  const [step, setStep] = useState(0);
  const [requirementsDoc, setRequirementsDoc] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [results, setResults] = useState({});
  const [mode, setMode] = useState("demo");
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [viewing, setViewing] = useState(null);

  // Start each step at the top of the page (not on first load).
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    fetchStatus().then((s) => setLiveEnabled(Boolean(s.liveEnabled)));
  }, []);

  const demoAvailable = useMemo(
    () => signature(requirementsDoc, requirements, vendors) === SAMPLE_SIGNATURE,
    [requirementsDoc, requirements, vendors],
  );

  useEffect(() => {
    if (!demoAvailable && mode === "demo" && liveEnabled) setMode("live");
  }, [demoAvailable, mode, liveEnabled]);

  const loadSample = () => {
    setRequirementsDoc(SAMPLE.requirementsDoc);
    setRequirements(SAMPLE.requirements);
    setVendors(SAMPLE.vendors);
    setResults({});
    setMode("demo");
  };

  const reset = () => {
    setRequirementsDoc(null);
    setRequirements([]);
    setVendors([]);
    setResults({});
    setStep(0);
  };

  const runAnalysis = async () => {
    setStep(2);
    if (mode === "demo") {
      const next = {};
      for (const v of vendors) {
        next[v.id] = { state: "done", findings: finalizeFindings(requirements, demoResults[v.id], v.documents) };
      }
      setResults(next);
      return;
    }
    setResults(Object.fromEntries(vendors.map((v) => [v.id, { state: "loading", progress: 0 }])));
    await Promise.all(
      vendors.map(async (v) => {
        try {
          const findings = await analyzeVendor(requirements, v, (chars) =>
            setResults((r) => ({ ...r, [v.id]: { ...r[v.id], progress: chars } })),
          );
          setResults((r) => ({ ...r, [v.id]: { state: "done", findings } }));
        } catch (err) {
          setResults((r) => ({ ...r, [v.id]: { state: "error", error: err.message } }));
        }
      }),
    );
  };

  const docsReady = requirementsDoc && vendors.length > 0 && vendors.every((v) => v.documents.length > 0 && v.name.trim());
  const reqsReady = docsReady && requirements.length > 0 && requirements.every((r) => r.text.trim());
  const hasResults = Object.keys(results).length > 0;
  const canVisit = [true, docsReady, hasResults];

  const openSource = (vendorOrNull, file, locator, quote) => {
    const docs = vendorOrNull ? vendorOrNull.documents : [requirementsDoc];
    const doc = docs.find((d) => d.name === file);
    const segment = doc?.segments.find((s) => s.locator === locator);
    if (segment) setViewing({ file, locator, quote, text: segment.text });
  };

  // On Step 1 the hero headline is the page's h1, so the brand name drops to a
  // plain paragraph there; on the other steps the brand name stays the h1.
  const BrandName = step === 0 ? "p" : "h1";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <BrandName className="brand-name">VendorLens</BrandName>
            <p className="tagline">Evidence-backed vendor comparison. You make the call.</p>
          </div>
        </div>
        <nav className="stepper" aria-label="Steps">
          {STEPS.map((label, i) => (
            <button
              key={label}
              className={`step ${i === step ? "active" : ""}`}
              disabled={!canVisit[i]}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="step-num">{i + 1}</span> {label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <HowItWorks />
          <ThemeToggle />
        </div>
      </header>

      <main>
        {step === 0 && <Hero targetId="step-documents-title" />}
        {step === 0 && (
          <DocumentsStep
            requirementsDoc={requirementsDoc}
            setRequirementsDoc={(doc) => {
              setRequirementsDoc(doc);
              setRequirements([]);
              setResults({});
            }}
            vendors={vendors}
            setVendors={(v) => {
              setVendors(v);
              setResults({});
            }}
            loadSample={loadSample}
            reset={reset}
            onView={(doc, seg) => setViewing({ file: doc.name, locator: seg.locator, text: seg.text })}
            onNext={() => setStep(1)}
            ready={docsReady}
          />
        )}
        {step === 1 && (
          <RequirementsStep
            requirementsDoc={requirementsDoc}
            requirements={requirements}
            setRequirements={(r) => {
              setRequirements(r);
              setResults({});
            }}
            vendors={vendors}
            mode={mode}
            setMode={setMode}
            demoAvailable={demoAvailable}
            liveEnabled={liveEnabled}
            ready={reqsReady}
            onBack={() => setStep(0)}
            onRun={runAnalysis}
            onViewSource={(file, locator) => openSource(null, file, locator)}
          />
        )}
        {step === 2 && (
          <ComparisonStep
            requirements={requirements}
            vendors={vendors}
            results={results}
            mode={mode}
            onBack={() => setStep(1)}
            onViewEvidence={(vendor, e) => openSource(vendor, e.file, e.locator, e.quote)}
          />
        )}
      </main>

      <footer className="footer">
        VendorLens uses only the documents you provide: no web search, no browsing, no vendor contact. It never recommends a vendor.
      </footer>

      {viewing && <SourceViewer {...viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
