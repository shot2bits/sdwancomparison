"use client";

import { useEffect, useState } from "react";

type Memory = {
  email: string; organisation: string;
  preferred_vendor_slugs: string[]; avoided_vendor_slugs: string[];
  compliance_baseline: string[]; regions: string[];
  organisation_size: string; operating_model: string;
  risk_tolerance: string; budget_notes: string; notes: string[];
  past_outcomes: { rfp_id: string; title: string; outcome: string; awarded_vendor_slug: string | null }[];
  updated: number;
};

const SIZES: [string, string][] = [["any", "No preference"], ["large_global_enterprise", "Large global enterprise"], ["mid_market", "Mid-market"], ["small_business", "Small business"]];
const MODELS: [string, string][] = [["any", "No preference"], ["managed", "Fully managed"], ["co_managed", "Co-managed"], ["diy", "DIY / self-managed"]];
const RISKS: [string, string][] = [["unknown", "Unknown"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]];
const field = "w-full rounded border border-[var(--ink-300,#ccc)] p-2 text-sm";

export default function BuyerMemoryPanel() {
  const [mem, setMem] = useState<Memory | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/sase/api/buyer/memory");
        if (res.status === 401) { setNeedsAuth(true); return; }
        const data = await res.json();
        if (data.memory) setMem(data.memory);
      } finally { setLoading(false); }
    })();
  }, []);

  function set<K extends keyof Memory>(k: K, v: Memory[K]) {
    setMem((m) => (m ? { ...m, [k]: v } : m));
    setSaved(false);
  }
  const arr = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  async function save() {
    if (!mem) return;
    setSaving(true);
    try {
      const res = await fetch("/sase/api/buyer/memory", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organisation: mem.organisation, organisation_size: mem.organisation_size,
          operating_model: mem.operating_model, risk_tolerance: mem.risk_tolerance,
          budget_notes: mem.budget_notes, preferred_vendor_slugs: mem.preferred_vendor_slugs,
          avoided_vendor_slugs: mem.avoided_vendor_slugs, compliance_baseline: mem.compliance_baseline,
          regions: mem.regions, notes: mem.notes,
        }),
      });
      const data = await res.json();
      if (data.memory) { setMem(data.memory); setSaved(true); }
    } finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-[var(--ink-500)]">Loading…</p>;
  if (needsAuth) return (
    <div className="rounded-md border border-[var(--ink-200,#e5e5e5)] p-5">
      <p className="text-sm">Sign in with your work email to see and edit what the agent remembers about you. Memory is private to you and never shared across buyers. Use the sign-in box at the top of this page.</p>
    </div>
  );
  if (!mem) return <p className="text-sm text-[var(--ink-500)]">No memory available.</p>;

  return (
    <div className="rounded-md border border-[var(--ink-200,#e5e5e5)] p-5 space-y-4">
      <p className="text-sm text-[var(--ink-600)]">This is exactly what the agent remembers about you across all your RFPs. Edit anything; your changes overwrite what the agent learned.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">Organisation<input className={field} value={mem.organisation} onChange={(e) => set("organisation", e.target.value)} /></label>
        <label className="text-sm">Organisation size
          <select className={field} value={mem.organisation_size} onChange={(e) => set("organisation_size", e.target.value)}>{SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="text-sm">Operating model
          <select className={field} value={mem.operating_model} onChange={(e) => set("operating_model", e.target.value)}>{MODELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="text-sm">Risk tolerance
          <select className={field} value={mem.risk_tolerance} onChange={(e) => set("risk_tolerance", e.target.value)}>{RISKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      </div>

      <label className="block text-sm">Regions (comma-separated)<input className={field} value={mem.regions.join(", ")} onChange={(e) => set("regions", arr(e.target.value))} /></label>
      <label className="block text-sm">Compliance always in scope<input className={field} value={mem.compliance_baseline.join(", ")} onChange={(e) => set("compliance_baseline", arr(e.target.value))} placeholder="e.g. UK GDPR, PCI DSS, DORA" /></label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">Preferred vendors<input className={field} value={mem.preferred_vendor_slugs.join(", ")} onChange={(e) => set("preferred_vendor_slugs", arr(e.target.value))} placeholder="e.g. Cato Networks, Zscaler" /></label>
        <label className="text-sm">Avoid vendors<input className={field} value={mem.avoided_vendor_slugs.join(", ")} onChange={(e) => set("avoided_vendor_slugs", arr(e.target.value))} placeholder="e.g. incumbent to replace" /></label>
      </div>
      <label className="block text-sm">Budget notes<input className={field} value={mem.budget_notes} onChange={(e) => set("budget_notes", e.target.value)} placeholder="Cost-sensitive; expect 15-20% saving on current spend." /></label>
      <label className="block text-sm">Durable notes (comma-separated)<input className={field} value={mem.notes.join(", ")} onChange={(e) => set("notes", arr(e.target.value))} placeholder="UK-sovereign data residency required" /></label>

      {mem.past_outcomes.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-1">Past RFPs the agent remembers</p>
          <ul className="text-sm text-[var(--ink-700)] space-y-1">
            {mem.past_outcomes.map((o) => <li key={o.rfp_id}>• {o.title || o.rfp_id} — {o.outcome}{o.awarded_vendor_slug ? `, awarded ${o.awarded_vendor_slug}` : ""}</li>)}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60">{saving ? "Saving…" : "Save my memory"}</button>
        {saved && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
    </div>
  );
}
