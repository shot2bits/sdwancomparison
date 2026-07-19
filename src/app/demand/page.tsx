import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema } from "@/lib/structured-data";
import { getDemandIndex, SUPPRESSION_MIN, type DemandIndex } from "@/lib/demand-index";

/**
 * The Netify Demand Index (19 July 2026): the public, weekly, first-party
 * record of what companies are actually buying on the marketplace. Sector and
 * technology mix, the procurement funnel and a compounding weekly trend, all
 * anonymised counts from the live RFP and opportunity stores. Fresh, unique,
 * citable: the page assistants can quote for "what are companies buying".
 */

export const metadata: Metadata = {
  title: "Netify SASE & SD-WAN Demand Index: what companies are actually buying",
  description:
    "Live, anonymised demand data from the Netify procurement marketplace: SASE, SSE and SD-WAN projects by sector and technology, the publish funnel and weekly trend. First-party counts, refreshed continuously, snapshotted weekly.",
  alternates: { canonical: `${SITE_URL}/demand/` },
  openGraph: {
    title: "Netify SASE & SD-WAN Demand Index",
    description:
      "What companies are actually buying: live marketplace demand by sector and technology, anonymised, updated weekly.",
    url: `${SITE_URL}/demand/`,
    type: "website",
    locale: "en_GB",
  },
  robots: { index: true, follow: true },
};

export const revalidate = 1800;

const FAQS = [
  {
    question: "What is the Netify Demand Index?",
    answer:
      "A live, anonymised record of demand on the Netify SASE and SD-WAN procurement marketplace: how many buyer projects exist, which sectors and technologies they cover, how many progress to a published RFP, and how that changes week by week. It is computed from the marketplace's own stores, not from surveys or analyst estimates.",
  },
  {
    question: "Where does the data come from?",
    answer:
      "From RFPs and project notices created on the Netify marketplace. Only counts and percentage shares are published: no project titles, no company names, no contact details and no free text. Percentage shares appear only once a sample reaches the suppression minimum; smaller samples are reported as plain counts and described as such.",
  },
  {
    question: "How often does the index update?",
    answer:
      "Continuously. The page recomputes from the live stores with a short cache, and a snapshot is recorded each ISO week to build the trend series. The machine-readable feed at /sase/demand/data.json and the get_demand_index MCP tool serve the same numbers.",
  },
];

function suggestedCitation(index: DemandIndex | null): string {
  const week = index?.meta.week ?? "current week";
  return `Netify SASE & SD-WAN Demand Index, ${week}, Netify Group Limited, https://netify.co.uk/sase/demand/`;
}

