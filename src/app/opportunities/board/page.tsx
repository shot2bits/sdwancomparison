import type { Metadata } from "next";
import Link from "next/link";
import { listPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import BoardList from "@/components/BoardList";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live SASE, SSE & SD-WAN opportunity board",
  description: "Open SASE, SSE, SD-WAN, circuit and managed service opportunities from buyers. Verified vendors bid and quote. Public board, browse without signing in.",
  alternates: { canonical: `${SITE_URL}/opportunities/board/` },
  openGraph: { title: "Live SASE and SD-WAN opportunity board", description: "Open buyer opportunities; verified vendors bid and quote.", url: `${SITE_URL}/opportunities/board`, type: "website", locale: "en_GB" },
};

export default async function OpportunityBoardPage() {
  const opps = kvConfigured() ? await listPublicOpportunities() : [];
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Opportunity board", "/opportunities/board"),
    getSpeakableSchema("/opportunities/board"),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${SITE_URL}/opportunities/board/#board`,
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
          <Link href="/opportunities/new" className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Post a project</Link>
          <Link href="/for-suppliers" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">For vendors and providers</Link>
        </div>
      </div>

      <BoardList opps={opps} />

      <div className="mt-12">
        <h2 className="text-lg font-semibold mb-1">Sample notices</h2>
        <p className="text-sm text-[var(--ink-600)] mb-4">Worked examples of what a published project notice looks like. Not live opportunities.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {SAMPLE_NOTICES.map((s) => (
            <Link key={s.slug} href={`/opportunities/${s.slug}`} className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
              <span className="mb-2 inline-block rounded-full bg-[var(--ink-100,#f0f0f0)] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-[var(--ink-600)]">Sample</span>
              <h3 className="text-sm font-semibold leading-snug mb-1">{s.title}</h3>
              <p className="text-xs text-[var(--ink-600)] line-clamp-2">{s.summary}</p>
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-10 text-sm text-[var(--ink-500)]">Machine-readable board: <a className="underline" href="/sase/opportunities/board/data.json">/opportunities/board/data.json</a>. Each notice also has its own feed at /opportunities/&lt;id&gt;/data.json. Agents can read open opportunities and respond via the marketplace MCP at <a className="underline" href="/sase/api/mcp">/api/mcp</a>. Pricing amounts stay private to the posting buyer.</p>
    </div>
  );
}
