import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { buildShortlist } from "@/lib/shortlist-core";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getShortlistFaqSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";
import { datasetVerifiedLong, datasetVerifiedMonth } from "@/lib/dataset-date";
import SourcedTable from "@/components/SourcedTable";

export const dynamic = "force-static";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getShortlistDataset().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const vendor = getShortlistDataset().find((v) => v.slug === slug);
  if (!vendor) return {};
  const longTitle = `Top ${vendor.name} alternatives (2026): 10 rivals ranked`;
  const title = longTitle.length <= 56 ? longTitle : `Top ${vendor.name} alternatives (2026)`;
  return {
    title,
    description: `The strongest SD-WAN and SASE alternatives to ${vendor.name} in 2026, ranked by Netify's 40-feature evidence matrix with scores and caveats.`,
    alternates: { canonical: `${SITE_URL}/alternatives/${slug}/` },
    openGraph: {
      title: `Top ${vendor.name} alternatives (2026)`,
      description: `The strongest SD-WAN and SASE alternatives to ${vendor.name}, ranked by evidence.`,
      url: `${SITE_URL}/alternatives/${slug}`,
      type: "article",
      locale: "en_GB",
    },
  };
}

export default async function AlternativesPage({ params }: Props) {
  const { slug } = await params;
  const all = getShortlistDataset();
  const vendor = all.find((v) => v.slug === slug);
  if (!vendor) notFound();

  const rivals = all.filter((v) => v.slug !== slug);
  const result = buildShortlist(rivals, { shortlist_size: 10 }, FEATURE_NAMES);
  const sameCategory = new Set(
    rivals.filter((v) => v.category === vendor.category).map((v) => v.slug),
  );

  const faqs = [
    {
      q: `What are the best alternatives to ${vendor.name}?`,
      a: `Ranked by the Netify 40-feature evidence matrix, verified ${datasetVerifiedLong()}, the strongest alternatives are listed above with scores. Close peers in the same category (${vendor.category}) are marked. The right alternative depends on your operating model, sector and regions, which the interactive shortlist builder scores for free.`,
    },
    {
      q: `Why do buyers look beyond ${vendor.name}?`,
      a: `Common reasons from the Netify evaluation include: ${vendor.watch_outs.slice(0, 2).join(" ")} Whether these matter depends on your estate; the ${vendor.name} profile carries the full evidence record.`,
    },
    {
      q: "How is this alternatives ranking calculated?",
      a: "Every provider is scored on the same published evidence grades across 40 capability features, with the subject vendor excluded. The ranking is deterministic and reproducible via the canonical URL, its JSON twin and the MCP tool.",
    },
  ];

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${SITE_URL}/alternatives/${slug}#ranking`,
    name: `Top ${vendor.name} alternatives (2026)`,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: result.shortlist.length,
    itemListElement: result.shortlist.map((v) => ({
      "@type": "ListItem",
      position: v.rank,
      name: v.name,
      url: `${SITE_URL}/vendors/${v.slug}`,
    })),
  };

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema(`${vendor.name} alternatives`, `/alternatives/${slug}`),
    getSpeakableSchema(`/alternatives/${slug}`),
    itemListSchema,
    getShortlistFaqSchema(faqs),
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
        <p className="eyebrow mb-3">Alternatives · Updated {datasetVerifiedMonth()}</p>
        <h1 id="page-h1" className="mb-4">
          Top {vendor.name} alternatives (2026): 10 rivals ranked
        </h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          {vendor.name} ({vendor.category}) scores well in the Netify matrix, and
          it is not right for every estate. Buyers commonly weigh these
          watch-outs: {vendor.watch_outs[0]} The 10 strongest alternatives are
          ranked below on the same 40-feature evidence grades.
        </p>
        <p className="mt-4 text-[var(--ink-700)]" id="ranked-summary">
          {`Netify's ${datasetVerifiedMonth()} evaluation ranks the top ${vendor.name} alternatives as: `}
          {result.shortlist.map((v) => `${v.rank}. ${v.name} (${v.score})`).join("; ")}.
        </p>
        <div className="mt-5 flex gap-3 flex-wrap">
          <Link
            href={`/vendors/${slug}`}
            className="inline-flex items-center px-4 py-2.5 border border-[var(--ink-900)] no-underline hover:bg-zinc-900 hover:text-white transition-colors rounded-full text-sm"
          >
            Full {vendor.name} profile
          </Link>
          <Link
            href="/shortlist"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-zinc-950 font-medium no-underline hover:bg-amber-400 transition-colors rounded-full text-sm"
          >
            Build your own shortlist
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {/* Evidence table for the alternatives set. "<vendor> evaluation" style
          queries carry real citation share (Forcepoint 43 per cent, 29 July
          2026) and had no table to quote from. */}
      <SourcedTable
        slugs={result.shortlist.map((v) => v.slug)}
        caption={`${vendor.name} alternatives compared on sourced evidence`}
        intro={`How the leading alternatives to ${vendor.name} differ on who owns the network and who runs the service. Ordered as ranked.`}
        id="evidence-table"
      />

      <ol className="space-y-6 list-none p-0">
        {result.shortlist.map((v) => (
          <li
            key={v.slug}
            id={`rank-${v.rank}-${v.slug}`}
            className="border border-[var(--ink-300,#ccc)] rounded-sm p-5"
          >
            <p className="eyebrow mb-1">
              No. {v.rank} · Score {v.score}
              {sameCategory.has(v.slug) && " · Same category"}
            </p>
            <h2 className="text-xl mb-1">
              <Link href={`/vendors/${v.slug}`} className="no-underline hover:text-[var(--accent)]">
                {v.name}
              </Link>
            </h2>
            <p className="text-sm text-[var(--ink-500)] mb-2">
              {v.category} · Typical deployment: {v.deployment_speed}
            </p>
            <p className="text-sm text-[var(--ink-700)]">{v.key_differentiators[0]}</p>
            <p className="text-sm text-[var(--ink-700)] mt-1">Watch out: {v.watch_outs[0]}</p>
            <a
              href={v.marketplace_url ?? "https://netify.co.uk/marketplace/"}
              target="_blank"
              rel="noopener"
              className="inline-block mt-3 px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full no-underline hover:bg-zinc-900 hover:text-white transition-colors"
            >
              Contact {v.name} via Netify ↗
            </a>
          </li>
        ))}
      </ol>

      <section className="mt-14 max-w-3xl">
        <p className="eyebrow mb-3">Questions</p>
        <h2 className="mb-6">About this ranking</h2>
        <div className="space-y-6">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-medium mb-1">{f.q}</h3>
              <p className="text-sm text-[var(--ink-700)]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-[var(--ink-500)]">{result.methodology_note}</p>
    </div>
  );
}