export default async function DemandIndexPage() {
  const index = await getDemandIndex();

  const schemas: object[] = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Demand Index", "/demand"),
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "@id": `${SITE_URL}/demand/#dataset`,
      name: "Netify SASE & SD-WAN Demand Index",
      description:
        "Anonymised weekly demand data from the Netify procurement marketplace: projects by sector and technology, publish funnel and weekly trend. Counts and suppressed shares only.",
      url: `${SITE_URL}/demand/`,
      creator: { "@type": "Organization", name: "Netify Group Limited", url: "https://netify.co.uk/" },
      license: "https://netify.co.uk/terms-conditions/",
      temporalCoverage: index ? `2026-06/${index.meta.computed_at.slice(0, 7)}` : "2026-06/..",
      distribution: [
        {
          "@type": "DataDownload",
          encodingFormat: "application/json",
          contentUrl: `${SITE_URL}/demand/data.json`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ];

  const w = index?.windows;
  const t = index?.totals;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <p className="eyebrow mb-2">Netify Research · live marketplace data</p>
      <h1 id="page-h1" className="mb-3">Netify SASE &amp; SD-WAN Demand Index</h1>
      <p id="answer" className="max-w-3xl text-lg text-[var(--ink-700)]">
        What companies are actually buying, from the only place that can see it first-hand: the Netify
        procurement marketplace. The index reports live, anonymised counts of buyer projects by sector and
        technology, how many progress to a published RFP, and the weekly trend.
        {index
          ? ` This is week ${index.meta.week}: ${index.totals.projects_all_time} projects on the marketplace to date, ${index.totals.published_all_time} published, ${index.totals.open_opportunities} open on the public board now.`
          : " The index is computing; figures appear here and in the data feed."}
      </p>
      <p className="mt-2 text-sm text-[var(--ink-500)]">
        {index?.meta.launch_note} Computed {index ? new Date(index.meta.computed_at).toUTCString() : "now"} ·
        methodology {index?.meta.methodology_version ?? "v2026.1"} · machine-readable:{" "}
        <a className="underline" href="/sase/demand/data.json">/sase/demand/data.json</a>
      </p>

      {index && (
        <>
          <section className="mt-10">
            <h2 className="text-xl mb-3">This week and the last 90 days</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
                <p className="text-2xl font-semibold">{w!.last_7_days.projects_created}</p>
                <p className="text-xs text-[var(--ink-500)]">projects started, last 7 days</p>
              </div>
              <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
                <p className="text-2xl font-semibold">{w!.last_7_days.projects_published}</p>
                <p className="text-xs text-[var(--ink-500)]">published, last 7 days</p>
              </div>
              <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
                <p className="text-2xl font-semibold">{w!.last_90_days.projects_created}</p>
                <p className="text-xs text-[var(--ink-500)]">projects started, last 90 days</p>
              </div>
              <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
                <p className="text-2xl font-semibold">{t!.open_opportunities}</p>
                <p className="text-xs text-[var(--ink-500)]">open on the public board now</p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-xl mb-3">The mix: sectors and technologies, last 90 days</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold mb-2 text-sm">By sector</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {index.sector_mix_90d.map((r) => (
                      <tr key={r.key} className="border-b border-[var(--ink-200,#e5e5e5)]">
                        <td className="py-1.5">{r.label}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {r.projects}{r.share_pct !== null ? ` (${r.share_pct}%)` : ""}
                        </td>
                      </tr>
                    ))}
                    {index.sector_mix_90d.length === 0 && (
                      <tr><td className="py-1.5 text-[var(--ink-500)]">No projects in the window yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-sm">By technology</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {index.technology_mix_90d.map((r) => (
                      <tr key={r.key} className="border-b border-[var(--ink-200,#e5e5e5)]">
                        <td className="py-1.5">{r.label}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {r.projects}{r.share_pct !== null ? ` (${r.share_pct}%)` : ""}
                        </td>
                      </tr>
                    ))}
                    {index.technology_mix_90d.length === 0 && (
                      <tr><td className="py-1.5 text-[var(--ink-500)]">No projects in the window yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--ink-500)]">
              Percentage shares appear once the 90-day sample reaches {SUPPRESSION_MIN} projects; until then the
              index reports plain counts.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xl mb-3">The funnel, since launch</h2>
            <p className="text-sm text-[var(--ink-700)] max-w-3xl">
              {index.funnel_all_time.created} projects created on the marketplace to date;{" "}
              {index.funnel_all_time.progressed_beyond_draft} progressed beyond draft;{" "}
              {index.funnel_all_time.published} published to suppliers
              {index.funnel_all_time.publish_rate_pct !== null
                ? ` (a publish rate of ${index.funnel_all_time.publish_rate_pct}%)`
                : ""}.
              A published RFP is the marketplace&apos;s unit of real demand: a structured requirement sent to
              matched, verified suppliers.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xl mb-3">What buyers mandate</h2>
            {index.what_buyers_mandate_90d.published ? (
              <div className="text-sm text-[var(--ink-700)] max-w-3xl space-y-2">
                {index.what_buyers_mandate_90d.delivery_model_share && (
                  <p>
                    Delivery model over the last three months: managed{" "}
                    {index.what_buyers_mandate_90d.delivery_model_share.managed}%, co-managed{" "}
                    {index.what_buyers_mandate_90d.delivery_model_share.co_managed}%, DIY{" "}
                    {index.what_buyers_mandate_90d.delivery_model_share.diy}%.
                  </p>
                )}
                {index.what_buyers_mandate_90d.top_security_components && (
                  <p>
                    Most-mandated security components:{" "}
                    {index.what_buyers_mandate_90d.top_security_components.join(", ")}.
                  </p>
                )}
                <p className="text-xs text-[var(--ink-500)]">{index.what_buyers_mandate_90d.note}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--ink-500)] max-w-3xl">{index.what_buyers_mandate_90d.note}</p>
            )}
          </section>

          {index.weekly_trend.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl mb-3">Weekly trend</h2>
              <table className="w-full max-w-xl text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--ink-500)]">
                    <th className="py-1.5 font-medium">Week</th>
                    <th className="py-1.5 font-medium text-right">Started (7d)</th>
                    <th className="py-1.5 font-medium text-right">Published (7d)</th>
                    <th className="py-1.5 font-medium text-right">Open on board</th>
                  </tr>
                </thead>
                <tbody>
                  {index.weekly_trend.map((s) => (
                    <tr key={s.week} className="border-b border-[var(--ink-200,#e5e5e5)]">
                      <td className="py-1.5">{s.week}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.projects_created_7d}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.projects_published_7d}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.open_opportunities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[var(--ink-500)]">
                One snapshot per ISO week; the series compounds as the marketplace runs.
              </p>
            </section>
          )}
        </>
      )}

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl mb-3">Methodology</h2>
        <p className="text-sm text-[var(--ink-700)]">
          The index is computed from the Netify marketplace&apos;s own stores: RFP projects (created, progressed,
          published) and public board opportunities. Publication counts use project status; where no separate
          publish timestamp exists, a published project&apos;s most recent update dates it within a window, and
          the index states that approximation. Anonymisation is structural: the computation reads sector,
          technology scope, status and dates only, and publishes counts and thresholded shares. No project
          titles, buyer identities, supplier identities or prices are read into the index at all. Suppression
          minimum for shares: {SUPPRESSION_MIN}.
        </p>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl mb-3">Cite this index</h2>
        <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base,#faf9f7)] p-3">
          <code className="block overflow-x-auto text-xs">{suggestedCitation(index)}</code>
        </div>
        <p className="mt-2 text-xs text-[var(--ink-500)]">
          Reuse permitted with attribution to Netify and the canonical URL. Machine-readable feed:{" "}
          <a className="underline" href="/sase/demand/data.json">/sase/demand/data.json</a> · callable as the{" "}
          <code>get_demand_index</code> tool on the{" "}
          <Link className="underline" href="/connector/">Netify assistant connector</Link>.
        </p>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl mb-3">Common questions</h2>
        {FAQS.map((f) => (
          <details key={f.question} className="group border-b border-[var(--ink-200,#e5e5e5)] py-3">
            <summary className="cursor-pointer font-medium">{f.question}</summary>
            <p className="mt-2 text-sm text-[var(--ink-700)]">{f.answer}</p>
          </details>
        ))}
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl mb-3">Add your demand to the index</h2>
        <p className="text-sm text-[var(--ink-700)]">
          Every project on the marketplace is counted anonymously here. Post a{" "}
          <Link className="underline" href="/opportunities/new/">project notice</Link> for early pricing and
          supplier interest, build a full{" "}
          <Link className="underline" href="/rfp-builder/new/">SASE / SD-WAN RFP</Link> in about two minutes, or
          browse the <Link className="underline" href="/opportunities/board/">open opportunity board</Link>.
        </p>
      </section>
    </div>
  );
}
