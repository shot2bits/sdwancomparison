import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompareTable from "@/components/CompareTable";
import { COMPARE_PAIRS, getComparePair, getRelatedPairs } from "@/lib/compare-pages";
import { FEATURES, getShortlistDataset, getVendor } from "@/lib/vendors";
import Continuation from "@/components/Continuation";
import { deriveContinuation } from "@/lib/continuation/derive";
import { buildComparison } from "@/lib/shortlist-core";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getShortlistFaqSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ pair: string }> };

export function generateStaticParams() {
  return COMPARE_PAIRS.map((p) => ({ pair: p.slug }));
}

const featureMeta = () => FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pair } = await params;
  const cp = getComparePair(pair);
  if (!cp) return {};
  const c = buildComparison(getShortlistDataset(), [cp.a, cp.b], featureMeta());
  if (!c) return {};
  const [a, b] = c.slugs;
  const longTitle = `${c.names[a]} vs ${c.names[b]} (2026): graded head to head`;
  const title = longTitle.length <= 56 ? longTitle : `${c.names[a]} vs ${c.names[b]} (2026)`;
  return {
    title,
    description: `${c.names[a]} vs ${c.names[b]} compared feature by feature: 40 graded capabilities plus regions, clouds, AI and resilience. Scores, wins and caveats.`,
    alternates: { canonical: `${SITE_URL}/compare/${pair}/` },
    openGraph: {
      title: `${c.names[a]} vs ${c.names[b]} (2026)`,
      description: `Feature by feature comparison on the Netify evidence matrix.`,
      url: `${SITE_URL}/compare/${pair}`,
      type: "article",
      locale: "en_GB",
    },
  };
}

