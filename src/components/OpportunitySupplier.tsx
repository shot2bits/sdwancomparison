"use client";

import { useEffect, useRef, useState } from "react";
import { FeedView, type FeedItem } from "@/components/OpportunityFeed";

type Opp = { id: string; title: string; scope: string[]; sites: number | null; regions: string[]; summary: string; budget_note: string; timeline_note: string; status: string; feed: FeedItem[]; engagement_type?: string; auction_format?: string; deadline?: number | null; evidence_requested?: string[] };

const EVIDENCE_LABELS: Record<string, string> = {
  sector_references: "Sector references at similar scale",
  coverage_evidence: "Coverage / PoP evidence for the buyer's regions",
  security_certifications: "Security certifications and attestations",
  sla_schedule: "SLA schedule and service credits",
  migration_plan: "Migration approach and plan outline",
  support_model: "Support model and escalation path",
  pricing_structure: "Pricing structure and rate card",
  case_studies: "Case studies with measurable outcomes",
};

function deadlineText(opp: { engagement_type?: string; auction_format?: string; deadline?: number | null; status: string }): string | null {
  if (opp.engagement_type !== "auction" || opp.auction_format !== "timed" || !opp.deadline) return null;
  if (opp.status !== "open") return "Auction closed";
  const diff = opp.deadline - Date.now();
  if (diff <= 0) return "Closing";
  const h = Math.round(diff / 3_600_000);
  return h < 48 ? `Closes in ${h}h` : `Closes in ${Math.round(h / 24)}d`;
}

