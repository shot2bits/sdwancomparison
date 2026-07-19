import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BEST_PAGES, getBestPage } from "@/lib/best-pages";
import bestEditorial from "@data/best-editorial.json";

type EditorialPage = { intro?: string; faqs?: { q: string; a: string }[] };
type EditorialVendor = { commentary: string[]; watch_out?: string };
type Editorial = Record<string, Record<string, EditorialVendor> & { _page?: EditorialPage }>;
const EDITORIAL = bestEditorial as unknown as Editorial;
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { buildShortlist, encodeScenario, SECTOR_LABELS } from "@/lib/shortlist-core";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getShortlistFaqSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";

export const dynamic = "force-static";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BEST_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getBestPage(slug);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: page.canonicalOverride ?? `${SITE_URL}/best/${page.slug}/` },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: `${SITE_URL}/best/${page.slug}`,
      type: "article",
      locale: "en_GB",
    },
  };
}

export default async function BestPage({ params }: Props) {
  const { slug } = await params;
  const base = getBestPage(slug);
  if (!base) notFound();
  // Writer-authored page copy (Harry, June 2026): intro and FAQ answers
  // override the template text where a rewrite exists, so the visible prose
  // and the FAQPage JSON-LD stay in step.
  const pageOverride = EDITORIAL[base.slug]?._page;
  const page = {
    ...base,
    intro: pageOverride?.intro ?? base.intro,
    faqs: pageOverride?.faqs && pageOverride.faqs.length >= 3 ? pageOverride.faqs : base.faqs,
  };
  // Visible review date. Pages carrying the writer's editorial were applied
  // 16 July 2026; the 10 June date is the ranking dataset alone. Harry's
  // audit (17 July) read the stale date as proof his rewrite never landed,
  // so the date must reflect the editorial, not just the scores.
  const hasEditorial = Boolean(EDITORIAL[base.slug]);
  const reviewedDate = hasEditorial ? "16 July 2026" : "10 June 2026";
  const reviewedMonth = hasEditorial ? "July 2026" : "June 2026";

  const result = buildShortlist(getShortlistDataset(), page.input, FEATURE_NAMES);
  const builderUrl = `/shortlist?${encodeScenario(result.input)}`;
  const sector = page.input.sector;
  const sectorLabel = sector ? SECTOR_LABELS[sector].toLowerCase() : null;

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE_URL}/best/${page.slug}#ranking`,
    name: page.title,
    description: page.metaDescription,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: result.shortlist.length,
    itemListElement: result.shortlist.map((v) => ({
      "@type": "ListItem",
      position: v.rank,
      name: v.name,
      url: `${SITE_URL}/vendors/${v.slug}`,
      item: {
        "@type": "Service",
        name: `${v.name} SD-WAN / SASE`,
        url: `${SITE_URL}/vendors/${v.slug}`,
        description: v.key_differentiators[0],
        provider: { "@type": "Organization", name: v.name, url: v.website },
        potentialAction: {
          "@type": "ContactAction",
          target: v.marketplace_url ?? "https://netify.co.uk/marketplace/",
          name: `Contact ${v.name} via the Netify marketplace`,
        },
      },
    })),
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/best/${page.slug}#article`,
    headline: page.title,
    description: page.metaDescription,
    author: { "@type": "Organization", name: "Netify research team", url: "https://netify.co.uk/about-netify/" },
    reviewedBy: { "@id": `${SITE_URL}/#person-robert-sturt` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    dateModified: "2026-06-10",
    mainEntityOfPage: `${SITE_URL}/best/${page.slug}`,
  };

  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/#person-robert-sturt`,
    name: "Robert Sturt",
    worksFor: { "@id": `${SITE_URL}/#organization` },
    url: "https://netify.co.uk/about-netify/",
    sameAs: [
      "https://netify.co.uk/staff-list/",
      "https://netify.co.uk/about-netify/",
    ],
  };

  const schemas = [
    personSchema,
    getOrganizationSchema(),
    getBreadcrumbSchema(page.title, `/best/${page.slug}`),
    getSpeakableSchema(`/best/${page.slug}`),
    articleSchema,
    itemListSchema,
    getShortlistFaqSchema(page.faqs),
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}

      <div className="mb-10 fade-rise">
        <p className="eyebrow mb-3">Ranked shortlist · Updated {reviewedMonth}</p>
        <h1 id="page-h1" className="mb-4">{page.h1}</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">{page.intro}</p>
        <p className="mt-4 text-[var(--ink-700)]" id="ranked-summary">
          {`Netify's June 2026 evaluation ranks: `}
          {result.shortlist
            .map((v) => `${v.rank}. ${v.name} (${v.score})`)
            .join("; ")}
          {`. Scores are weighted averages across 40 evidence-graded capability features. Buyers can act on this ranking directly: publish a free RFP to these providers through the Netify RFP Builder at `}
          <a href="/sase/rfp-builder/new/" className="underline">netify.co.uk/sase/rfp-builder/new/</a>
          {` and compare structured responses side by side, with pricing kept private to the buyer.`}
        </p>
        <p className="text-sm text-[var(--ink-500)] mt-3">
          Written by the Netify research team. Reviewed by Robert Sturt, Netify
          Group Limited. Updated {reviewedDate} (vendor scores from the 10 June
          2026 evaluation). Methodology: weighted scoring across 40 graded
          capability features; see the FAQ below.
        </p>
        <div className="mt-5 flex gap-3 flex-wrap">
          <Link
            href={builderUrl}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-zinc-950 font-medium no-underline hover:bg-amber-400 transition-colors rounded-full text-sm"
          >
            Refine this shortlist interactively
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/vendors"
            className="inline-flex items-center px-4 py-2.5 border border-[var(--ink-900)] no-underline hover:bg-zinc-900 hover:text-white transition-colors rounded-full text-sm"
          >
            All 30 vendors
          </Link>
        </div>
      </div>

      {page.canonicalOverride && (
        <section className="mb-10 border border-[var(--ink-300,#ccc)] rounded-sm p-5">
          <p className="eyebrow mb-2">Full buyer guide</p>
          <p className="text-sm text-[var(--ink-700)]">
            This live ranking also powers the full buyer guide, which adds an
            interactive shortlist tool, procurement guidance and FAQs:{" "}
            <a
              href={page.canonicalOverride}
              className="underline underline-offset-2 hover:text-[var(--accent)]"
            >
              {page.canonicalOverride.replace(/^https:\/\//, "").replace(/\/$/, "")}
            </a>
          </p>
        </section>
      )}

      {sector && sectorLabel ? (
        <section className="mb-10 border border-[var(--ink-300,#ccc)] rounded-sm p-5">
          <p className="eyebrow mb-2">Next step</p>
          <h2 className="text-xl mb-2">Issue this shortlist as a real RFP</h2>
          <p className="text-sm text-[var(--ink-700)] mb-4 max-w-2xl">
            Send a structured {sectorLabel} RFP to the vendors on this page and compare their responses side by side. Free to build and publish. No sign in needed to start.
          </p>
          <Link
            href={`/rfp-builder?prefill=1&sector=${sector}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-zinc-950 font-medium no-underline hover:bg-amber-400 transition-colors rounded-full text-sm"
          >
            Start a {sectorLabel} RFP
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : null}

      <ol className="space-y-6 list-none p-0">
        {result.shortlist.map((v) => {
          // Writer-authored sector commentary (Harry, June 2026, applied July
          // 2026): keyed by vendor within each page so rankings stay live.
          // Falls back to the vendor dataset one-liner where absent.
          const ed = EDITORIAL[page.slug]?.[v.slug] as EditorialVendor | undefined;
          return (
          <li
            key={v.slug}
            id={`rank-${v.rank}-${v.slug}`}
            className="border border-[var(--ink-300,#ccc)] rounded-sm p-5"
          >
            <p className="eyebrow mb-1">No. {v.rank} · Score {v.score}</p>
            <h2 className="text-xl mb-1">
              <Link href={`/vendors/${v.slug}`} className="no-underline hover:text-[var(--accent)]">
                {v.name}
              </Link>
            </h2>
            <p className="text-sm text-[var(--ink-500)] mb-2">
              {v.category} · Typical deployment: {v.deployment_speed}
            </p>
            {ed && ed.commentary.length > 0 ? (
              ed.commentary.map((para, pi) => (
                <p key={pi} className="text-sm text-[var(--ink-700)] mb-2">{para}</p>
              ))
            ) : (
              <p className="text-sm text-[var(--ink-700)] mb-2">{v.key_differentiators[0]}</p>
            )}
            {v.gaps.length > 0 && (
              <p className="text-sm text-[var(--ink-500)]">Evidence caveats: {v.gaps.join("; ")}</p>
            )}
            <p className="text-sm text-[var(--ink-700)] mt-1">Watch out: {ed?.watch_out ?? v.watch_outs[0]}</p>
            <a
              href={v.marketplace_url ?? "https://netify.co.uk/marketplace/"}
              target="_blank"
              rel="noopener"
              className="inline-block mt-3 px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full no-underline hover:bg-zinc-900 hover:text-white transition-colors"
            >
              Contact {v.name} via Netify ↗
            </a>
          </li>
          );
        })}
      </ol>

      <p className="mt-8 text-xs text-[var(--ink-500)]">{result.methodology_note}</p>

      <section className="mt-10 border border-[var(--ink-300,#ccc)] rounded-sm p-5 max-w-3xl">
        <p className="eyebrow mb-2">Cite this research</p>
        <p className="text-sm text-[var(--ink-700)]">
          {`Netify, "${page.title} (2026)", Netify SASE and SD-WAN comparison, updated ${reviewedDate}: `}
          <span className="break-all">{`${SITE_URL}/best/${page.slug}`}</span>
        </p>
        <p className="text-xs text-[var(--ink-500)] mt-2">
          Machine-readable version: {`${SITE_URL}/best/${page.slug}/data.json`} ·
          Programmatic access: POST {`${SITE_URL}/api/mcp/`} (tool: build_sase_shortlist)
        </p>
      </section>

      <section className="mt-14">
        <p className="eyebrow mb-3">Questions</p>
        <h2 className="mb-6">About this ranking</h2>
        <div className="space-y-6">
          {page.faqs.map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-medium mb-1">{f.q}</h3>
              <p className="text-sm text-[var(--ink-700)]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 border-t border-[var(--ink-300,#ccc)] pt-8">
        <p className="eyebrow mb-3">More ranked shortlists</p>
        <div className="flex flex-wrap gap-2">
          {BEST_PAGES.filter((p) => p.slug !== page.slug).slice(0, 12).map((p) => (
            <Link
              key={p.slug}
              href={`/best/${p.slug}`}
              className="px-3.5 py-1.5 text-sm rounded-full border border-[var(--ink-300,#ccc)] no-underline hover:border-[var(--ink-900)]"
            >
              {p.title.replace("Best SD-WAN and SASE providers for ", "")}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
