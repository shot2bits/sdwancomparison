import type { Metadata } from "next";
import Link from "next/link";
import { listPublicOpportunities } from "@/lib/rfp-store";
import { OPP_SCOPE_LABELS, type OppScope, type PublicOpportunity } from "@/lib/opportunity-types";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live SASE, SSE & SD-WAN opportunity board | Netify",
  description: "Open SASE, SSE, SD-WAN, circuit and managed service opportunities from buyers. Verified vendors bid and quote. Public board, browse without signing in.",
  alternates: { canonical: `${SITE_URL}/opportunities/board/` },
  openGraph: { title: "Live SASE and SD-WAN opportunity board", description: "Open buyer opportunities; verified vendors bid and quote.", url: `${SITE_URL}/opportunities/board`, type: "website", locale: "en_GB" },
};

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function deadlineLabel(o: PublicOpportunity): string | null {
  if (o.engagement_type !== "auction" || o.auction_format !== "timed" || !o.deadline) return null;
  const diff = o.deadline - Date.now();
  if (diff <= 0) return "Closing";
  const h = Math.round(diff / 3_600_000);
  return h < 48 ? `Closes in ${h}h` : `Closes in ${Math.round(h / 24)}d`;
}

export default async function OpportunityBoardPage() {
  const opps = await listPublicOpportunities();
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Opportunity board", "/opportunities/board"),
    getSpeakableSchema("/opportunities/board"),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Live SASE and SD-WAN opportunities",
      numberOfItems: opps.length,
      itemListElement: opps.slice(0, 50).map((o, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: o.title,
        url: `${SITE_URL}/opportunities/${o.id}`,
      })),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Live marketplace</p>
        <h1 id="page-h1" className="mb-4">Open SASE, SSE and SD-WAN opportunities</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Buyers post a need, from underlay circuits to appliances, cloud security or a full managed SASE rollout. Verified vendors bid and quote. Browsing is open to everyone; you sign in only to submit a bid.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/opportunities" className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Post an opportunity</Link>
          <Link href="/for-suppliers" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">For vendors and providers</Link>
        </div>
      </div>

      {opps.length === 0 ? (
        <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-8 text-center">
          <p className="text-[var(--ink-700)]">No open opportunities right now.</p>
          <p className="text-sm text-[var(--ink-500)] mt-1">Be the first: <Link href="/opportunities" className="underline">post a need</Link> and invite verified vendors to bid.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {opps.map((o) => {
            const dl = deadlineLabel(o);
            return (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className="rounded-full bg-[var(--ink-100,#f0f0f0)] px-2 py-0.5 font-medium uppercase tracking-wide text-[var(--ink-600)]">{o.engagement_type === "auction" ? (o.auction_format === "timed" ? "Timed auction" : "Auction") : "Quote room"}</span>
                  {o.eligibility === "open" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Open to bid</span>}
                  {dl && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">{dl}</span>}
                </div>
                <h2 className="text-lg font-semibold mb-1 leading-snug">{o.title}</h2>
                {o.buyer_org && <p className="text-sm text-[var(--ink-500)] mb-2">{o.buyer_org}</p>}
                {o.summary && <p className="text-sm text-[var(--ink-700)] mb-3 line-clamp-2">{o.summary}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {o.scope.map((s) => <span key={s} className="rounded-full border border-[var(--ink-200,#e5e5e5)] px-2 py-0.5 text-xs text-[var(--ink-700)]">{OPP_SCOPE_LABELS[s as OppScope] ?? s}</span>)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-500)]">
                  {o.regions.length > 0 && <span>{o.regions.join(", ").toUpperCase()}</span>}
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

      <p className="mt-10 text-sm text-[var(--ink-500)]">Machine-readable board: <a className="underline" href="/sase/opportunities/board/data.json">/opportunities/board/data.json</a>. Agents can read open opportunities and bid via the marketplace MCP at <a className="underline" href="/sase/api/mcp">/api/mcp</a>. Pricing amounts stay private to the posting buyer.</p>
    </div>
  );
}
