import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import ShortlistBuilder from "@/components/ShortlistBuilder";
import { BEST_PAGES } from "@/lib/best-pages";
import { FEATURES, FEATURE_CATEGORIES as FEATURE_CATEGORIES_LIST } from "@/lib/vendors";
import { SHORTLIST_FAQS, SHORTLIST_INTRO } from "@/lib/shortlist-content";
import { GOVERNED_SHORTLIST_CONTRACT_VERSION } from "@/lib/governed-provider-catalogue";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import {
  buildShortlistMarketView,
  firstUnconfirmedDecision,
  parseShortlistMarketView,
  SHORTLIST_VIEW_CONTRACT_VERSION,
  SHORTLIST_VIEW_KEYS,
  SHORTLIST_VIEWS,
} from "@/lib/shortlist-market-views";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getShortlistDatasetSchema,
  getShortlistFaqSchema,
  getShortlistWebApplicationSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const query = await searchParams;
  const view = parseShortlistMarketView(typeof query.view === "string" ? query.view : undefined);
  const viewTitle = SHORTLIST_VIEWS[view].title;
  const title = `${viewTitle} (2026): 30-Provider Research Dataset`;
  const description = `${SHORTLIST_VIEWS[view].answer} Compare public evidence and publish a short project to unlock personalised matches.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/shortlist/` },
    openGraph: { title, description, url: `${SITE_URL}/shortlist/`, type: "website", locale: "en_GB" },
  };
}

export const dynamic = "force-dynamic";

