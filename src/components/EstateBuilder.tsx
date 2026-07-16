"use client";

import { useEffect, useRef, useState } from "react";
import { SASE_ELEMENTS, SASE_ELEMENT_LABELS, CIRCUIT_TYPES } from "@/lib/estate-types";
import { fireNetifyEvent } from "@/components/NetifyEvents";

/**
 * Pricing portal client (feat/pricing-portal). Compare-the-market shaped:
 * build the estate, see indicative bands instantly, submit, then watch the
 * pending-bids room fill. Open in the clear; the manage key stays in
 * localStorage exactly like RFP drafts.
 */

type VendorLite = { slug: string; name: string; category: string };
type Circuit = { type: string; bandwidth_mbps: number };
type Site = {
  id?: string; name: string; site_type: string;
  address: { line1: string; line2: string; city: string; region: string; postal_code: string; country: string };
  contact_name: string; contact_phone: string; users: number;
  primary_circuit: Circuit; failover_circuit: Circuit;
};
type Bid = { vendor_slug: string; vendor_name: string; status: "pending" | "received" | "declined"; value: number | null; currency: string; unit: string; term_months: number; note: string; reason: string; at: number };
type Estate = { id: string; status: string; manage_token: string; service_model: string; sase_elements: string[]; vendor_slugs: string[]; sites: Site[]; bids: Bid[]; submitted_at: number | null };
type Band = { vendor_slug: string; vendor_name: string; category: string; unit: string; low: number; high: number; currency: string; basis: string };

const COUNTRIES = ["United Kingdom", "Ireland", "United States", "Canada", "Netherlands", "Germany", "France", "Spain", "Italy", "Poland", "Sweden", "Switzerland", "United Arab Emirates", "Singapore", "Hong Kong", "Australia", "New Zealand", "India", "Japan", "South Africa", "Brazil", "Mexico", "Other"];
const CIRCUIT_LABELS: Record<string, string> = { fttp: "FTTP / fibre", ethernet: "Ethernet leased line", broadband: "Business broadband", wireless_5g: "4G / 5G wireless", satellite: "Satellite", none: "None" };

function blankSite(n: number): Site {
  return {
    name: n === 1 ? "Head office" : `Site ${n}`,
    site_type: n === 1 ? "hq" : "branch",
    address: { line1: "", line2: "", city: "", region: "", postal_code: "", country: "United Kingdom" },
    contact_name: "", contact_phone: "", users: 0,
    primary_circuit: { type: "ethernet", bandwidth_mbps: 100 },
    failover_circuit: { type: "none", bandwidth_mbps: 0 },
  };
}

const unitLabel = (u: string) => u === "per_site_month" ? "per site / month" : u === "total_month" ? "total / month" : "per user / month";

