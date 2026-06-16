"use client";

/**
 * The single guided front door. One place to describe a need and refine it with
 * quick-build chips, then choose an outcome. Whatever the buyer enters is carried
 * through to the chosen path (shortlist, auction, quote room or RFP) so they never
 * re-enter context. Modelled on the clarity of the original app's guided entry,
 * feeding the new multi-path engine.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const NEEDS = [
  { key: "underlay_circuits", label: "Underlay circuits" },
  { key: "sd_wan", label: "SD-WAN" },
  { key: "sse", label: "SSE" },
  { key: "sase", label: "Full SASE" },
];

const SECTORS = [
  ["healthcare", "Healthcare"], ["financial_services", "Financial services"], ["retail_ecommerce", "Retail and e-commerce"],
  ["manufacturing", "Manufacturing"], ["energy_utilities", "Energy and utilities"], ["government_public_sector", "Government and public sector"],
  ["education", "Education"], ["transport_logistics", "Transport and logistics"], ["professional_services", "Professional services"], ["hospitality_leisure", "Hospitality and leisure"],
];

const REGIONS = [["uk_ireland", "UK and Ireland"], ["europe", "Europe"], ["north_america", "North America"], ["apac", "APAC"], ["middle_east_africa", "Middle East and Africa"], ["latin_america", "Latin America"]];

const ORG_SIZES = [["large_global_enterprise", "Large global enterprise"], ["mid_market", "Mid-market"], ["small_business", "Small business"]];

const DELIVERY = [["managed", "Fully managed"], ["co_managed", "Co-managed"], ["diy", "DIY / self-managed"], ["any", "No preference"]];

const SDWAN_FEATURES = [
  ["f12_application_aware_routing", "Application steering"], ["f13_qos_and_traffic_shaping", "QoS"], ["f10_dynamic_path_selection", "Dynamic path selection"],
  ["f15_local_internet_breakout", "Local breakout"], ["f16_mpls_coexistence_and_migration", "MPLS migration"], ["f17_cellular_and_5g_support", "4G/5G failover"], ["f18_cloud_on_ramp", "Cloud on-ramp"],
];
const SASE_FEATURES = [
  ["f27_integrated_next_generation_firewall", "FWaaS / NGFW"], ["f30_zero_trust_network_access", "ZTNA"], ["f31_secure_web_gateway", "SWG"],
  ["f32_casb_capability", "CASB"], ["f33_data_loss_prevention", "DLP"], ["f28_full_sase_platform", "Full SASE platform"], ["f35_soc_siem_soar_integration", "SOC/SIEM/SOAR"],
];
const COMPLIANCE = [["uk_gdpr", "UK GDPR"], ["pci_dss", "PCI DSS"], ["iec_62443", "IEC 62443 (OT)"], ["iso_27001", "ISO 27001"], ["dora", "DORA"], ["nis2", "NIS2"], ["cyber_resilience_bill", "UK Cyber Resilience Bill"]];

const OUTCOMES = [
  { key: "shortlist", title: "Compare a shortlist", when: "Understand the market", body: "A ranked, graded shortlist of matching vendors. No sign-in." },
  { key: "auction", title: "Run a reverse auction", when: "Get competitive prices", body: "Verified vendors compete on price. Open-ended or timed." },
  { key: "quote_room", title: "Open a live quote room", when: "Fast indicative quotes", body: "Post and watch suppliers reply live with quotes." },
  { key: "rfp", title: "Build a formal RFP", when: "Run a rigorous procurement", body: "Methodology-backed questions, compliance and evaluation." },
];

type Sel = { needs: string[]; sector: string | null; regions: string[]; project: "new" | "migration" | null; orgSize: string | null; delivery: string; sdwan: string[]; sase: string[]; compliance: string[]; sites: string; budget: string; description: string };

const INITIAL: Sel = { needs: ["sase"], sector: null, regions: ["uk_ireland"], project: null, orgSize: null, delivery: "any", sdwan: [], sase: [], compliance: [], sites: "", budget: "", description: "" };

export default function GuidedStart() {
  const router = useRouter();
  const [s, setS] = useState<Sel>(INITIAL);
  const [parsing, setParsing] = useState(false);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState(false);

  // Read the free-text description and tick the matching chips, so the buyer
  // does not have to enter the same context twice. Best-effort: anything the
  // model cannot map is left for the buyer to set by hand.
  async function autofill() {
    if (!s.description.trim() || parsing) return;
    setParsing(true); setParseErr(null); setParsed(false);
    try {
      const r = await fetch("/api/guided/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description: s.description }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not auto-fill.");
      setS((prev) => ({ ...prev, ...(d.fields as Partial<Sel>) }));
      setParsed(true);
    } catch (e) {
      setParseErr(e instanceof Error ? e.message : "Could not auto-fill.");
    } finally {
      setParsing(false);
    }
  }

  // Remember the form across navigation, so opening an outcome and coming back
  // never loses what the user entered.
  useEffect(() => { try { const raw = sessionStorage.getItem("netify_guided_start"); if (raw) setS({ ...INITIAL, ...JSON.parse(raw) }); } catch { /* ignore */ } }, []);
  useEffect(() => { try { sessionStorage.setItem("netify_guided_start", JSON.stringify(s)); } catch { /* ignore */ } }, [s]);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const features = useMemo(() => [...s.sdwan, ...s.sase], [s.sdwan, s.sase]);

  // Build a readable summary from the chips, so the auction/quote summary is
  // populated from the main form even when no free-text description was typed.
  function summarise(): string {
    const parts: string[] = [];
    const needs = s.needs.map((n) => NEEDS.find((x) => x.key === n)?.label).filter(Boolean) as string[];
    if (needs.length) parts.push(needs.join(", "));
    if (s.sites) parts.push(`${s.sites} sites`);
    if (s.regions.length) parts.push(s.regions.map((r) => REGIONS.find(([k]) => k === r)?.[1]).filter(Boolean).join(", "));
    if (s.sector) { const l = SECTORS.find(([k]) => k === s.sector)?.[1]; if (l) parts.push(l); }
    if (s.delivery !== "any") { const l = DELIVERY.find(([k]) => k === s.delivery)?.[1]; if (l) parts.push(l); }
    if (s.compliance.length) parts.push(s.compliance.map((c) => COMPLIANCE.find(([k]) => k === c)?.[1]).filter(Boolean).join(", "));
    return parts.filter(Boolean).join(". ");
  }

  function productScope(): string {
    if (s.needs.includes("sase")) return "full_sase";
    if (s.needs.includes("sse")) return "sse_only";
    if (s.needs.includes("sd_wan") || s.needs.includes("underlay_circuits")) return "sdwan_only";
    return "full_sase";
  }

  function go(outcome: string) {
    const sites = s.sites ? Number(s.sites) : null;
    if (outcome === "shortlist") {
      const p = new URLSearchParams();
      if (s.sector) p.set("s", s.sector);
      if (s.orgSize) p.set("o", s.orgSize);
      if (s.regions.length) p.set("r", s.regions.join("."));
      if (features.length) p.set("p", features.map((f) => f.slice(0, 3)).join(".")); // shortFid = fid.slice(0,3), e.g. f12
      if (s.project === "migration") p.set("i", "mpls_migration");
      if (s.delivery !== "any") p.set("m", s.delivery);
      router.push(`/shortlist?${p.toString()}`);
      return;
    }
    if (outcome === "auction" || outcome === "quote_room") {
      const p = new URLSearchParams();
      p.set("prefill", "1");
      p.set("engagement", outcome === "auction" ? "auction" : "quote_room");
      if (s.needs.length) p.set("scope", s.needs.join("."));
      if (s.regions.length) p.set("regions", s.regions.join("."));
      if (sites != null) p.set("sites", String(sites));
      const summary = s.description.trim() || summarise();
      if (summary) p.set("summary", summary);
      if (s.budget) p.set("budget", s.budget);
      if (s.sector) p.set("sector", s.sector);
      router.push(`/opportunities?${p.toString()}`);
      return;
    }
    // rfp
    const p = new URLSearchParams();
    p.set("prefill", "1");
    if (s.sector) p.set("sector", s.sector);
    if (s.orgSize) p.set("org", s.orgSize);
    if (s.regions.length) p.set("regions", s.regions.join("."));
    if (s.compliance.length) p.set("compliance", s.compliance.join("."));
    if (sites != null) p.set("sites", String(sites));
    if (s.delivery !== "any") p.set("model", s.delivery);
    p.set("scope", productScope());
    if (s.description) p.set("notes", s.description);
    router.push(`/rfp-builder?${p.toString()}`);
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-full border transition-colors ${active ? "bg-amber-500 border-amber-500 text-zinc-950 font-medium" : "border-[var(--ink-300,#ccc)] text-[var(--ink-800)] hover:border-[var(--ink-900)]"}`;
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div><p className="eyebrow mb-2">{title}</p><div className="flex flex-wrap gap-2">{children}</div></div>
  );

  return (
    <div className="rounded-lg border border-[var(--ink-200,#e5e5e5)] p-6 md:p-8 bg-[var(--surface,#fff)]">
      <div className="mb-6">
        <p className="eyebrow mb-2">Step 1: describe your need</p>
        <textarea
          value={s.description}
          onChange={(e) => setS({ ...s, description: e.target.value })}
          rows={2}
          placeholder="e.g. SD-WAN and SASE for 40 UK retail sites, PCI DSS, moving off MPLS, fully managed."
          className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-3 text-sm"
        />
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <button
            onClick={autofill}
            disabled={parsing || !s.description.trim()}
            className="px-4 py-1.5 text-sm rounded-full border border-[var(--ink-900)] hover:bg-[var(--ink-900)] hover:text-white transition-colors disabled:opacity-50"
          >
            {parsing ? "Reading your description..." : "Auto-fill the options below"}
          </button>
          <span className="text-xs text-[var(--ink-500)]">Optional. We read your description and tick the matching options for you. You can change anything afterwards.</span>
        </div>
        {parsed && !parseErr && <p className="mt-2 text-xs text-emerald-700">Filled in what we could read. Check the options below and adjust anything.</p>}
        {parseErr && <p className="mt-2 text-xs text-red-700">{parseErr}</p>}
      </div>

      <div className="space-y-5">
        <Group title="What do you need?">
          {NEEDS.map((n) => <button key={n.key} onClick={() => setS({ ...s, needs: toggle(s.needs, n.key) })} className={chip(s.needs.includes(n.key))}>{n.label}</button>)}
        </Group>

        <div className="grid md:grid-cols-2 gap-5">
          <Group title="Sector">
            {SECTORS.map(([k, l]) => <button key={k} onClick={() => setS({ ...s, sector: s.sector === k ? null : k })} className={chip(s.sector === k)}>{l}</button>)}
          </Group>
          <Group title="Region">
            {REGIONS.map(([k, l]) => <button key={k} onClick={() => setS({ ...s, regions: toggle(s.regions, k) })} className={chip(s.regions.includes(k))}>{l}</button>)}
          </Group>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <Group title="Project type">
            {(["new", "migration"] as const).map((k) => <button key={k} onClick={() => setS({ ...s, project: s.project === k ? null : k })} className={chip(s.project === k)}>{k === "new" ? "New project" : "Migration"}</button>)}
          </Group>
          <Group title="Organisation">
            {ORG_SIZES.map(([k, l]) => <button key={k} onClick={() => setS({ ...s, orgSize: s.orgSize === k ? null : k })} className={chip(s.orgSize === k)}>{l}</button>)}
          </Group>
          <Group title="Delivery model">
            {DELIVERY.map(([k, l]) => <button key={k} onClick={() => setS({ ...s, delivery: k })} className={chip(s.delivery === k)}>{l}</button>)}
          </Group>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <Group title="SD-WAN features">
            {SDWAN_FEATURES.map(([k, l]) => <button key={k} onClick={() => setS({ ...s, sdwan: toggle(s.sdwan, k) })} className={chip(s.sdwan.includes(k))}>{l}</button>)}
          </Group>
          <Group title="SASE features">
            {SASE_FEATURES.map(([k, l]) => <button key={k} onClick={() => setS({ ...s, sase: toggle(s.sase, k) })} className={chip(s.sase.includes(k))}>{l}</button>)}
          </Group>
        </div>

        <Group title="Compliance (optional)">
          {COMPLIANCE.map(([k, l]) => <button key={k} onClick={() => setS({ ...s, compliance: toggle(s.compliance, k) })} className={chip(s.compliance.includes(k))}>{l}</button>)}
        </Group>

        <div className="grid sm:grid-cols-2 gap-3">
          <input value={s.sites} onChange={(e) => setS({ ...s, sites: e.target.value.replace(/[^0-9]/g, "") })} placeholder="Number of sites (optional)" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
          <input value={s.budget} onChange={(e) => setS({ ...s, budget: e.target.value })} placeholder="Budget note (optional)" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
        </div>
      </div>

      <div className="mt-8">
        <p className="eyebrow mb-3">Step 2: choose what to do with it</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOMES.map((o) => (
            <button key={o.key} onClick={() => go(o.key)} className="text-left rounded-sm border border-[var(--ink-300,#ccc)] p-4 hover:border-amber-500 hover:bg-amber-50 transition-colors">
              <span className="block text-sm font-semibold mb-0.5">{o.title}</span>
              <span className="block text-xs text-amber-700 mb-1.5">{o.when}</span>
              <span className="block text-xs text-[var(--ink-600)]">{o.body}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--ink-500)] mt-3">Everything you entered above is carried through to whichever path you pick. You can change it there too.</p>
      </div>
    </div>
  );
}