export default async function ShortlistPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const selectedView = parseShortlistMarketView(typeof query.view === "string" ? query.view : undefined);
  const live = await getLiveShortlistDataset();
  const vendors = live.vendors;
  const verified = vendors.map((v) => v.last_verified).sort().slice(-1)[0] ?? "";
  const features = FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category, description: f.description }));
  const viewRanking = buildShortlistMarketView(vendors, selectedView);
  const sourceBySlug = new Map(vendors.map((provider) => [provider.slug, provider]));

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Shortlist builder", "/shortlist/"),
    getSpeakableSchema("/shortlist/"),
    getShortlistWebApplicationSchema(),
    getShortlistDatasetSchema(vendors.length, features.length, verified),
    getShortlistFaqSchema(SHORTLIST_FAQS),
    { "@context": "https://schema.org", "@type": "WebPage", name: SHORTLIST_VIEWS[selectedView].title, url: selectedView === "all" ? `${SITE_URL}/shortlist/` : `${SITE_URL}/shortlist/${selectedView}/`, dateModified: verified },
    {
      "@context": "https://schema.org", "@type": "ItemList", name: "SD-WAN and SASE providers ranked by Netify",
      numberOfItems: viewRanking.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: viewRanking.map((provider) => ({ "@type": "ListItem", position: provider.rank, url: provider.marketplace_url, name: provider.name, description: provider.shortlist_summary })),
    },
    // The 40 capability definitions as a DefinedTermSet, mirroring the
    // visible glossary below so AI engines can quote a row's meaning
    // rather than guessing it from the label (Robert, 17 July 2026).
    {
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      "@id": `${SITE_URL}/shortlist/#capability-definitions`,
      name: "Netify SD-WAN and SASE capability definitions",
      description: "One-sentence definitions of the 40 evidence-graded capabilities used across the Netify shortlist builder, vendor profiles and ranked comparisons.",
      hasDefinedTerm: FEATURES.map((f) => ({
        "@type": "DefinedTerm",
        "@id": `${SITE_URL}/shortlist/#${f.id}`,
        name: f.name,
        description: f.description,
        inDefinedTermSet: `${SITE_URL}/shortlist/#capability-definitions`,
      })),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}

      <div className="mb-8 max-w-4xl fade-rise">
        <p className="eyebrow mb-3">{SHORTLIST_INTRO.eyebrow}</p>
        <h1 id="page-h1" className="mb-4">{SHORTLIST_INTRO.h1}</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          {SHORTLIST_INTRO.subhead}
        </p>
      </div>

      <aside
        aria-label="Netify RFP Builder"
        className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-5 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="font-medium text-zinc-900">
          Find providers for your SASE or SD-WAN project. A full RFP is optional.
        </p>
        <a
          href="https://netify.co.uk/sase-sd-wan-rfp-builder/"
          className="inline-flex shrink-0 items-center gap-2 font-semibold text-zinc-950 underline decoration-amber-500 decoration-2 underline-offset-4"
        >
          Start my project
          <span aria-hidden="true">→</span>
        </a>
      </aside>

      {/* The comparison, requirements and RFP routes are the primary user
          task, so they appear before the supporting research content. */}
      <Suspense fallback={null}>
        <ShortlistBuilder vendors={vendors} features={features} initialView={selectedView} />
      </Suspense>

      <div className="mb-8 max-w-4xl">
        <p className="mt-4 text-base leading-7 text-[var(--ink-800)]">
          <strong>Short answer:</strong> compare 30 SD-WAN providers, SD-WAN vendors, SASE providers, carriers and managed services using one governed research dataset. Compare named providers feature by feature or open their evidence profiles. Publish a short anonymous project to unlock personalised matching and supplier responses.
        </p>
        {/* The offer in one glance (Robert, 17 July 2026), server-rendered
            so agents and crawlers read it alongside the ranking data. */}
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> Free for buyers</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> No sales calls until you reply</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> Pricing private to you</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> No obligation to award</li>
        </ul>
        <p className="text-sm text-[var(--ink-500)] mt-3">
          Written and reviewed by the Netify research team. The governed provider records were last updated on {verified}. Comparison contract {GOVERNED_SHORTLIST_CONTRACT_VERSION}. To act on a shortlist, describe the project once at{" "}
          <a href="https://netify.co.uk/sase-sd-wan-rfp-builder/" className="underline">the Netify RFP Builder</a>
          {", "}raise it to a full RFP and publish to the providers it names, then
          compare structured responses, with pricing kept private to the buyer.
          {" "}<a href="/sase/shortlist/research-methodology/" className="underline">Read and cite the research method</a>.
        </p>
      </div>

      <section className="mb-8" aria-labelledby="market-view-title">
        <div className="flex flex-wrap gap-2" aria-label="Provider market view">
          {SHORTLIST_VIEW_KEYS.map((view) => (
            <Link
              key={view}
              href={view === "all" ? "/shortlist/" : `/shortlist/${view}/`}
              aria-current={selectedView === view ? "page" : undefined}
              className={`rounded-full border px-4 py-2 text-sm font-medium no-underline ${selectedView === view ? "border-zinc-950 bg-zinc-950 text-white" : "border-[var(--ink-300,#ccc)] hover:border-zinc-950"}`}
            >
              {SHORTLIST_VIEWS[view].label}
            </Link>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-[var(--ink-200,#e8ebef)] bg-[var(--ink-50,#f6f8fa)] p-5">
          <p className="eyebrow mb-2">2026 market answer</p>
          <h2 id="market-view-title" className="text-xl">{SHORTLIST_VIEWS[selectedView].title}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--ink-700)]">{SHORTLIST_VIEWS[selectedView].answer}</p>
          <p className="mt-2 text-xs text-[var(--ink-500)]">{viewRanking.length} eligible providers. Reviewed {verified}. View contract {SHORTLIST_VIEW_CONTRACT_VERSION}.</p>
        </div>
      </section>

      <section className="mb-10" aria-labelledby="leading-providers-title">
        <p className="eyebrow mb-2">Leading providers</p>
        <h2 id="leading-providers-title" className="text-xl">Provider, product and differentiator</h2>
        <ul className="mt-4 grid list-none gap-3 p-0 md:grid-cols-2">
          {viewRanking.slice(0, 10).map((provider) => {
            const source = sourceBySlug.get(provider.slug)!;
            return <li key={provider.slug} className="rounded-lg border border-[var(--ink-200,#e8ebef)] p-4 text-sm leading-6">
              <a className="font-semibold underline underline-offset-4" href={provider.marketplace_url!}>{provider.name}</a>
              {source.product_focus ? ` (${source.product_focus})` : ""}: {provider.key_differentiators[0] || provider.shortlist_summary}
            </li>;
          })}
        </ul>
      </section>

      <section className="mb-10 overflow-hidden rounded-lg border border-[var(--ink-300,#d5d9df)]" aria-labelledby="comparison-summary-title">
        <div className="border-b border-[var(--ink-200,#e8ebef)] bg-white px-5 py-4">
          <p className="eyebrow mb-1">Comparison summary</p>
          <h2 id="comparison-summary-title" className="text-xl">Leading {SHORTLIST_VIEWS[selectedView].label.toLowerCase()} at a glance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[58rem] border-collapse text-left text-sm">
            <caption className="sr-only">Comparative overview of {viewRanking.length} {SHORTLIST_VIEWS[selectedView].label.toLowerCase()}, updated {verified}</caption>
            <thead className="bg-[var(--ink-50,#f6f8fa)]">
              <tr>{["Rank and provider", "Type", "Products", "Best suited to", "Main strength", "Confirm through RFP", "Reviewed"].map((heading) => <th key={heading} scope="col" className="border-b px-4 py-3 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {viewRanking.slice(0, 10).map((provider) => {
                const source = sourceBySlug.get(provider.slug)!;
                return <tr key={provider.slug} className="align-top even:bg-[var(--ink-50,#f8f9fa)]">
                  <td className="border-b px-4 py-3 font-medium"><span className="mr-2 text-[var(--ink-500)]">{provider.rank}</span><a className="underline underline-offset-4" href={provider.marketplace_url!}>{provider.name}</a></td>
                  <td className="border-b px-4 py-3">{provider.category}</td>
                  <td className="border-b px-4 py-3">{source.product_focus || "Product names are listed in the full profile."}</td>
                  <td className="border-b px-4 py-3">{provider.best_fit_for[0] || provider.shortlist_summary}</td>
                  <td className="border-b px-4 py-3">{provider.key_differentiators[0] || provider.shortlist_summary}</td>
                  <td className="border-b px-4 py-3">{firstUnconfirmedDecision(source)}</td>
                  <td className="border-b px-4 py-3 whitespace-nowrap">{provider.last_verified}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-[var(--ink-600,#555)]">The table uses governed provider records. Unknown evidence is shown as a point to confirm, not a negative score.</p>
      </section>

      <figure className="mb-10 rounded-lg border border-[var(--ink-200,#e8ebef)] p-4">
        <Image unoptimized width={1200} height={675} src={`/sase/shortlist/comparison-chart.png?view=${selectedView}`} alt={`Comparison chart for the leading ${SHORTLIST_VIEWS[selectedView].label.toLowerCase()}, ranked by the Netify governed evidence score`} className="h-auto w-full" />
        <figcaption className="mt-2 text-xs text-[var(--ink-600)]">Leading providers by the selected governed evidence score. Use the table above for the underlying decision fields.</figcaption>
      </figure>

      <section className="mt-20">
        <p className="eyebrow mb-3">Ranked shortlists</p>
        <h2 className="mb-4">Pre-built rankings by sector, size and priority</h2>
        <div className="flex flex-wrap gap-2">
          {BEST_PAGES.map((bp) => (
            <Link
              key={bp.slug}
              href={`/best/${bp.slug}/`}
              className="px-3.5 py-1.5 text-sm rounded-full border border-[var(--ink-300,#ccc)] no-underline hover:border-[var(--ink-900)]"
            >
              {bp.title.replace("Best SD-WAN and SASE providers for ", "")}
            </Link>
          ))}
        </div>
      </section>

      {/* The 40 capabilities, defined. Server-rendered and indexable: one
          fact-checked sentence per capability, derived from the grading
          definitions in data/feature-definitions.json, so buyers and AI
          engines read what each row measures rather than guessing from the
          label. Mirrored in the DefinedTermSet JSON-LD above and served in
          /shortlist/data.json for agents. */}
      <section className="mt-20" id="capability-definitions">
        <p className="eyebrow mb-3">Definitions</p>
        <h2 className="mb-2">The 40 capabilities, defined</h2>
        <p className="text-sm text-[var(--ink-600,#555)] mb-6 max-w-3xl">
          Every provider is graded against the same 40 capabilities. One sentence on what each row
          measures; grades reflect public evidence, so always confirm via RFP.
        </p>
        {/* One <details> per category. Native, so every definition stays in
            the server HTML for crawlers and assistants; only the visual state
            collapses. No JavaScript reveal. */}
        {FEATURE_CATEGORIES_LIST.map((cat) => (
          <details key={cat} className="mb-2 border border-[var(--ink-200,#e8ebef)] rounded-lg overflow-hidden group">
            <summary className="cursor-pointer list-none px-4 py-3 bg-[var(--ink-50,#f6f8fa)] hover:bg-[var(--ink-100,#eef1f5)] flex items-baseline gap-3">
              <span aria-hidden="true" className="text-[var(--ink-500)] text-xs transition-transform group-open:rotate-90">▶</span>
              <span className="flex-1">
                <h3 className="text-base font-medium inline">{cat}</h3>{" "}
                <span className="text-sm text-[var(--ink-600,#5b636e)]">
                  {FEATURES.filter((f) => f.category === cat).length} capabilities
                </span>
              </span>
            </summary>
            <dl className="space-y-2 max-w-3xl px-4 py-4">
              {FEATURES.filter((f) => f.category === cat).map((f) => (
                <div key={f.id} id={f.id}>
                  <dt className="text-sm font-medium inline">{f.name}.</dt>{" "}
                  <dd className="text-sm text-[var(--ink-700)] inline">{f.description}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </section>

      <section className="mt-20 max-w-3xl">
        <p className="eyebrow mb-3">Questions</p>
        <h2 className="mb-6">How the shortlist builder works</h2>
        {/* Each question its own <details>. The answers remain in the served
            HTML and in the FAQPage JSON-LD above, so nothing is hidden from a
            machine; the page just stops being a wall of text. */}
        <div className="space-y-2">
          {SHORTLIST_FAQS.map((f) => (
            <details key={f.q} className="border border-[var(--ink-200,#e8ebef)] rounded-lg overflow-hidden group">
              <summary className="cursor-pointer list-none px-4 py-3 bg-[var(--ink-50,#f6f8fa)] hover:bg-[var(--ink-100,#eef1f5)] flex items-baseline gap-3">
                <span aria-hidden="true" className="text-[var(--ink-500)] text-xs transition-transform group-open:rotate-90">▶</span>
                <h3 className="text-base font-medium flex-1">{f.q}</h3>
              </summary>
              <p className="text-sm text-[var(--ink-700)] px-4 py-4">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
