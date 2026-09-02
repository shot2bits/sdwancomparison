import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ShortlistBuilder from "@/components/ShortlistBuilder";
import { BEST_PAGES } from "@/lib/best-pages";
import { buildShortlist, DEFAULT_INPUT } from "@/lib/shortlist-core";
import { FEATURES, FEATURE_CATEGORIES as FEATURE_CATEGORIES_LIST } from "@/lib/vendors";
import { SHORTLIST_FAQS, SHORTLIST_INTRO } from "@/lib/shortlist-content";
import { GOVERNED_SHORTLIST_CONTRACT_VERSION } from "@/lib/governed-provider-catalogue";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getShortlistDatasetSchema,
  getShortlistFaqSchema,
  getShortlistWebApplicationSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Best SD-WAN and SASE Providers (2026): Compare the Market, Build a Shortlist",
  description:
    "Compare 30 SD-WAN providers, SD-WAN vendors, SASE providers and managed services using Netify's evidence-graded capability data. Build a shortlist and continue to an RFP.",
  alternates: { canonical: `${SITE_URL}/shortlist/` },
  openGraph: {
    title: "Best SD-WAN and SASE Providers (2026): Compare the Market, Build a Shortlist",
    description:
      "Compare 30 SD-WAN and SASE providers using Netify's evidence-graded capability data, then build a shortlist and continue to an RFP.",
    url: `${SITE_URL}/shortlist/`,
    type: "website",
    locale: "en_GB",
  },
};

export const dynamic = "force-dynamic";

export default async function ShortlistPage() {
  const live = await getLiveShortlistDataset();
  const vendors = live.vendors;
  const verified = vendors.map((v) => v.last_verified).sort().slice(-1)[0] ?? "";
  const features = FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category, description: f.description }));
  const defaultRanking = buildShortlist(
    vendors,
    { ...DEFAULT_INPUT, shortlist_size: vendors.length },
    Object.fromEntries(features.map((feature) => [feature.id, feature.name])),
  ).shortlist;

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Shortlist builder", "/shortlist/"),
    getSpeakableSchema("/shortlist/"),
    getShortlistWebApplicationSchema(),
    getShortlistDatasetSchema(vendors.length, features.length, verified),
    getShortlistFaqSchema(SHORTLIST_FAQS),
    {
      "@context": "https://schema.org", "@type": "ItemList", name: "SD-WAN and SASE providers ranked by Netify",
      numberOfItems: defaultRanking.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: defaultRanking.map((provider) => ({ "@type": "ListItem", position: provider.rank, url: provider.marketplace_url, name: provider.name, description: provider.shortlist_summary })),
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

      <div className="mb-10 max-w-3xl fade-rise">
        <p className="eyebrow mb-3">{SHORTLIST_INTRO.eyebrow}</p>
        <h1 id="page-h1" className="mb-4">{SHORTLIST_INTRO.h1}</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          {SHORTLIST_INTRO.subhead}
        </p>
        <section className="mt-5 rounded-lg border border-[var(--ink-200,#e8ebef)] bg-[var(--ink-50,#f6f8fa)] p-4" aria-labelledby="top-sd-wan-providers">
          <h2 id="top-sd-wan-providers" className="text-lg">Top SD-WAN providers at a glance</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-700)]">
            At the current balanced setting, the first ten providers are listed below. Change the requirements to recalculate the order against the same governed evidence.
          </p>
          <ol className="mt-3 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-sm">
            {defaultRanking.slice(0, 10).map((provider) => (
              <li key={provider.slug}>
                <span className="mr-1 text-[var(--ink-500)]">{provider.rank}.</span>
                <a href={provider.marketplace_url!} className="font-medium underline underline-offset-4">{provider.name}</a>
              </li>
            ))}
          </ol>
        </section>
        <p className="mt-4 text-base leading-7 text-[var(--ink-800)]">
          <strong>Short answer:</strong> compare 30 SD-WAN providers, SD-WAN vendors, SASE providers, carriers and managed services using one governed research dataset. Build a ranked shortlist, compare two providers feature by feature, or open each evidence profile before issuing an RFP.
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
          {" "}<a href="/sase/shortlist/cite.bib" className="underline">Cite this dataset</a>.
        </p>
      </div>

      {/* useSearchParams() inside ShortlistBuilder (fix, 10 Aug 2026: the
          builder now reacts to URL changes after mount, not just the first
          one) requires a Suspense boundary here to keep this page
          statically prerendered rather than opting the whole route into
          per-request dynamic rendering. */}
      <Suspense fallback={null}>
        <ShortlistBuilder vendors={vendors} features={features} />
      </Suspense>

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
