"use client";

import { useEffect, useState } from "react";
import { PROJECT_JOURNEY_MODES, type ProjectJourneyMode } from "@/lib/rfp-types";
import { PROJECT_ENTRANCE_CONTRACT_VERSION } from "@/lib/project-entrance-contract";
import { MARKETPLACE_PUBLICATION_CONSENT_TEXT, MARKETPLACE_PUBLICATION_CONSENT_VERSION } from "@/lib/publication-policy";
import SignIn from "@/components/SignIn";

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
  const [scope, setScope] = useState("sase");
  const [sector, setSector] = useState("");
  const [sites, setSites] = useState("");
  const [regions, setRegions] = useState("uk_ireland");
  const [operatingModel, setOperatingModel] = useState("any");
  const [outcome, setOutcome] = useState("");
  const [timescale, setTimescale] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ project_reference: string; revision: number } | null>(null);
  const [preview, setPreview] = useState<{ considered_count: number; eligible_technology_count: number; eligible_managed_provider_count: number; meets_all_mandatory_count: number; unresolved_requirements: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => setSelected(modeFromLocation()));
    fetch("/sase/api/auth/session").then((response) => response.json()).then((session) => setSignedIn(Boolean(session.authenticated))).catch(() => {});
  }, []);

  function choose(mode: ProjectJourneyMode) {
    setSelected(mode);
    setCreated(null);
    setPreview(null);
    setPrepared(false);
    setConsentAccepted(false);
    const url = new URL(window.location.href);
    url.searchParams.set("journey", mode);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new CustomEvent("netify:journey-mode", { detail: { mode } }));
  }

  async function publishPreparedProject(project: { project_reference: string; revision: number }) {
    const token = sessionStorage.getItem(`netify_marketplace_project_${project.project_reference}`);
    const response = await fetch(`/sase/api/marketplace/projects/${encodeURIComponent(project.project_reference)}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ base_revision: project.revision, consent_version: MARKETPLACE_PUBLICATION_CONSENT_VERSION, consent_text: MARKETPLACE_PUBLICATION_CONSENT_TEXT, marketing_opt_in: false }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Publication did not complete.");
    setPublishedUrl(data.opportunity_url);
  }

  async function preparePublication() {
    if (!created || !consentAccepted) return;
    setCreating(true); setError(null);
    try {
      const token = sessionStorage.getItem(`netify_marketplace_project_${created.project_reference}`);
      const response = await fetch(`/sase/api/marketplace/projects/${encodeURIComponent(created.project_reference)}/prepare-publication`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ base_revision: created.revision, consent_version: MARKETPLACE_PUBLICATION_CONSENT_VERSION, consent_text: MARKETPLACE_PUBLICATION_CONSENT_TEXT, marketing_opt_in: false }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare publication.");
      const next = { ...created, revision: data.revision };
      setCreated(next); setPrepared(true);
      if (signedIn) await publishPreparedProject(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not prepare publication."); }
    finally { setCreating(false); }
  }

  async function loadAggregatePreview() {
    if (!created) return;
    setCreating(true);
    setError(null);
    try {
      const token = sessionStorage.getItem(`netify_marketplace_project_${created.project_reference}`);
      const response = await fetch(`/sase/api/marketplace/projects/${encodeURIComponent(created.project_reference)}/match-preview`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ base_revision: created.revision, input: { mandatory_capabilities: [], preferred_capabilities: [], required_regions: [regions.trim()], service_model: operatingModel === "managed" ? "fully_managed" : operatingModel === "any" ? null : operatingModel, sector: sector.trim(), provider_scope: "both" } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not calculate market coverage.");
      setCreated({ ...created, revision: data.revision });
      setPreview(data.preview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not calculate market coverage.");
    } finally {
      setCreating(false);
    }
  }

  async function createCanonicalProject() {
    if (!outcome.trim() || !sector || !sites || !regions.trim() || !timescale.trim()) {
      setError("Add the sector, estate, geography, outcome and timescale to create the private project.");
      return;
    }
    setCreating(true);
    setError(null);
    const capturedAt = Date.now();
    const rawInput = { solution_scope: scope, sector, site_count: Number(sites), regions: [regions.trim()], operating_model: operatingModel, outcome: outcome.trim(), timescale: timescale.trim() };
    try {
      const response = await fetch("/sase/api/marketplace/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: selected,
          entrance_context: {
            version: PROJECT_ENTRANCE_CONTRACT_VERSION,
            source: "rfp_builder",
            source_url: window.location.href,
            captured_at: capturedAt,
            requirement_text: outcome.trim(),
            sector,
            marketplace_slug: null,
            vendor_slugs: [],
            buyer_input: { sector, site_count: Number(sites), regions: [regions.trim()], operating_model: operatingModel, product_scope: scope === "sdwan" ? "sdwan_only" : scope === "sse" ? "sse_only" : "full_sase", notes: outcome.trim() },
            shortlist_input: null,
            raw_input: rawInput,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create the private project.");
      sessionStorage.setItem(`netify_marketplace_project_${data.project_reference}`, data.project_session_token);
      setCreated({ project_reference: data.project_reference, revision: data.revision });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the private project.");
    } finally {
      setCreating(false);
    }
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
      {(selected === "quick_list" || selected === "find_providers") && (
        <div className="mt-3 rounded-md border border-[#d8d3cc] bg-white p-4" aria-live="polite">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-[#4f4b46]">Solution scope<select value={scope} onChange={(e) => setScope(e.target.value)} className="mt-1 block w-full rounded border border-[#cfc8bf] p-2 font-normal"><option value="sase">SASE</option><option value="sdwan">SD-WAN</option><option value="sse">SSE</option></select></label>
            <label className="text-xs font-semibold text-[#4f4b46]">Sector<select value={sector} onChange={(e) => setSector(e.target.value)} className="mt-1 block w-full rounded border border-[#cfc8bf] p-2 font-normal"><option value="">Choose sector</option><option value="healthcare">Healthcare</option><option value="manufacturing">Manufacturing</option><option value="retail_ecommerce">Retail and e-commerce</option><option value="financial_services">Financial services</option></select></label>
            <label className="text-xs font-semibold text-[#4f4b46]">Sites<input type="number" min="1" value={sites} onChange={(e) => setSites(e.target.value)} className="mt-1 block w-full rounded border border-[#cfc8bf] p-2 font-normal" /></label>
            <label className="text-xs font-semibold text-[#4f4b46]">Geography<select value={regions} onChange={(e) => setRegions(e.target.value)} className="mt-1 block w-full rounded border border-[#cfc8bf] p-2 font-normal"><option value="uk_ireland">UK and Ireland</option><option value="europe">Europe</option><option value="north_america">North America</option><option value="asia_pacific">Asia Pacific</option><option value="middle_east_africa">Middle East and Africa</option><option value="latin_america">Latin America</option></select></label>
            <label className="text-xs font-semibold text-[#4f4b46]">Operating model<select value={operatingModel} onChange={(e) => setOperatingModel(e.target.value)} className="mt-1 block w-full rounded border border-[#cfc8bf] p-2 font-normal"><option value="any">No preference</option><option value="managed">Managed</option><option value="co_managed">Co-managed</option><option value="self_managed">Self-managed</option></select></label>
            <label className="text-xs font-semibold text-[#4f4b46]">Timescale<input value={timescale} onChange={(e) => setTimescale(e.target.value)} placeholder="e.g. within 6 months" className="mt-1 block w-full rounded border border-[#cfc8bf] p-2 font-normal" /></label>
          </div>
          <label className="mt-3 block text-xs font-semibold text-[#4f4b46]">Problem or desired outcome<textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} className="mt-1 block w-full rounded border border-[#cfc8bf] p-2 font-normal" /></label>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={creating || Boolean(created)} onClick={createCanonicalProject} className="rounded-full bg-[#b64b16] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{creating ? "Creating…" : created ? "Private project created" : selected === "quick_list" ? "Create opportunity draft" : "Create provider search"}</button>
            {created && <span className="text-xs text-emerald-800">Saved privately as {created.project_reference}. Nothing has been published and no supplier can see it.</span>}
            {error && <span className="text-xs text-red-700">{error}</span>}
          </div>
          {created && selected === "find_providers" && !preview && <button type="button" disabled={creating} onClick={loadAggregatePreview} className="mt-3 text-sm font-semibold text-[#8c360d] underline">Show aggregate provider coverage</button>}
          {preview && <div className="mt-3 rounded bg-[#f4f1ec] p-3 text-sm text-[#403c37]"><strong>{preview.meets_all_mandatory_count} providers currently meet the stated baseline</strong><span className="ml-2">({preview.eligible_technology_count} technology, {preview.eligible_managed_provider_count} managed; {preview.considered_count} reviewed). Provider identities stay locked until successful publication.</span>{preview.unresolved_requirements.length > 0 && <p className="mt-1 text-xs">Unresolved: {preview.unresolved_requirements.join(", ")}</p>}</div>}
          {created && selected === "quick_list" && !publishedUrl && <div className="mt-4 border-t border-[#e3ded7] pt-4"><label className="flex items-start gap-2 text-xs leading-5 text-[#4f4b46]"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} className="mt-1" /><span>{MARKETPLACE_PUBLICATION_CONSENT_TEXT}</span></label><button type="button" disabled={!consentAccepted || creating || prepared} onClick={preparePublication} className="mt-3 rounded-full bg-[#151311] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{prepared ? "Publication prepared" : "Publish anonymously"}</button></div>}
          {prepared && !signedIn && created && <div className="mt-4"><SignIn role="buyer" publishRfpId={created.project_reference} prompt="Verify your work email to complete anonymous publication. Your company and contact details never appear on the board." onAuthed={() => setSignedIn(true)} /></div>}
          {prepared && signedIn && !publishedUrl && <button type="button" onClick={() => created && publishPreparedProject(created).catch((reason) => setError(reason instanceof Error ? reason.message : "Publication failed."))} className="mt-3 text-sm font-semibold underline">Complete publication</button>}
          {publishedUrl && <p className="mt-4 text-sm font-semibold text-emerald-800">Publication completed and MarketUnlock verified. <a href={publishedUrl} className="underline">View the anonymous opportunity</a>.</p>}
        </div>
      )}
    </section>
  );
}
