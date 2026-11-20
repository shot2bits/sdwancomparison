import type { Metadata } from "next";
import Link from "next/link";
import { listPublicOpportunities, listArchivedPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { listPublicOutcomes } from "@/lib/market-outcomes";
import { OPP_SCOPE_LABELS, type OppScope } from "@/lib/opportunity-types";
import BoardList from "@/components/BoardList";
import MarketOutcomeView from "@/components/MarketOutcomeView";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLE = "Live SASE and SD-WAN procurement opportunities board";
const DESCRIPTION = "Open, anonymised SD-WAN and SASE requirements from buyers. Curated vendors and providers can review a notice and respond. Company names appear only when the buyer has opted in.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/opportunities/board/` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/opportunities/board/`, type: "website", locale: "en_GB" },
};

export default async function OpportunityBoardPage() {
  const [allOpps, allArchived, outcomes] = kvConfigured()
    ? await Promise.all([
        listPublicOpportunities(),
        listArchivedPublicOpportunities(12),
        listPublicOutcomes().catch(() => []),
      ])
    : [[], [], []];
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Opportunity board", "/opportunities/board"),
    getSpeakableSchema("/opportunities/board"),
  ];
  const openCount = allOpps.length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Live marketplace</p>
        <h1 id="page-h1" className="mb-4">{TITLE}</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          This board lists {openCount} open requirement{openCount === 1 ? "" : "s"} right now, the same records as the machine-readable feed at <Link className="underline" href="/opportunities/board/data.json">data.json</Link>.
          Each notice is listed privately with Netify&apos;s curated vendors and providers. The public record does not include the company name unless the buyer has opted in. Names, emails, phone numbers and pricing stay off this page.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/opportunities/new" className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Publish a requirement</Link>
          <Link href="/rfp-bundle" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">Get an RFP and recommended providers</Link>
          <Link href="/for-suppliers" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">For vendors and providers</Link>
        </div>
      </div>

      <section className="mt-2" aria-labelledby="board-open">
        <h2 id="board-open" className="text-xl font-semibold mb-3">Open requirements</h2>
        {openCount === 0 ? <p>No open requirements are listed right now.</p> : <BoardList opps={allOpps} />}
      </section>

      {allArchived.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-1">Recently closed and awarded</h2>
          <p className="text-sm text-[var(--ink-600)] mb-4">Closed and awarded notices stay on the public record, with their status and close date. Responses and pricing are not shown.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {allArchived.map((o) => (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 no-underline text-inherit opacity-80 transition-opacity hover:opacity-100">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium uppercase tracking-wide ${o.status === "awarded" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--ink-100,#f0f0f0)] text-[var(--ink-500)]"}`}>
                    {o.status === "awarded" ? "Awarded" : "Closed"}
                  </span>
                  {o.closed_at && (
                    <span className="text-[var(--ink-500)]">
                      {new Date(o.closed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold leading-snug mb-1">{o.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {o.scope.map((s) => <span key={s} className="rounded-full border border-[var(--ink-200,#e5e5e5)] px-2 py-0.5 text-xs text-[var(--ink-600)]">{OPP_SCOPE_LABELS[s as OppScope] ?? s}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12">
        <h2 className="text-lg font-semibold mb-1">Worked examples</h2>
        <p className="text-sm text-[var(--ink-600)] mb-4">Three full-depth example procurements showing what a published notice looks like. Illustrative only, never open for response, never counted as live demand.</p>
        <div className="grid gap-4">
          {SAMPLE_NOTICES.map((s) => (
            <Link key={s.slug} href={`/opportunities/${s.slug}`} className="block rounded-lg border border-[var(--ink-200,#e5e5e5)] bg-white p-5 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-800">Worked example · not open for response</span>
                <span className="text-xs text-[var(--ink-500)]">{s.sites} sites · {s.users_band} users</span>
              </div>
              <h3 className="text-[15px] font-semibold leading-snug mb-1">{s.title}</h3>
              <p className="text-[13px] leading-relaxed text-[var(--ink-600)] line-clamp-3">{s.summary}</p>
            </Link>
          ))}
        </div>
      </div>

      <section className="mt-12" aria-labelledby="board-outcomes">
        <h2 id="board-outcomes" className="text-lg font-semibold mb-1">Approved sourcing outcomes</h2>
        <p className="text-sm text-[var(--ink-600)] mb-4">Separate from the live notices above, this record lists buyer-approved anonymous sourcing outcomes, including declines and incomplete outcomes. A submitted project does not appear here until the outcome has been reviewed and the buyer has approved publication.</p>
        {outcomes.length === 0 ? <p>No approved outcome records have been published yet.</p> : outcomes.map(record => <div key={record.id}><MarketOutcomeView record={record}/><Link href={`/shortlist/outcomes/${record.id}/`}>Read the outcome</Link></div>)}
      </section>
    </div>
  );
}
