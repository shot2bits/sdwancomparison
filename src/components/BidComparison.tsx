"use client";

/**
 * Auction bid comparison for the buyer. Takes the activity feed, keeps each
 * supplier's latest priced bid, and ranks them. Bids are grouped by pricing
 * model so the buyer compares like for like (per site, per user, total, etc).
 */

import type { FeedItem } from "@/components/OpportunityFeed";

const PRICE_MODEL: Record<string, string> = {
  per_site_monthly: "per site / month", per_user_monthly: "per user / month", total_monthly: "total / month", one_off: "one-off", indicative: "indicative",
};

type Bid = { supplier: string; amount: number | null; currency: string; model: string; notes: string; created: number };

export default function BidComparison({ feed, onAward }: { feed: FeedItem[]; onAward?: (slug: string) => void }) {
  // Latest priced bid per supplier (by slug, falling back to name).
  const latest = new Map<string, Bid & { slug: string | null }>();
  for (const f of feed) {
    if (f.type !== "pricing" || !f.pricing) continue;
    const key = f.actor_slug || f.actor_name;
    const prev = latest.get(key);
    if (!prev || f.created > prev.created) {
      latest.set(key, { slug: f.actor_slug, supplier: f.actor_name, amount: f.pricing.amount, currency: f.pricing.currency, model: f.pricing.model, notes: f.pricing.notes, created: f.created });
    }
  }
  const bids = [...latest.values()];
  if (bids.length === 0) {
    return <p className="text-sm text-[var(--ink-500)]">No bids yet. Ranked bids will appear here as vendors submit pricing.</p>;
  }

  // Group by model, rank ascending by amount within each model (nulls last).
  const groups = new Map<string, (Bid & { slug: string | null })[]>();
  for (const b of bids) {
    const arr = groups.get(b.model) ?? [];
    arr.push(b);
    groups.set(b.model, arr);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => (a.amount ?? Infinity) - (b.amount ?? Infinity));
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([model, arr]) => (
        <div key={model}>
          <p className="eyebrow mb-2">{PRICE_MODEL[model] ?? model}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[var(--ink-500)] border-b border-[var(--ink-200,#e5e5e5)]">
                <th className="py-1.5 pr-4">#</th><th className="py-1.5 pr-4">Vendor</th><th className="py-1.5 pr-4">Bid</th><th className="py-1.5 pr-4">Note</th>{onAward && <th className="py-1.5"></th>}
              </tr></thead>
              <tbody>
                {arr.map((b, i) => (
                  <tr key={b.supplier} className={`border-b border-[var(--ink-100,#f0f0f0)] ${i === 0 && b.amount != null ? "bg-emerald-50" : ""}`}>
                    <td className="py-1.5 pr-4">{i === 0 && b.amount != null ? "★" : i + 1}</td>
                    <td className="py-1.5 pr-4 font-medium">{b.supplier}</td>
                    <td className="py-1.5 pr-4">{b.amount != null ? `${b.currency} ${b.amount.toLocaleString()}` : "Indicative"}</td>
                    <td className="py-1.5 pr-4 text-[var(--ink-600)]">{b.notes || "-"}</td>
                    {onAward && <td className="py-1.5">{b.slug && <button onClick={() => onAward(b.slug!)} className="text-xs px-2.5 py-1 rounded-full border border-amber-500 bg-amber-50 hover:bg-amber-100 transition-colors">Award</button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-xs text-[var(--ink-500)]">Lowest bid in each pricing model is starred. Models are not compared across each other; confirm scope parity before awarding.</p>
    </div>
  );
}