export default async function ComparePage({ params }: Props) {
  const { pair } = await params;
  const cp = getComparePair(pair);
  if (!cp) notFound();
  const c = buildComparison(getShortlistDataset(), [cp.a, cp.b], featureMeta());
  if (!c) notFound();
  const [a, b] = c.slugs;

  const faqs = [
    {
      q: `${c.names[a]} or ${c.names[b]}: which is better?`,
      a: `${c.summary} Which fits you depends on operating model, sector, regions and security priorities; the interactive shortlist builder scores both against your exact requirements.`,
    },
    {
      q: `Where does ${c.names[a]} beat ${c.names[b]}?`,
      a: c.wins[a].length > 0
        ? `${c.names[a]} holds a clear evidence advantage on ${c.wins[a].length} features, including ${c.wins[a].slice(0, 4).join(", ")}.`
        : `${c.names[a]} holds no outright feature advantages in this comparison; differences sit in degree and delivery rather than capability presence.`,
    },
    {
      q: `Where does ${c.names[b]} beat ${c.names[a]}?`,
      a: c.wins[b].length > 0
        ? `${c.names[b]} holds a clear evidence advantage on ${c.wins[b].length} features, including ${c.wins[b].slice(0, 4).join(", ")}.`
        : `${c.names[b]} holds no outright feature advantages in this comparison; differences sit in degree and delivery rather than capability presence.`,
    },
  ];

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema(`${c.names[a]} vs ${c.names[b]}`, `/compare/${pair}`),
    getSpeakableSchema(`/compare/${pair}`),
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${SITE_URL}/compare/${pair}#article`,
      headline: `${c.names[a]} vs ${c.names[b]} (2026): graded head to head`,
      description: c.summary,
      author: { "@type": "Organization", name: "Netify research team", url: "https://netify.co.uk/about-netify/" },
      publisher: { "@id": `${SITE_URL}/#organization` },
      dateModified: "2026-06-11",
      mainEntityOfPage: `${SITE_URL}/compare/${pair}`,
    },
    getShortlistFaqSchema(faqs),
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      {/* Visible breadcrumb (the JSON-LD breadcrumb already existed; the
          human-readable trail now matches it) */}
      <nav aria-label="Breadcrumb" className="text-sm mb-6 text-[var(--ink-500)]">
        <Link href="/" className="no-underline text-[var(--ink-500)] hover:text-[var(--accent)]">Netify</Link>
        <span className="mx-2 text-[var(--ink-300)]">/</span>
        <Link href="/vendors" className="no-underline text-[var(--ink-500)] hover:text-[var(--accent)]">Vendors</Link>
        <span className="mx-2 text-[var(--ink-300)]">/</span>
        <span className="text-[var(--ink-700)]">{c.names[a]} vs {c.names[b]}</span>
      </nav>

      <div className="mb-10 fade-rise">
        <p className="eyebrow mb-3">Head to head · Updated June 2026</p>
        <h1 id="page-h1" className="mb-4">
          {c.names[a]} vs {c.names[b]} (2026): graded feature by feature
        </h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          Every grade below comes from the Netify evidence matrix: 40 capability
          features plus regional coverage, cloud support, AI capability and
          resilience, graded from public sources. Grades measure breadth of
          evidenced capability, not depth per category: a specialist can match
          a generalist on a grade yet lead it in practice, so read both full
          profiles before deciding.
        </p>
        <p className="mt-4 text-[var(--ink-700)]" id="ranked-summary">{c.summary}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {c.slugs.map((s) => (
          <div key={s} className="border border-[var(--ink-300,#ccc)] rounded-sm p-5">
            <p className="eyebrow mb-1">Score {c.meta[s].score}</p>
            <h2 className="text-lg mb-1">
              <Link href={`/vendors/${s}`} className="no-underline hover:text-[var(--accent)]">{c.names[s]}</Link>
            </h2>
            <p className="text-sm text-[var(--ink-500)] mb-2">
              {c.meta[s].category} · Typical deployment: {c.meta[s].deployment_speed}
            </p>
            <p className="text-sm text-[var(--ink-700)] mb-3">
              Clear feature advantages: {c.wins[s].length > 0 ? c.wins[s].slice(0, 3).join("; ") : "none outright"}
              {c.wins[s].length > 3 ? ` (and ${c.wins[s].length - 3} more)` : ""}
            </p>
            <div className="flex gap-2 flex-wrap">
              <a
                href={c.meta[s].marketplace_url ?? "https://netify.co.uk/marketplace/"}
                target="_blank"
                rel="noopener"
                className="px-3.5 py-1.5 text-sm border border-[var(--ink-900)] rounded-full no-underline hover:bg-zinc-900 hover:text-white transition-colors"
              >
                Contact via Netify ↗
              </a>
              <Link
                href={`/alternatives/${s}`}
                className="px-3.5 py-1.5 text-sm border border-[var(--ink-300,#ccc)] rounded-full no-underline hover:border-[var(--ink-900)]"
              >
                Alternatives
              </Link>
            </div>
          </div>
        ))}
      </div>

      <CompareTable comparison={c} />

      {/* The Continuation (DEF wave one): both vendors derive or nothing
          renders. The editorial button it replaces is retired. */}
      <div className="mt-10">
        <Continuation
          c={deriveContinuation({ kind: "comparison", a: getVendor(cp.a), b: getVendor(cp.b) })}
          pageUrl={`${SITE_URL}/compare/${pair}`}
        />
        <p className="mt-3 text-sm text-[var(--ink-500)]">
          Or <Link href="/shortlist" className="underline">score both against your requirements in the shortlist builder</Link>.
        </p>
      </div>

      <section className="mt-14 max-w-3xl">
        <p className="eyebrow mb-3">Questions</p>
        <h2 className="mb-6">About this comparison</h2>
        <div className="space-y-6">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-medium mb-1">{f.q}</h3>
              <p className="text-sm text-[var(--ink-700)]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 border-t border-[var(--ink-300,#ccc)] pt-8">
        <p className="eyebrow mb-3">More head to heads</p>
        <div className="flex flex-wrap gap-2">
          {getRelatedPairs(pair, 12).map((p) => (
            <Link key={p.slug} href={`/compare/${p.slug}`} className="px-3.5 py-1.5 text-sm rounded-full border border-[var(--ink-300,#ccc)] no-underline hover:border-[var(--ink-900)]">
              {p.slug.replace(/-vs-/, " vs ").replace(/-/g, " ")}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
