import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CASE_PAGE_SECTORS, SECTORS, formatDate, sectorResearch } from "@/lib/workbook-research";
import { Crumbs, JsonLd, ResearchNotice, SourceCite, breadcrumbLd } from "@/components/research/ResearchBits";
import { SITE_URL } from "@/lib/structured-data";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = { params: Promise<{ sector: string }> };

export function generateStaticParams() {
  return SECTORS.map((s) => ({ sector: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sector } = await params;
  const r = sectorResearch(sector);
  if (!r.sector) return {};
  const title = `Best SD-WAN and SASE providers for ${r.sector.name.toLowerCase()}: ${r.cases.length} cited cases`;
  const description = `${r.cases.length} providers with a published ${r.sector.name.toLowerCase()} customer case, each linked to its source and access date (updated ${formatDate(r.updated)}). Unverified provider claims, not a ranking of quality.`;
  return { title, description, alternates: { canonical: `${SITE_URL}/research/sectors/${sector}/` }, openGraph: { title, description, url: `${SITE_URL}/research/sectors/${sector}/`, type: "article", locale: "en_GB" } };
}

export default async function SectorBestFor({ params }: Props) {
  const { sector } = await params;
  const r = sectorResearch(sector);
  if (!r.sector) notFound();
  const name = r.sector.name;
  const path = `/research/sectors/${sector}/`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${SITE_URL}${path}#list`,
      name: `SD-WAN and SASE providers with published ${name.toLowerCase()} cases`,
      numberOfItems: r.rows.length,
      itemListElement: r.rows.map((row, i) => ({ "@type": "ListItem", position: i + 1, name: `${row.provider}: ${row.case.customer}`, url: `${SITE_URL}/research/providers/${row.case.slug}/` })),
    },
    breadcrumbLd([{ name: "Home", path: "/" }, { name: "Research", path: "/research/" }, { name: `${name} providers`, path }]),
  ];
  const hasCasePage = (CASE_PAGE_SECTORS as readonly string[]).includes(sector);
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <JsonLd data={ld} />
      <Crumbs items={[{ href: "/", label: "Netify" }, { href: "/research/", label: "Research" }, { label: name }]} />
      <p className="eyebrow mb-3">Best for {name.toLowerCase()} · Updated {formatDate(r.updated)}</p>
      <h1 id="page-h1" className="mb-4">Best SD-WAN and SASE providers for {name.toLowerCase()}, by published customer cases</h1>
      <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
        {r.cases.length} of 30 researched providers publish a {name.toLowerCase()} customer case that Netify could cite. The table lists each one with the customer named in the source, any site count the source states, and how much other evidence the provider publishes. Larger documented estates are listed first.
        {r.thin ? ` Evidence is thin for this sector: fewer than five providers publish a citable case, so treat this as a starting list, not a market view.` : ""}
      </p>
      <ResearchNotice />
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <caption className="text-left text-[var(--ink-500)] mb-2">{name}: providers with a published customer case (source and access date on each row)</caption>
          <thead>
            <tr className="border-b border-[var(--ink-300,#ccc)]">
              <th scope="col" className="text-left py-2 pr-3">Provider</th>
              <th scope="col" className="text-left py-2 px-3">Customer in source</th>
              <th scope="col" className="text-right py-2 px-3">Sites stated</th>
              <th scope="col" className="text-right py-2 px-3">Evidenced findings</th>
              <th scope="col" className="text-left py-2 pl-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.case.id} className="border-b border-[var(--ink-100,#eee)] align-top">
                <th scope="row" className="text-left font-normal py-2 pr-3"><Link href={`/research/providers/${row.case.slug}/`} className="underline">{row.provider}</Link></th>
                <td className="py-2 px-3">{row.case.customer}</td>
                <td className="py-2 px-3 text-right">{row.case.site_count !== null ? `${row.case.site_count_qualifier === "At least" ? "≥" : ""}${row.case.site_count}` : "Not stated"}</td>
                <td className="py-2 px-3 text-right">{row.evidence}</td>
                <td className="py-2 pl-3"><SourceCite id={row.case.source_id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-[var(--ink-700)]">
        A published case shows a provider has delivered in the sector; it does not establish fit for your sites, applications or contract. Build a {name.toLowerCase()} RFP and compare providers in the <a href="https://netify.co.uk/marketplace/" className="underline">Netify marketplace</a>.
      </p>
      <p className="mt-4 text-sm">
        {hasCasePage && <><Link href={`/research/cases/${sector}/`} className="underline">{name} case studies in detail</Link> · </>}
        Other sectors: {SECTORS.filter((s) => s.slug !== sector).map((s, i) => <span key={s.slug}>{i ? " · " : ""}<Link href={`/research/sectors/${s.slug}/`} className="underline">{s.name}</Link></span>)}
      </p>
    </div>
  );
}
