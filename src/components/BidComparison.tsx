"use client";

/**
 * Auction bid comparison for the buyer. Takes the activity feed, keeps each
 * supplier's latest priced bid, and ranks them. Bids are grouped by pricing
 * model so the buyer compares like for like (per site, per user, total, etc).
 */

import { comparableBidGroups } from "@/lib/bid-comparison";
import type { FeedItem } from "@/components/OpportunityFeed";

const PRICE_MODEL: Record<string, string> = {
  per_site_monthly: "per site / month", per_user_monthly: "per user / month", total_monthly: "total / month", one_off: "one-off", indicative: "indicative",
};

export default function BidComparison({ feed, onAward }: { feed: FeedItem[]; onAward?: (slug: string) => void }) {
  const groups=comparableBidGroups(feed);
  if(groups.size===0)return <p>No written pricing responses yet. Missing costs will remain unconfirmed, never zero.</p>;
  return (
    <div className="space-y-5"><p>Price order within the same currency and charging basis is not a suitability recommendation. Check scope, exclusions and contract terms.</p>
      {[...groups.entries()].map(([model, arr]) => (
        <div key={model}>
          <p className="eyebrow mb-2">{PRICE_MODEL[arr[0].model] ?? arr[0].model} · {arr[0].currency}{arr[0].unit_note ? ` · ${arr[0].unit_note}` : ""}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[var(--ink-500)] border-b border-[var(--ink-200,#e5e5e5)]">
                <th className="py-1.5 pr-4">#</th><th className="py-1.5 pr-4">Vendor</th><th className="py-1.5 pr-4">Bid</th><th className="py-1.5 pr-4">Note</th><th className="py-1.5 pr-4">Written evidence</th>{onAward && <th className="py-1.5"></th>}
              </tr></thead>
              <tbody>
                {arr.map((b, i) => (
                  <tr key={b.slug || b.supplier} className={`border-b border-[var(--ink-100,#f0f0f0)] ${i === 0 && b.amount != null ? "bg-emerald-50" : ""}`}>
                    <td className="py-1.5 pr-4">{i + 1}</td>
                    <td className="py-1.5 pr-4 font-medium">{b.supplier}</td>
                    <td className="py-1.5 pr-4">{b.amount != null ? `${b.currency} ${b.amount.toLocaleString()}` : "Not confirmed"}</td>
                    <td className="py-1.5 pr-4 text-[var(--ink-600)]">{b.notes || "-"}</td>
                    <td className="py-1.5 pr-4">{b.evidence_urls.length?b.evidence_urls.map((url,i)=><a key={url} className="block underline" href={url} target="_blank" rel="noopener noreferrer">Proposal evidence {i+1}</a>):"Not supplied"}</td>
                    {onAward && <td className="py-1.5">{b.slug && <button onClick={() => onAward(b.slug!)} className="text-xs px-2.5 py-1 rounded-full border border-amber-500 bg-amber-50 hover:bg-amber-100 transition-colors">Award</button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <p className="text-xs text-[var(--ink-500)]">Different currencies and charging bases are kept separate. Confirm scope parity, exclusions and missing costs before deciding.</p>
    </div>
  );
}
