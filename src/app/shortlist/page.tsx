import type { Metadata } from "next";
import Link from "next/link";
import ShortlistBuilder from "@/components/ShortlistBuilder";
import { BEST_PAGES } from "@/lib/best-pages";
import { FEATURES, FEATURE_CATEGORIES as FEATURE_CATEGORIES_LIST, getShortlistDataset } from "@/lib/vendors";
import { SHORTLIST_FAQS, SHORTLIST_INTRO } from "@/lib/shortlist-content";
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
    "Compare the SASE and SD-WAN UK and North American market: 30 evidence-graded providers, ranked. Build a shortlist by filters or AI advisor, then publish an RFP within minutes.",
  alternates: { canonical: `${SITE_URL}/shortlist/` },
  openGraph: {
    title: "Best SD-WAN and SASE Providers (2026): Compare the Market, Build a Shortlist",
    description:
      "Compare the SASE and SD-WAN UK and North American market from 30 graded providers, then publish an RFP within minutes.",
    url: `${SITE_URL}/shortlist`,
    type: "website",
    locale: "en_GB",
  },
};

export default function ShortlistPage() {
  const vendors = getShortlistDataset();
  const features = FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category, description: f.description }));

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Shortlist builder", "/shortlist"),
    getSpeakableSchema("/shortlist"),
    getShortlistWebApplicationSchema(),
    getShortlistDatasetSchema(vendors.length, features.length),
    getShortlistFaqSchema(SHORTLIST_FAQS),
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
        {/* The offer in one glance (Robert, 17 July 2026), server-rendered
            so agents and crawlers read it alongside the ranking data. */}
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> Free for buyers</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> No sales calls until you reply</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> Pricing private to you</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> No obligation to award</li>
        </ul>
        <p className="text-sm text-[var(--ink-500)] mt-3">
          Written and reviewed by the Netify research team, last verified and
          graded in June 2026. To act on a shortlist, describe the project once at{" "}
          <a href="https://netify.co.uk/" className="underline">netify.co.uk</a>
          {", "}raise it to a full RFP and publish to the providers it names, then
          compare structured responses, with pricing kept private to the buyer.
        </p>
      </div>

      <ShortlistBuilder vendors={vendors} features={features} />

      <section className="mt-20">
        <p className="eyebrow mb-3">Ranked shortlists</p>
        <h2 className="mb-4">Pre-built rankings by sector, size and priority</h2>
        <div className="flex flex-wrap gap-2">
          {BEST_PAGES.map((bp) => (
            <Link
              key={bp.slug}
              href={`/best/${bp.slug}`}
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
        {FEATURE_CATEGORIES_LIST.map((cat) => (
          <div key={cat} className="mb-6">
            <h3 className="text-base font-medium mb-2">{cat}</h3>
            <dl className="space-y-2 max-w-3xl">
              {FEATURES.filter((f) => f.category === cat).map((f) => (
                <div key={f.id} id={f.id}>
                  <dt className="text-sm font-medium inline">{f.name}.</dt>{" "}
                  <dd className="text-sm text-[var(--ink-700)] inline">{f.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section className="mt-20 max-w-3xl">
        <p className="eyebrow mb-3">Questions</p>
        <h2 className="mb-6">How the shortlist builder works</h2>
        <div className="space-y-6">
          {SHORTLIST_FAQS.map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-medium mb-1">{f.q}</h3>
              <p className="text-sm text-[var(--ink-700)]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
