"use client";

/**
 * BoardList: interactive board cards with search and filters. The board page
 * stays server-rendered (JSON-LD, crawlable shell and data.json are unaffected);
 * this component only handles in-page narrowing of the already-public list.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { OPP_SCOPE_LABELS, RESPONSE_MODE_LABELS, type OppScope, type PublicOpportunity, type ResponseMode } from "@/lib/opportunity-types";
import { SECTORS, REGIONS, labelFor } from "@/lib/notice-options";
import { track } from "@/lib/analytics";

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function deadlineLabel(o: PublicOpportunity): string | null {
  const deadline = o.response_deadline ?? (o.engagement_type === "auction" && o.auction_format === "timed" ? o.deadline : null);
  if (!deadline) return null;
  const diff = deadline - Date.now();
  if (diff <= 0) return "Closing";
  const h = Math.round(diff / 3_600_000);
  return h < 48 ? `Closes in ${h}h` : `Closes in ${Math.round(h / 24)}d`;
}

const inputCls = "border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm bg-white";

export default function BoardList({ opps }: { opps: PublicOpportunity[] }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("");
  const [sector, setSector] = useState("");
  const [region, setRegion] = useState("");
  const [mode, setMode] = useState("");

  const scopesInUse = useMemo(() => [...new Set(opps.flatMap((o) => o.scope))], [opps]);
  const sectorsInUse = useMemo(() => [...new Set(opps.map((o) => o.buyer_sector).filter(Boolean))], [opps]);
  const regionsInUse = useMemo(() => [...new Set(opps.flatMap((o) => o.regions))], [opps]);
  const modesInUse = useMemo(() => [...new Set(opps.map((o) => o.response_mode))], [opps]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return opps.filter((o) => {
      if (scope && !o.scope.includes(scope as OppScope)) return false;
      if (sector && o.buyer_sector !== sector) return false;
      if (region && !o.regions.includes(region)) return false;
      if (mode && o.response_mode !== mode) return false;
      if (needle && !(`${o.title} ${o.summary} ${o.buyer_org}`.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [opps, q, scope, sector, region, mode]);

  const anyFilter = q || scope || sector || region || mode;

  return (
    <div>
      {opps.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); track("opportunity_board_filtered", { field: "search" }); }}
            placeholder="Search opportunities…"
            className={`${inputCls} min-w-48 flex-1`}
          />
          <select value={scope} onChange={(e) => { setScope(e.target.value); track("opportunity_board_filtered", { field: "scope", value: e.target.value }); }} className={inputCls}>
            <option value="">All scopes</option>
            {scopesInUse.map((s) => <option key={s} value={s}>{OPP_SCOPE_LABELS[s] ?? s}</option>)}
          </select>
          {sectorsInUse.length > 0 && (
            <select value={sector} onChange={(e) => { setSector(e.target.value); track("opportunity_board_filtered", { field: "sector", value: e.target.value }); }} className={inputCls}>
              <option value="">All sectors</option>
              {sectorsInUse.map((s) => <option key={s} value={s}>{labelFor(SECTORS, s)}</option>)}
            </select>
          )}
          <select value={region} onChange={(e) => { setRegion(e.target.value); track("opportunity_board_filtered", { field: "region", value: e.target.value }); }} className={inputCls}>
            <option value="">All regions</option>
            {regionsInUse.map((r) => <option key={r} value={r}>{labelFor(REGIONS, r)}</option>)}
          </select>
          <select value={mode} onChange={(e) => { setMode(e.target.value); track("opportunity_board_filtered", { field: "responseMode", value: e.target.value }); }} className={inputCls}>
            <option value="">All response modes</option>
            {modesInUse.map((m) => <option key={m} value={m}>{RESPONSE_MODE_LABELS[m as ResponseMode] ?? m}</option>)}
          </select>
          {anyFilter && (
            <button type="button" onClick={() => { setQ(""); setScope(""); setSector(""); setRegion(""); setMode(""); }} className="text-sm underline text-[var(--ink-600)]">
              Clear
            </button>
          )}
        </div>
      )}

      {opps.length === 0 ? (
        <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-8 text-center">
          <p className="text-[var(--ink-700)]">No open opportunities right now.</p>
          <p className="text-sm text-[var(--ink-500)] mt-1">Be the first: <Link href="/opportunities/new" className="underline">publish an RFI</Link> and invite verified vendors to bid.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-8 text-center">
          <p className="text-[var(--ink-700)]">Nothing matches those filters.</p>
          <button type="button" onClick={() => { setQ(""); setScope(""); setSector(""); setRegion(""); setMode(""); }} className="text-sm underline text-[var(--ink-600)] mt-1">Clear filters</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((o) => {
            const dl = deadlineLabel(o);
            return (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
                <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                  <span className="rounded-full bg-[var(--ink-100,#f0f0f0)] px-2 py-0.5 font-medium uppercase tracking-wide text-[var(--ink-600)]">{RESPONSE_MODE_LABELS[o.response_mode] ?? (o.engagement_type === "auction" ? "Auction" : "Quote room")}</span>
                  {o.has_full_rfp && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Full RFP included</span>}
                  {o.eligibility === "open" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Open to respond</span>}
                  {dl && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">{dl}</span>}
                </div>
                <h2 className="text-lg font-semibold mb-1 leading-snug">{o.title}</h2>
                <p className="text-sm text-[var(--ink-500)] mb-2">
                  {o.buyer_org || (o.buyer_sector ? `${labelFor(SECTORS, o.buyer_sector)} buyer${o.buyer_visibility === "anonymous" ? " (anonymous)" : ""}` : "")}
                </p>
                {o.summary && <p className="text-sm text-[var(--ink-700)] mb-3 line-clamp-2">{o.summary}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {o.scope.map((s) => <span key={s} className="rounded-full border border-[var(--ink-200,#e5e5e5)] px-2 py-0.5 text-xs text-[var(--ink-700)]">{OPP_SCOPE_LABELS[s as OppScope] ?? s}</span>)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-500)]">
                  {o.regions.length > 0 && <span>{o.regions.map((r) => labelFor(REGIONS, r)).join(", ")}</span>}
                  {o.sites != null && <span>{o.sites} sites</span>}
                  <span>{o.bid_count} {o.bid_count === 1 ? "bid" : "bids"}</span>
                  <span>{o.comment_count} {o.comment_count === 1 ? "comment" : "comments"}</span>
                  <span>Updated {timeAgo(o.last_activity)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
