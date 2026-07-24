"use client";

import { useEffect, useRef, useState } from "react";
import { FeedView, type FeedItem } from "@/components/OpportunityFeed";
import { OPP_SCOPE_TAGS, SECTORS as NOTICE_SECTORS, labelFor, labelsFor } from "@/lib/notice-options";
import BidComparison from "@/components/BidComparison";

type Opp = { id: string; title: string; scope: string[]; sites: number | null; regions: string[]; summary: string; budget_note: string; timeline_note: string; status: string; buyer_token: string; invited: string[]; feed: FeedItem[]; awarded_vendor_slug: string | null; engagement_type?: string; auction_format?: string; deadline?: number | null };

function deadlineText(opp: { engagement_type?: string; auction_format?: string; deadline?: number | null; status: string }): string | null {
  if (opp.engagement_type !== "auction" || opp.auction_format !== "timed" || !opp.deadline) return null;
  if (opp.status !== "open") return "Auction closed";
  const diff = opp.deadline - Date.now();
  if (diff <= 0) return "Closing";
  const h = Math.round(diff / 3_600_000);
  return h < 48 ? `Closes in ${h}h` : `Closes in ${Math.round(h / 24)}d`;
}
type Suggestion = { rank: number; slug: string; name: string; score: number };

const SCOPES = [
  { key: "underlay_circuits", label: "Underlay circuits" },
  { key: "sd_wan", label: "SD-WAN" },
  { key: "sse", label: "SSE" },
  { key: "sase", label: "Full SASE" },
  { key: "managed_service", label: "Managed service" },
];
/** Invite-filter sector keys (unchanged set); labels come from the one
 *  catalogue in notice-options, so the panel stops rendering lowercase
 *  slugs (Harry, 24 July 2026). */
const SECTORS = ["healthcare", "financial_services", "retail_ecommerce", "manufacturing", "energy_utilities", "government_public_sector"];

