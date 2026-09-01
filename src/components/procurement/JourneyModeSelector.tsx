"use client";

import { useEffect, useState } from "react";
import { PROJECT_JOURNEY_MODES, type ProjectJourneyMode } from "@/lib/rfp-types";

const MODES: Array<{ id: ProjectJourneyMode; title: string; description: string }> = [
  { id: "quick_list", title: "List a project", description: "Create a short anonymous opportunity without writing an RFP first." },
  { id: "find_providers", title: "Find providers", description: "Describe the essentials and see aggregate market coverage before publication." },
  { id: "build_rfp", title: "Build an RFP", description: "Develop a governed short or detailed RFP from your requirement." },
  { id: "validate_rfp", title: "Check an existing RFP", description: "Paste or upload an existing draft to identify gaps and improve comparability." },
];

function modeFromLocation(): ProjectJourneyMode {
  const value = new URLSearchParams(window.location.search).get("journey");
  return PROJECT_JOURNEY_MODES.includes(value as ProjectJourneyMode) ? (value as ProjectJourneyMode) : "build_rfp";
}

export default function JourneyModeSelector() {
  const [selected, setSelected] = useState<ProjectJourneyMode>("build_rfp");
  useEffect(() => setSelected(modeFromLocation()), []);

  function choose(mode: ProjectJourneyMode) {
    setSelected(mode);
    const url = new URL(window.location.href);
    url.searchParams.set("journey", mode);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new CustomEvent("netify:journey-mode", { detail: { mode } }));
  }

  return (
    <section className="mx-auto max-w-[1180px] px-5 pb-5 pt-6" aria-labelledby="journey-mode-title">
      <p id="journey-mode-title" className="m-0 mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#66635e]">
        Choose how to start — every route creates the same private project
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((mode) => (
          <button key={mode.id} type="button" aria-pressed={selected === mode.id} onClick={() => choose(mode.id)}
            className={`rounded-md border p-4 text-left transition-colors ${selected === mode.id ? "border-[#b64b16] bg-[#fff5ed]" : "border-[#d8d3cc] bg-white hover:border-[#9d958b]"}`}>
            <strong className="block text-[15px] text-[#110f0d]">{mode.title}</strong>
            <span className="mt-1 block text-[12.5px] leading-5 text-[#66635e]">{mode.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
