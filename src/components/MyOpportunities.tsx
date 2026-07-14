"use client";

/**
 * MyOpportunities: the signed-in buyer's published opportunities, recovered by
 * account rather than browser. Fetches /api/opportunity/mine (session
 * required), re-seeds the local manage tokens so rooms open with buyer
 * controls on this device, and links to each room. Renders nothing when
 * signed out or when the buyer has no opportunities — the landing page
 * stays clean for first-time visitors.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { RESPONSE_MODE_LABELS, type ResponseMode } from "@/lib/opportunity-types";

type Mine = {
  id: string;
  title: string;
  status: string;
  visibility: string;
  response_mode: string;
  created: number;
  updated: number;
  bid_count: number;
  comment_count: number;
  buyer_token: string;
};

export default function MyOpportunities() {
  const [mine, setMine] = useState<Mine[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/sase/api/opportunity/mine");
        if (!res.ok) return; // signed out or storage unavailable: render nothing
        const data = (await res.json()) as { opportunities: Mine[] };
        if (cancelled) return;
        // Re-seed manage tokens so the rooms work on this device.
        for (const o of data.opportunities) {
          try { localStorage.setItem(`opp_btok_${o.id}`, o.buyer_token); } catch { /* ignore */ }
        }
        setMine(data.opportunities);
      } catch { /* render nothing */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!mine || mine.length === 0) return null;

  return (
    <div className="mb-12 rounded-sm border border-emerald-300 bg-emerald-50/50 p-5">
      <p className="eyebrow mb-1">Your opportunities</p>
      <p className="text-sm text-[var(--ink-600)] mb-3">Signed in — manage responses, invite suppliers or close an opportunity from its room.</p>
      <div className="space-y-2">
        {mine.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-white px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{o.title}</p>
              <p className="text-xs text-[var(--ink-500)]">
                {o.status === "open" ? "Open" : o.status === "awarded" ? "Awarded" : "Closed"}
                {" · "}{RESPONSE_MODE_LABELS[o.response_mode as ResponseMode] ?? o.response_mode}
                {" · "}{o.bid_count} {o.bid_count === 1 ? "bid" : "bids"}, {o.comment_count} {o.comment_count === 1 ? "comment" : "comments"}
                {o.visibility === "unlisted" && " · Unlisted"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href={`/opportunities/${o.id}`} className="rounded-full border border-[var(--ink-300,#ccc)] px-3 py-1 text-xs no-underline text-[var(--ink-800)] hover:border-[var(--ink-900)]">Public notice</Link>
              <Link href={`/opportunities/${o.id}/room`} className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-zinc-950 no-underline hover:bg-amber-400">Manage room</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