export default function OpportunityBuyer({ initialId }: { initialId?: string }) {
  const [opp, setOpp] = useState<Opp | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", buyer_org: "", scope: ["sase"] as string[], sites: "", regions: ["uk_ireland"] as string[], summary: "", budget_note: "", timeline_note: "", engagement_type: "quote_room", auction_format: "open", deadline: "", eligibility: "invited", visibility: "public" });
  const [sector, setSector] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const lastTs = useRef(0);

  useEffect(() => { if (initialId) load(initialId); /* eslint-disable-next-line */ }, [initialId]);
  // Prefill the post form from the guided start (query carry-through).
  useEffect(() => {
    if (initialId) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("prefill") !== "1") return;
    const validScopes = SCOPES.map((x) => x.key);
    const scope = (p.get("scope") ?? "").split(".").filter((x) => validScopes.includes(x));
    const regions = (p.get("regions") ?? "").split(".").filter(Boolean);
    const engagement = p.get("engagement") === "auction" ? "auction" : "quote_room";
    const summary = p.get("summary") ?? "";
    const scopeLabel = scope.map((k) => SCOPES.find((x) => x.key === k)?.label ?? k).join(", ");
    setForm((f) => ({
      ...f,
      scope: scope.length ? scope : f.scope,
      regions: regions.length ? regions : f.regions,
      sites: p.get("sites") ?? f.sites,
      summary: summary || f.summary,
      budget_note: p.get("budget") ?? f.budget_note,
      title: summary ? summary.slice(0, 80) : scopeLabel ? `${scopeLabel} opportunity` : f.title,
      engagement_type: engagement,
    }));
    /* eslint-disable-next-line */
  }, []);
  useEffect(() => {
    if (!opp) return;
    const poll = setInterval(async () => {
      try {
        // Owners include their token so pricing amounts stay visible to them;
        // viewers poll without it and receive the masked feed.
        const btok = opp.buyer_token ? `&buyer_token=${encodeURIComponent(opp.buyer_token)}` : "";
        const res = await fetch(`/sase/api/opportunity/${opp.id}/feed?since=${lastTs.current}${btok}`);
        if (res.ok) { const d = await res.json(); if (d.items?.length) { setFeed((prev) => [...prev, ...d.items]); lastTs.current = Math.max(lastTs.current, ...d.items.map((f: FeedItem) => f.created)); } }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [opp?.id]);

  async function load(id: string) {
    // Prove ownership with the locally stored buyer token (set at publish
    // time); the API no longer returns buyer_token to arbitrary viewers.
    let btok = "";
    try { btok = localStorage.getItem(`opp_btok_${id}`) ?? ""; } catch { /* ignore */ }
    // Account-based recovery: no local token (new device, cleared cache) but
    // possibly signed in — /api/opportunity/mine returns this buyer's tokens.
    if (!btok) {
      try {
        const mineRes = await fetch("/sase/api/opportunity/mine");
        if (mineRes.ok) {
          const mine = (await mineRes.json()) as { opportunities: { id: string; buyer_token: string }[] };
          const match = mine.opportunities.find((o) => o.id === id);
          if (match) {
            btok = match.buyer_token;
            try { localStorage.setItem(`opp_btok_${id}`, btok); } catch { /* ignore */ }
          }
        }
      } catch { /* viewer mode */ }
    }
    try {
      const res = await fetch(`/sase/api/opportunity/${id}${btok ? `?buyer_token=${encodeURIComponent(btok)}` : ""}`);
      if (res.ok) { const o = (await res.json()) as Opp; setOpp(o); setFeed(o.feed); lastTs.current = Math.max(0, ...o.feed.map((f) => f.created)); }
    }
    catch { setError("Could not load."); }
  }

  async function postOpportunity() {
    setError(null);
    if (!form.title.trim() || form.scope.length === 0) { setError("Add a title and at least one scope."); return; }
    try {
      const res = await fetch("/sase/api/opportunity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        ...form,
        sites: form.sites ? Number(form.sites) : null,
        deadline: form.engagement_type === "auction" && form.auction_format === "timed" && form.deadline ? form.deadline : null,
      }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Could not post."); }
      const o = (await res.json()) as Opp;
      try { localStorage.setItem(`opp_btok_${o.id}`, o.buyer_token); } catch { /* ignore */ }
      setOpp(o); setFeed(o.feed); lastTs.current = Math.max(0, ...o.feed.map((f) => f.created));
      window.history.replaceState(null, "", `/sase/opportunities/${o.id}/room`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not post."); }
  }

  async function suggest() {
    try {
      const res = await fetch("/sase/api/openapi/build_sase_shortlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sector: sector || null, required_regions: form.regions, shortlist_size: 8 }) });
      if (res.ok) setSuggestions(((await res.json()) as { shortlist: Suggestion[] }).shortlist);
    } catch { /* ignore */ }
  }

  async function invite(slug: string) {
    if (!opp) return;
    try {
      const res = await fetch(`/sase/api/opportunity/${opp.id}/invite`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vendor_slug: slug, buyer_token: opp.buyer_token }) });
      if (res.ok) { const d = await res.json(); setOpp(d.opportunity); navigator.clipboard.writeText(`${window.location.origin}${d.supplier_url}`); setCopied(slug); setTimeout(() => setCopied(null), 2500); }
    } catch { /* ignore */ }
  }

  async function buyerAction(action: string, body: string, award_slug?: string) {
    if (!opp) return;
    try {
      const res = await fetch(`/sase/api/opportunity/${opp.id}/buyer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buyer_token: opp.buyer_token, action, body, award_slug }) });
      if (res.ok) { const o = (await res.json()) as Opp; setOpp(o); setFeed(o.feed); lastTs.current = Math.max(0, ...o.feed.map((f) => f.created)); setComment(""); }
    } catch { /* ignore */ }
  }

  const toggle = (list: string[], v: string, set: (x: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (!opp) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl mb-2">Post an opportunity</h2>
        <p className="text-[var(--ink-700)] mb-5">Describe what you need, from just underlay circuits to full SASE. Invite graded suppliers and watch them reply with comments and pricing in real time.</p>
        <div className="space-y-4">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title, e.g. Underlay circuits for 40 UK retail sites" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
          <input value={form.buyer_org} onChange={(e) => setForm({ ...form, buyer_org: e.target.value })} placeholder="Your organisation (optional)" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
          <div>
            <p className="eyebrow mb-2">Scope</p>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => <button key={s.key} onClick={() => toggle(form.scope, s.key, (x) => setForm({ ...form, scope: x }))} className={`px-3.5 py-1.5 text-sm rounded-full border transition-colors ${form.scope.includes(s.key) ? "bg-amber-500 border-amber-500 text-zinc-950 font-medium" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}>{s.label}</button>)}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={form.sites} onChange={(e) => setForm({ ...form, sites: e.target.value })} placeholder="Number of sites" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
            <input value={form.budget_note} onChange={(e) => setForm({ ...form, budget_note: e.target.value })} placeholder="Budget note (optional)" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
          </div>
          <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} placeholder="Summary of requirements" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
          <input value={form.timeline_note} onChange={(e) => setForm({ ...form, timeline_note: e.target.value })} placeholder="Timeline (optional)" className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />

          <div>
            <p className="eyebrow mb-2">How should vendors respond?</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <button onClick={() => setForm({ ...form, engagement_type: "quote_room" })} className={`text-left p-3 rounded-sm border transition-colors ${form.engagement_type === "quote_room" ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}>
                <span className="block text-sm font-medium">Quote room</span>
                <span className="block text-xs text-[var(--ink-600)]">A live conversation. Vendors reply with comments and indicative quotes, no deadline.</span>
              </button>
              <button onClick={() => setForm({ ...form, engagement_type: "auction" })} className={`text-left p-3 rounded-sm border transition-colors ${form.engagement_type === "auction" ? "border-amber-500 bg-amber-50" : "border-[var(--ink-300,#ccc)] hover:border-[var(--ink-900)]"}`}>
                <span className="block text-sm font-medium">Reverse auction</span>
                <span className="block text-xs text-[var(--ink-600)]">Vendors compete on price. Bids are ranked. Run it open-ended or to a deadline.</span>
              </button>
            </div>
          </div>

          {form.engagement_type === "auction" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <select value={form.auction_format} onChange={(e) => setForm({ ...form, auction_format: e.target.value })} className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm bg-white">
                <option value="open">Open-ended (pick anytime)</option>
                <option value="timed">Timed (closes on a deadline)</option>
              </select>
              {form.auction_format === "timed" && (
                <input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <select value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} className="border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm bg-white">
              <option value="invited">Invite-only (you pick the vendors)</option>
              <option value="open">Open to any matching verified vendor</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
              <input type="checkbox" checked={form.visibility === "public"} onChange={(e) => setForm({ ...form, visibility: e.target.checked ? "public" : "unlisted" })} />
              List on the public board
            </label>
          </div>

          <button onClick={postOpportunity} className="px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors">Post opportunity</button>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </div>
    );
  }

  // Buyer controls only render for the owner (real buyer_token present).
  const isOwner = Boolean(opp.buyer_token);

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <p className="eyebrow mb-1">{opp.engagement_type === "auction" ? "Reverse auction" : "Live opportunity room"} <span className="text-emerald-700">● live</span></p>
        <h1 className="text-2xl mb-1">{opp.title}</h1>
        <p className="text-sm text-[var(--ink-500)] mb-4">Scope: {labelsFor(OPP_SCOPE_TAGS, opp.scope).join(", ")}{opp.sites ? ` · ${opp.sites} sites` : ""} · {opp.status.charAt(0).toUpperCase() + opp.status.slice(1)}{deadlineText(opp) ? ` · ${deadlineText(opp)}` : ""}{opp.awarded_vendor_slug ? ` · awarded to ${opp.awarded_vendor_slug}` : ""}</p>
        {opp.engagement_type === "auction" && (
          <div className="mb-6 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
            <p className="font-semibold mb-3">Bid comparison</p>
            <BidComparison feed={feed} onAward={opp.status === "open" ? (slug) => buyerAction("award", `Awarded to ${slug}.`, slug) : undefined} />
          </div>
        )}
        <FeedView items={feed} buyerLabel={isOwner ? "You (the buyer)" : undefined} />
        {opp.status === "open" && isOwner && (
          <div className="mt-4 flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Post a comment to all suppliers" className="flex-1 border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
            <button onClick={() => buyerAction("comment", comment)} disabled={!comment} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">Send</button>
          </div>
        )}
      </div>
      {!isOwner ? (
        <div>
          <p className="eyebrow mb-2">Respond to this opportunity</p>
          <p className="text-sm text-[var(--ink-600)] mb-3">Suppliers sign in with a verified work email to submit comments, pricing or clarification questions. Pricing stays private to the buyer.</p>
          <a href="/sase/for-suppliers/" className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Sign in to respond</a>
          <p className="text-xs text-[var(--ink-500)] mt-3">Posted this opportunity yourself? Sign in with the email you published with and reload this page — your manage controls will be restored automatically.</p>
        </div>
      ) : (
      <div>
        <p className="eyebrow mb-2">Invite suppliers</p>
        <div className="flex gap-2 mb-2">
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm flex-1">
            <option value="">Any sector</option>
            {SECTORS.map((s) => <option key={s} value={s}>{labelFor(NOTICE_SECTORS, s)}</option>)}
          </select>
          <button onClick={suggest} className="px-3 py-1.5 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Suggest</button>
        </div>
        <div className="space-y-1.5">
          {suggestions.map((s) => {
            const invited = opp.invited.includes(s.slug);
            return (
              <div key={s.slug} className="flex items-center justify-between text-sm border border-[var(--ink-200,#e5e5e5)] rounded-sm px-3 py-1.5">
                <span>{s.name} <span className="text-[var(--ink-400,#9ca3af)]">({s.score})</span></span>
                <button onClick={() => invite(s.slug)} className={`text-xs px-2.5 py-1 rounded-full border ${invited ? "border-emerald-500 text-emerald-700" : "border-[var(--ink-900)] hover:bg-[var(--ink-900)] hover:text-white"} transition-colors`}>
                  {copied === s.slug ? "Link copied" : invited ? "Invited" : "Invite"}
                </button>
              </div>
            );
          })}
        </div>
        {opp.status === "open" && opp.invited.length > 0 && (
          <div className="mt-4">
            <p className="eyebrow mb-2">Award</p>
            <div className="flex flex-wrap gap-1.5">
              {opp.invited.map((slug) => <button key={slug} onClick={() => buyerAction("award", `Awarded to ${slug}.`, slug)} className="text-xs px-2.5 py-1 rounded-full border border-amber-500 bg-amber-50 hover:bg-amber-100 transition-colors">Award {slug}</button>)}
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--ink-500)] mt-4">Inviting a supplier copies their private room link. Suppliers reply live with comments and pricing.</p>
      </div>
      )}
    </div>
  );
}