export default function OpportunitySupplier({ token }: { token: string }) {
  const [opp, setOpp] = useState<Opp | null>(null);
  const [vendor, setVendor] = useState<string>("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [comment, setComment] = useState("");
  const [links, setLinks] = useState("");
  const [price, setPrice] = useState({ model: "per_site_monthly", amount: "", unit_note: "", notes: "" });
  const [structured, setStructured] = useState<Record<string, string>>({});
  const [structuredSummary, setStructuredSummary] = useState("");

  // Split the evidence-links field into clean https URLs (server re-validates).
  const parseLinks = () => links.split(/[\s,]+/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l)).slice(0, 5);
  const [error, setError] = useState<string | null>(null);
  const lastTs = useRef(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/sase/api/opportunity/supplier/${token}`);
        if (!res.ok) { setError("This opportunity link is invalid."); return; }
        const data = await res.json();
        if (!active) return;
        setOpp(data.opportunity); setVendor(data.vendor_name ?? data.vendor_slug);
        setFeed(data.opportunity.feed); lastTs.current = Math.max(0, ...data.opportunity.feed.map((f: FeedItem) => f.created));
      } catch { setError("Could not load the opportunity."); }
    })();
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/sase/api/opportunity/${opp?.id ?? ""}/feed?since=${lastTs.current}`);
        if (res.ok && opp) {
          const d = await res.json();
          if (d.items?.length) { setFeed((prev) => [...prev, ...d.items]); lastTs.current = Math.max(lastTs.current, ...d.items.map((f: FeedItem) => f.created)); }
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => { active = false; clearInterval(poll); };
  }, [token, opp?.id]);

  async function post(type: string, body: string, pricing?: object, answers?: Record<string, string>) {
    setError(null);
    try {
      const res = await fetch(`/sase/api/opportunity/supplier/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, body, pricing, answers, links: parseLinks() }) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.auth_required ? "Please sign in above with your supplier work email first." : (e.error ?? "Could not send.")); }
      const updated = (await res.json()) as Opp;
      setFeed(updated.feed); lastTs.current = Math.max(0, ...updated.feed.map((f) => f.created));
      setLinks("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send."); }
  }

  if (error && !opp) return <p className="text-red-700">{error}</p>;
  if (!opp) return <p className="text-[var(--ink-500)]">Loading opportunity...</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{opp.engagement_type === "auction" ? "Reverse auction" : "Live opportunity"} · {vendor}</p>
        <h1 className="text-2xl mb-1">{opp.title}</h1>
        <p className="text-sm text-[var(--ink-500)]">Scope: {opp.scope.join(", ")}{opp.sites ? ` · ${opp.sites} sites` : ""}{opp.regions.length ? ` · ${opp.regions.join(", ")}` : ""} · {opp.status}{deadlineText(opp) ? ` · ${deadlineText(opp)}` : ""}</p>
        {opp.engagement_type === "auction" && opp.status === "open" && <p className="text-sm text-amber-700 mt-1">Competitive auction: submit your best price. The buyer compares ranked bids.</p>}
        {opp.summary && <p className="text-sm text-[var(--ink-700)] mt-2">{opp.summary}</p>}
        {(opp.budget_note || opp.timeline_note) && <p className="text-sm text-[var(--ink-500)] mt-1">{opp.budget_note}{opp.budget_note && opp.timeline_note ? " · " : ""}{opp.timeline_note}</p>}
        <p className="text-xs text-emerald-700 mt-2">● Live, updates every few seconds</p>
      </div>

      <FeedView items={feed} />

      {opp.status === "open" ? (
        <div className="border-t border-[var(--ink-300,#ccc)] pt-5 space-y-4">
          <div>
            <p className="eyebrow mb-2">Comment or register interest</p>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" placeholder="Your comment or question" />
            <div className="mt-2 flex gap-2 flex-wrap">
              <button onClick={() => { post("comment", comment); setComment(""); }} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors">Comment</button>
              <button onClick={() => { post("question", comment || "Could you clarify the requirement?"); setComment(""); }} disabled={!comment} className="px-4 py-2 text-sm border border-sky-600 text-sky-800 rounded-full hover:bg-sky-50 transition-colors disabled:opacity-50">Ask clarification question</button>
              <button onClick={() => post("interest", comment || "We are interested and would like to participate.")} className="px-4 py-2 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Register interest</button>
              <button onClick={() => post("decline", comment || "Thank you, we are declining.")} className="px-4 py-2 text-sm border border-[var(--ink-300,#ccc)] rounded-full hover:border-[var(--ink-900)]">Decline</button>
            </div>
          </div>

          {(opp.evidence_requested?.length ?? 0) > 0 && (
            <div>
              <p className="eyebrow mb-2">Structured response</p>
              <p className="text-xs text-[var(--ink-500)] mb-3">The buyer asked for the following evidence. Answer each point (add links in the evidence field below) — structured responses are easier for the buyer to score.</p>
              <div className="space-y-3">
                <textarea value={structuredSummary} onChange={(e) => setStructuredSummary(e.target.value)} rows={2} className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" placeholder="Response summary — why you fit this requirement" />
                {(opp.evidence_requested ?? []).map((k) => (
                  <div key={k}>
                    <p className="text-xs font-medium text-[var(--ink-700)] mb-1">{EVIDENCE_LABELS[k] ?? k.replace(/_/g, " ")}</p>
                    <textarea
                      value={structured[k] ?? ""}
                      onChange={(e) => setStructured((s) => ({ ...s, [k]: e.target.value }))}
                      rows={2}
                      className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm"
                      placeholder="Your answer for this point"
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const answers = Object.fromEntries(Object.entries(structured).filter(([, v]) => v.trim()));
                    post("response", structuredSummary || "Structured response submitted.", undefined, answers);
                    setStructured({}); setStructuredSummary("");
                  }}
                  disabled={!structuredSummary.trim() && Object.values(structured).every((v) => !v.trim())}
                  className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  Submit structured response
                </button>
              </div>
            </div>
          )}
          <div>
            <p className="eyebrow mb-2">Submit pricing</p>
            <div className="grid sm:grid-cols-4 gap-2">
              <select value={price.model} onChange={(e) => setPrice({ ...price, model: e.target.value })} className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm">
                <option value="per_site_monthly">Per site / month</option>
                <option value="per_user_monthly">Per user / month</option>
                <option value="total_monthly">Total / month</option>
                <option value="one_off">One-off</option>
                <option value="indicative">Indicative</option>
              </select>
              <input value={price.amount} onChange={(e) => setPrice({ ...price, amount: e.target.value })} placeholder="Amount (GBP)" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
              <input value={price.unit_note} onChange={(e) => setPrice({ ...price, unit_note: e.target.value })} placeholder="Unit note" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
              <input value={price.notes} onChange={(e) => setPrice({ ...price, notes: e.target.value })} placeholder="Notes" className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
            </div>
            <button onClick={() => post("pricing", "Indicative pricing submitted.", { model: price.model, amount: price.amount ? Number(price.amount) : null, currency: "GBP", unit_note: price.unit_note, notes: price.notes })} className="mt-2 px-4 py-2 text-sm border border-[var(--ink-900)] rounded-full hover:bg-[var(--ink-900)] hover:text-white transition-colors">Submit pricing</button>
          </div>
          <div>
            <p className="eyebrow mb-2">Evidence links (optional)</p>
            <input
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="https:// links to case studies, SLA schedules, certifications — up to 5, comma or space separated"
              className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm"
            />
            <p className="text-xs text-[var(--ink-500)] mt-1">Attached to your next comment, interest registration or pricing submission. Buyers weight evidenced responses higher.</p>
          </div>
        </div>
      ) : <p className="text-sm text-[var(--ink-500)]">This opportunity is {opp.status}.</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