export default function EstateBuilder({ vendors }: { vendors: VendorLite[] }) {
  const [stage, setStage] = useState<"build" | "estimate" | "room">("build");
  const [sites, setSites] = useState<Site[]>([blankSite(1)]);
  const [model, setModel] = useState("managed");
  const [elements, setElements] = useState<string[]>(["sdwan", "ztna", "swg"]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [estate, setEstate] = useState<Estate | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [alertEmail, setAlertEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const created = useRef(false);

  useEffect(() => {
    if (!estate || estate.status !== "submitted") return;
    const t = window.setInterval(async () => {
      try {
        const r = await fetch(`/sase/api/estate/${estate.id}?manage=${encodeURIComponent(estate.manage_token)}`);
        if (r.ok) { const d = await r.json(); if (d.estate) setEstate(d.estate as Estate); }
      } catch { /* keep polling */ }
    }, 8000);
    return () => window.clearInterval(t);
    /* eslint-disable-next-line */
  }, [estate?.id, estate?.status]);

  function setSite(i: number, patch: Partial<Site>) {
    setSites((s) => s.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  }
  function setAddr(i: number, k: keyof Site["address"], v: string) {
    setSites((s) => s.map((x, idx) => idx === i ? { ...x, address: { ...x.address, [k]: v } } : x));
  }
  function toggle(list: string[], set: (v: string[]) => void, key: string, max = 12) {
    set(list.includes(key) ? list.filter((k) => k !== key) : list.length < max ? [...list, key] : list);
  }

  async function seeEstimate() {
    setBusy(true); setError(null);
    try {
      const payload = { sites, service_model: model, sase_elements: elements, vendor_slugs: chosen };
      let r: Response;
      if (!created.current || !estate) {
        r = await fetch("/sase/api/estate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        r = await fetch(`/sase/api/estate/${estate.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, manage_token: estate.manage_token }) });
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not build your estimate.");
      created.current = true;
      setEstate(d.estate as Estate);
      setBands((d.indicative ?? []) as Band[]);
      try { localStorage.setItem(`netify_estate_${d.estate.id}`, d.estate.manage_token); } catch { /* private mode */ }
      fireNetifyEvent("estate_estimate", { sites: String(sites.length) });
      setStage("estimate");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not build your estimate."); }
    finally { setBusy(false); }
  }

  async function submitForBids() {
    if (!estate) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/sase/api/estate/${estate.id}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ manage_token: estate.manage_token, contact_email: alertEmail.trim().includes("@") ? alertEmail.trim() : undefined }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not submit for bids.");
      setEstate(d.estate as Estate);
      fireNetifyEvent("estate_submitted", { bids: String(d.bids_seeded ?? 0) });
      setStage("room");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit for bids."); }
    finally { setBusy(false); }
  }

  function copyRoomLink() {
    if (!estate) return;
    navigator.clipboard.writeText(`${window.location.origin}/sase/pricing/?estate=${estate.id}&manage=${estate.manage_token}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const input = "border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm w-full";
  const chip = "px-3 py-1.5 rounded-full border text-sm transition-colors";
  const chipOn = "border-amber-500 bg-amber-50";
  const chipOff = "border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)]";
  const amber = "inline-flex items-center rounded-full bg-amber-500 px-6 py-2.5 font-medium text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50";

  const received = estate?.bids.filter((b) => b.status === "received").length ?? 0;
  const pending = estate?.bids.filter((b) => b.status === "pending").length ?? 0;

  return (
    <div className="border border-[var(--ink-300,#ccc)] rounded-sm">
      <div className="flex gap-1 border-b border-[var(--ink-200,#e5e5e5)] p-3 text-sm flex-wrap">
        {["1. Your sites", "2. Your instant estimate", "3. Live pricing room"].map((t, i) => {
          const active = (stage === "build" && i === 0) || (stage === "estimate" && i === 1) || (stage === "room" && i === 2);
          return <span key={t} className={`px-3 py-1.5 rounded-full ${active ? "bg-zinc-900 text-white" : "text-[var(--ink-500)]"}`}>{t}</span>;
        })}
      </div>

      {stage === "build" && (
        <div className="p-5">
          {sites.map((s, i) => (
            <div key={i} className="border border-[var(--ink-200,#e5e5e5)] rounded-sm p-4 mb-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="text-xs text-[var(--ink-500)]">Site name</label><input className={input} value={s.name} onChange={(e) => setSite(i, { name: e.target.value })} /></div>
                <div><label className="text-xs text-[var(--ink-500)]">Site type</label>
                  <select className={input} value={s.site_type} onChange={(e) => setSite(i, { site_type: e.target.value })}>
                    <option value="hq">Head office</option><option value="branch">Branch</option><option value="data_centre">Data centre</option><option value="warehouse">Warehouse</option><option value="retail">Retail store</option><option value="other">Other</option>
                  </select></div>
                <div><label className="text-xs text-[var(--ink-500)]">Users at this site</label><input type="number" min={0} className={input} value={s.users} onChange={(e) => setSite(i, { users: Math.max(0, Number(e.target.value) || 0) })} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div><label className="text-xs text-[var(--ink-500)]">Address line 1</label><input className={input} value={s.address.line1} onChange={(e) => setAddr(i, "line1", e.target.value)} placeholder="Street address, building" /></div>
                <div><label className="text-xs text-[var(--ink-500)]">Address line 2</label><input className={input} value={s.address.line2} onChange={(e) => setAddr(i, "line2", e.target.value)} placeholder="Unit, floor (optional)" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4 mt-3">
                <div><label className="text-xs text-[var(--ink-500)]">City</label><input className={input} value={s.address.city} onChange={(e) => setAddr(i, "city", e.target.value)} /></div>
                <div><label className="text-xs text-[var(--ink-500)]">Region / state / province</label><input className={input} value={s.address.region} onChange={(e) => setAddr(i, "region", e.target.value)} /></div>
                <div><label className="text-xs text-[var(--ink-500)]">Postal / ZIP code</label><input className={input} value={s.address.postal_code} onChange={(e) => setAddr(i, "postal_code", e.target.value)} /></div>
                <div><label className="text-xs text-[var(--ink-500)]">Country</label>
                  <select className={input} value={s.address.country} onChange={(e) => setAddr(i, "country", e.target.value)}>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div><label className="text-xs text-[var(--ink-500)]">Local site contact</label><input className={input} value={s.contact_name} onChange={(e) => setSite(i, { contact_name: e.target.value })} placeholder="Name (kept private)" /></div>
                <div><label className="text-xs text-[var(--ink-500)]">Local contact number</label><input className={input} value={s.contact_phone} onChange={(e) => setSite(i, { contact_phone: e.target.value })} placeholder="Including country code (kept private)" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                <div>
                  <label className="text-xs text-[var(--ink-500)]">Primary circuit</label>
                  <div className="flex gap-2">
                    <select className={input} value={s.primary_circuit.type} onChange={(e) => setSite(i, { primary_circuit: { ...s.primary_circuit, type: e.target.value } })}>
                      {CIRCUIT_TYPES.filter((c) => c !== "none").map((c) => <option key={c} value={c}>{CIRCUIT_LABELS[c]}</option>)}
                    </select>
                    <input type="number" min={0} className={input} value={s.primary_circuit.bandwidth_mbps} onChange={(e) => setSite(i, { primary_circuit: { ...s.primary_circuit, bandwidth_mbps: Math.max(0, Number(e.target.value) || 0) } })} title="Mbps" />
                  </div>
                  <p className="text-[11px] text-[var(--ink-400)] mt-0.5">Bandwidth in Mbps</p>
                </div>
                <div>
                  <label className="text-xs text-[var(--ink-500)]">Failover circuit</label>
                  <div className="flex gap-2">
                    <select className={input} value={s.failover_circuit.type} onChange={(e) => setSite(i, { failover_circuit: { ...s.failover_circuit, type: e.target.value } })}>
                      {CIRCUIT_TYPES.map((c) => <option key={c} value={c}>{CIRCUIT_LABELS[c]}</option>)}
                    </select>
                    <input type="number" min={0} className={input} value={s.failover_circuit.bandwidth_mbps} onChange={(e) => setSite(i, { failover_circuit: { ...s.failover_circuit, bandwidth_mbps: Math.max(0, Number(e.target.value) || 0) } })} title="Mbps" />
                  </div>
                  <p className="text-[11px] text-[var(--ink-400)] mt-0.5">Choose None if a single circuit is fine</p>
                </div>
              </div>
              {sites.length > 1 && (
                <button className="text-xs text-red-700 underline mt-3" onClick={() => setSites((x) => x.filter((_, idx) => idx !== i))}>Remove this site</button>
              )}
            </div>
          ))}
          <button className="text-sm font-medium text-amber-700" onClick={() => setSites((s) => [...s, blankSite(s.length + 1)])}>+ Add another site</button>

          <div className="mt-6">
            <p className="text-sm font-medium mb-2">Service model</p>
            <div className="flex gap-2 flex-wrap">
              {[["managed", "Fully managed"], ["co_managed", "Co-managed"], ["diy", "Self-managed"]].map(([k, l]) => (
                <button key={k} onClick={() => setModel(k)} className={`${chip} ${model === k ? chipOn : chipOff}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">SASE elements in scope</p>
            <div className="flex gap-2 flex-wrap">
              {SASE_ELEMENTS.map((k) => (
                <button key={k} onClick={() => toggle(elements, setElements, k)} className={`${chip} ${elements.includes(k) ? chipOn : chipOff}`}>{SASE_ELEMENT_LABELS[k]}</button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium mb-1">Providers you want to hear from <span className="font-normal text-[var(--ink-500)]">(optional, up to 12; leave empty and Netify matches for you)</span></p>
            <div className="flex gap-2 flex-wrap max-h-40 overflow-y-auto border border-[var(--ink-200,#e5e5e5)] rounded-sm p-2">
              {vendors.map((v) => (
                <button key={v.slug} onClick={() => toggle(chosen, setChosen, v.slug)} className={`${chip} ${chosen.includes(v.slug) ? chipOn : chipOff}`}>{v.name}</button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4 flex-wrap">
            <button onClick={seeEstimate} disabled={busy || sites.length === 0} className={amber}>{busy ? "Working…" : "See my indicative pricing →"}</button>
            <span className="text-xs text-[var(--ink-500)]">No sign-in to see your estimate. Contacts stay private; the public view of an estate shows shape and bid statuses only.</span>
          </div>
          {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
        </div>
      )}

      {stage === "estimate" && estate && (
        <div className="p-5">
          <div className="rounded-sm bg-zinc-900 text-white px-4 py-3 text-sm flex items-center gap-3 flex-wrap">
            <b>Your estate:</b> {estate.sites.length} site{estate.sites.length === 1 ? "" : "s"} · {estate.sites.reduce((n, s) => n + (s.users || 0), 0)} users · {estate.service_model.replace("_", "-")}
            <button className="ml-auto text-amber-300 font-medium" onClick={() => setStage("build")}>Edit sites</button>
          </div>
          <div className="mt-4 space-y-3">
            {bands.map((b) => (
              <div key={b.vendor_slug} className="border border-[var(--ink-200,#e5e5e5)] rounded-sm p-4 grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] items-center">
                <div>
                  <p className="font-medium">{b.vendor_name}</p>
                  <p className="text-xs text-[var(--ink-500)]">{b.category}</p>
                </div>
                <div>
                  <p className="text-xl font-semibold">£{b.low}–£{b.high}<span className="text-xs font-normal text-[var(--ink-500)]"> {unitLabel(b.unit)}</span></p>
                  <p className="text-[11px] text-amber-700 font-medium">ILLUSTRATIVE · {b.basis}</p>
                </div>
                <span className="text-xs text-[var(--ink-500)]">Firm pricing on submission</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-sm border border-dashed border-[var(--ink-300,#ccc)] p-4 text-xs text-[var(--ink-600)]">
            Where these numbers come from: the Netify cost model v0 produces ranges from each provider&apos;s public value tier and your estate shape. They are bands, not quotes, and ordering is by Netify evidence, never by fees. Firm pricing comes only from the providers and stays private to you.
          </div>

          <div className="mt-5 rounded-sm bg-zinc-900 text-white p-5">
            <p className="text-lg font-semibold mb-2">Now let the providers do the hard work</p>
            <ol className="text-sm space-y-1.5 mb-4 opacity-95">
              <li>1. Submit once. Each provider prices your estate directly in this portal, against your actual sites.</li>
              <li>2. We tell you the moment every price lands. No chasing, no inbox tennis, no sales calls.</li>
              <li>3. Compare the market side by side and choose. Every price stays private to you.</li>
            </ol>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                type="email"
                placeholder="you@yourcompany.com"
                className="border border-zinc-600 bg-zinc-800 text-white rounded-sm p-2.5 text-sm w-64 placeholder-zinc-400"
                aria-label="Email for pricing alerts"
              />
              <button onClick={submitForBids} disabled={busy} className={amber}>{busy ? "Submitting…" : `Submit and alert me as pricing lands →`}</button>
            </div>
            <p className="text-xs opacity-70 mt-2">Business email, used only for pricing alerts on this estate. Skip it and the room still fills; you just check back yourself.</p>
          </div>
          {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
        </div>
      )}

      {stage === "room" && estate && (
        <div className="p-5">
          <div className="rounded-sm bg-zinc-900 text-white px-4 py-3 text-sm flex items-center gap-3 flex-wrap">
            <b>Live pricing room</b>
            <span>{received} of {estate.bids.length} priced · {pending} pending</span>
            <button className="ml-auto text-amber-300 font-medium" onClick={copyRoomLink}>{copied ? "Copied" : "Copy private room link"}</button>
          </div>
          <div className="mt-4 space-y-3">
            {estate.bids.map((b) => (
              <div key={b.vendor_slug} className="border border-[var(--ink-200,#e5e5e5)] rounded-sm p-4 flex items-center gap-4 flex-wrap">
                <p className="font-medium">{b.vendor_name || b.vendor_slug}</p>
                {b.status === "pending" && <span className="text-[11px] font-semibold tracking-wide bg-[var(--ink-100,#f4f4f5)] text-[var(--ink-600)] rounded px-2 py-0.5">PENDING PRICING</span>}
                {b.status === "received" && <span className="text-[11px] font-semibold tracking-wide bg-emerald-100 text-emerald-800 rounded px-2 py-0.5">PRICING RECEIVED</span>}
                {b.status === "declined" && <span className="text-[11px] font-semibold tracking-wide bg-red-100 text-red-800 rounded px-2 py-0.5">DECLINED{b.reason ? ` · ${b.reason.toUpperCase()}` : ""}</span>}
                <span className="ml-auto text-right">
                  {b.status === "received" && b.value !== null ? (
                    <>
                      <span className="text-lg font-semibold">£{b.value}</span>
                      <span className="text-xs text-[var(--ink-500)]"> {unitLabel(b.unit)} · {b.term_months}m</span>
                      {b.note && <span className="block text-xs text-[var(--ink-600)] max-w-xs">{b.note}</span>}
                    </>
                  ) : b.status === "pending" ? (
                    <span className="text-xs text-[var(--ink-500)]">provider notified · they price your estate directly here · you&apos;ll hear the moment it lands</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--ink-500)] mt-4">
            Providers price your estate directly in this portal, and this page updates itself as each price lands{estate.bids.length > 0 ? ", with an email alert the moment it does" : ""}. Keep the private room link safe: it carries your manage key.
            Every price is private to you; providers never see each other&apos;s numbers or your site contacts, and there are no sales calls until you choose.
          </p>
        </div>
      )}
    </div>
  );
}
