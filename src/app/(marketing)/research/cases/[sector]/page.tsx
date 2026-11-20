import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CASE_PAGE_SECTORS, SECTORS, formatDate, providerResearch, sectorResearch } from "@/lib/workbook-research";
import { Crumbs, JsonLd, ResearchNotice, SourceCite, breadcrumbLd, host } from "@/components/research/ResearchBits";
import { SITE_URL } from "@/lib/structured-data";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = { params: Promise<{ sector: string }> };

export function generateStaticParams() {
  return CASE_PAGE_SECTORS.map((sector) => ({ sector }));
}

const INTRO: Record<string, string> = {
  retail: "Retail estates mix stores, distribution centres, pop-up and franchise sites, with payment traffic that must survive a carrier failure and rollouts staged store by store.",
  "financial-services": "Financial services networks carry regulated traffic between branches, trading or operations sites and cloud, with audit, resilience and third-party access under scrutiny.",
};

/** Only quote a source passage that is about the named customer. */
function mentionsCustomer(passage: string, customer: string) {
  const words = customer.toLowerCase().match(/[a-z0-9&]{4,}/g) ?? [];
  const generic = new Set(["bank", "group", "limited", "retail", "services", "major", "global", "company", "insurance", "retailer", "technology", "fortune", "regional", "commercial", "european", "multinational"]);
  const distinctive = words.filter((w) => !generic.has(w));
  return distinctive.length > 0 && distinctive.some((w) => passage.toLowerCase().includes(w));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sector } = await params;
  const r = sectorResearch(sector);
  if (!r.sector || !(CASE_PAGE_SECTORS as readonly string[]).includes(sector)) return {};
  const title = `${r.sector.name} SD-WAN and SASE case studies: ${r.cases.length} published deployments`;
  const description = `${r.cases.length} published ${r.sector.name.toLowerCase()} SD-WAN and SASE customer cases from ${r.cases.length} providers, with customer, estate size where stated, and a link to each source (updated ${formatDate(r.updated)}).`;
  return { title, description, alternates: { canonical: `${SITE_URL}/research/cases/${sector}/` }, openGraph: { title, description, url: `${SITE_URL}/research/cases/${sector}/`, type: "article", locale: "en_GB" } };
}

export default async function SectorCases({ params }: Props) {
  const { sector } = await params;
  if (!(CASE_PAGE_SECTORS as readonly string[]).includes(sector)) notFound();
  const r = sectorResearch(sector);
  if (!r.sector) notFound();
  const name = r.sector.name;
  const path = `/research/cases/${sector}/`;
  const withSites = r.rows.filter((x) => x.case.site_count !== null);
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${SITE_URL}${path}#article`,
      headline: `${name} SD-WAN and SASE case studies`,
      description: `${r.cases.length} published ${name.toLowerCase()} customer cases from SD-WAN and SASE providers.`,
      dateModified: r.updated,
      author: { "@type": "Organization", name: "Netify research team", url: "https://netify.co.uk/" },
      publisher: { "@type": "Organization", name: "Netify", url: "https://netify.co.uk/" },
      mainEntityOfPage: `${SITE_URL}${path}`,
      citation: r.rows.map((x) => x.source && ({ "@type": "CreativeWork", url: x.source.url, name: x.source.title ?? `${x.provider} customer story: ${x.case.customer}`, publisher: x.source.publisher ?? undefined })).filter(Boolean),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${name} SD-WAN and SASE deployments`,
      numberOfItems: r.rows.length,
      itemListElement: r.rows.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: `${x.case.customer} (${x.provider})`, url: x.source?.url })),
    },
    breadcrumbLd([{ name: "Home", path: "/" }, { name: "Research", path: "/research/" }, { name: `${name} case studies`, path }]),
  ];
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <JsonLd data={ld} />
      <Crumbs items={[{ href: "/", label: "Netify" }, { href: "/research/", label: "Research" }, { label: `${name} case studies` }]} />
      <p className="eyebrow mb-3">Case studies · Updated {formatDate(r.updated)}</p>
      <h1 id="page-h1" className="mb-4">{name} SD-WAN and SASE case studies</h1>
      <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
        {INTRO[sector]} {r.cases.length} of the 30 providers Netify researches publish a {name.toLowerCase()} customer case. {withSites.length} of them state an estate size, from {Math.min(...withSites.map((x) => x.case.site_count ?? 0))} to {Math.max(...withSites.map((x) => x.case.site_count ?? 0))} sites.
      </p>
      <ResearchNotice />
      <div className="space-y-8 mt-8">
        {r.rows.map((x) => {
          const p = providerResearch(x.case.slug);
          return (
            <article key={x.case.id} className="border-t border-[var(--ink-300,#ccc)] pt-5">
              <h2 className="text-xl mb-1">{x.case.customer} <span className="text-[var(--ink-500)] text-base">· {x.provider}</span></h2>
              <p className="text-sm text-[var(--ink-700)]">
                {x.case.site_count !== null ? `${x.case.site_count_qualifier === "At least" ? "At least " : ""}${x.case.site_count} sites stated in the source. ` : "Estate size not stated in the source. "}
                {x.case.user_count !== null ? `${x.case.user_count} users stated. ` : ""}
                {x.provider} has {p.findings.length} other evidenced findings and {p.cases.length} published case{p.cases.length === 1 ? "" : "s"} in Netify&apos;s research.
              </p>
              {x.source?.passage && x.source.claim === "provider_published" && mentionsCustomer(x.source.passage, x.case.customer) && (
                <blockquote className="text-sm border-l-2 border-[var(--ink-300,#ccc)] pl-3 my-2 text-[var(--ink-700)]">
                  &ldquo;{x.source.passage.length > 360 ? `${x.source.passage.slice(0, 360).trimEnd()}…` : x.source.passage}&rdquo; <cite className="not-italic">({x.source.publisher ?? host(x.source.url)})</cite>
                </blockquote>
              )}
              <p><SourceCite id={x.case.source_id} /></p>
              <p className="text-sm mt-1"><Link href={`/research/providers/${x.case.slug}/`} className="underline">{x.provider} evidence</Link></p>
            </article>
          );
        })}
      </div>
      <p className="mt-10 text-sm">
        <Link href={`/research/sectors/${sector}/`} className="underline">{name} providers table</Link> · <Link href="/research/" className="underline">All research</Link> · <a href="https://netify.co.uk/marketplace/" className="underline">Build a {name.toLowerCase()} RFP in the marketplace</a>
        {" · Other case pages: "}{CASE_PAGE_SECTORS.filter((s) => s !== sector).map((s) => <Link key={s} href={`/research/cases/${s}/`} className="underline">{SECTORS.find((z) => z.slug === s)?.name}</Link>)}
      </p>
    </div>
  );
}
