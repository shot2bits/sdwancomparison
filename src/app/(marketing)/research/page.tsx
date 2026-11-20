import type { Metadata } from "next";
import Link from "next/link";
import { COMPARE_PAIRS } from "@/lib/compare-pages";
import { CASE_PAGE_SECTORS, RESEARCH, SECTORS, formatDate, providerName, researchSummarySentence, sectorResearch } from "@/lib/workbook-research";
import { Crumbs, JsonLd, ResearchNotice, breadcrumbLd } from "@/components/research/ResearchBits";
import { SITE_URL } from "@/lib/structured-data";

export const dynamic = "force-static";

const TITLE = `SD-WAN and SASE provider research (updated ${formatDate(RESEARCH.updated_date)})`;
const DESCRIPTION = researchSummarySentence();

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION.slice(0, 300),
  alternates: { canonical: `${SITE_URL}/research/` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/research/`, type: "website", locale: "en_GB" },
};

export default function ResearchHub() {
  const c = RESEARCH.counts;
  const priced = RESEARCH.price_lines.filter((l) => l.amount !== null).length;
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${SITE_URL}/research/#dataset`,
    name: "Netify SD-WAN and SASE provider desk research",
    description: DESCRIPTION,
    url: `${SITE_URL}/research/`,
    version: RESEARCH.dataset_version,
    dateModified: RESEARCH.updated_date,
    temporalCoverage: `${RESEARCH.evidence_window.sources_accessed_from}/${RESEARCH.evidence_window.pricing_observed_to}`,
    creator: { "@type": "Organization", name: "Netify", url: "https://netify.co.uk/" },
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE_URL}/research/data.json` }],
    variableMeasured: ["Provider-published evidence by research question", "Published customer cases by sector", "Published list prices"],
  };
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <JsonLd data={[dataset, breadcrumbLd([{ name: "Home", path: "/" }, { name: "Research", path: "/research/" }])]} />
      <Crumbs items={[{ href: "/", label: "Netify" }, { label: "Research" }]} />
      <p className="eyebrow mb-3">Desk research · Updated {formatDate(RESEARCH.updated_date)}</p>
      <h1 id="page-h1" className="mb-4">SD-WAN and SASE provider research</h1>
      <p id="page-subhead" className="text-lg text-[var(--ink-700)]">{DESCRIPTION}</p>
      <ResearchNotice />

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-8">
        {[["Providers", c.providers], ["Evidenced findings", c.findings], ["Sources", c.sources], ["Customer cases", c.cases], ["Named products", c.products], ["Location records", c.site_delivery], ["Offers", c.offers], ["List-price lines", priced]].map(([k, v]) => (
          <div key={String(k)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-4"><dt className="text-sm text-[var(--ink-500)]">{k}</dt><dd className="text-2xl">{v}</dd></div>
        ))}
      </dl>

      <h2 className="mt-10 mb-3">Best SD-WAN and SASE providers by sector (published cases)</h2>
      <ul className="grid sm:grid-cols-2 gap-2">
        {SECTORS.map((s) => {
          const r = sectorResearch(s.slug);
          return <li key={s.slug}><Link href={`/research/sectors/${s.slug}/`} className="underline">{s.name}</Link> · {r.cases.length} cited case{r.cases.length === 1 ? "" : "s"}{r.thin ? " (thin evidence)" : ""}</li>;
        })}
      </ul>

      <h2 className="mt-10 mb-3">Sector case studies</h2>
      <ul>
        {CASE_PAGE_SECTORS.map((s) => <li key={s}><Link href={`/research/cases/${s}/`} className="underline">{SECTORS.find((x) => x.slug === s)?.name} SD-WAN and SASE case studies</Link></li>)}
      </ul>

      <h2 className="mt-10 mb-3">Published list prices</h2>
      <p><Link href="/research/list-prices/" className="underline">SD-WAN and SASE list prices with sources and dates</Link> ({priced} lines, not quotes).</p>

      <h2 className="mt-10 mb-3">Provider research</h2>
      <ul className="grid sm:grid-cols-3 gap-1">
        {RESEARCH.providers.map((p) => <li key={p.slug}><Link href={`/research/providers/${p.slug}/`} className="underline">{p.name}</Link></li>)}
      </ul>

      <h2 className="mt-10 mb-3">Head-to-head comparisons</h2>
      <ul className="grid sm:grid-cols-2 gap-1">
        {COMPARE_PAIRS.map((p) => <li key={p.slug}><Link href={`/compare/${p.slug}/`} className="underline">{providerName(p.a)} vs {providerName(p.b)}</Link></li>)}
      </ul>

      <h2 className="mt-10 mb-3">How this research was compiled</h2>
      <p className="text-[var(--ink-700)]">
        Netify researchers recorded one fact per provider, product and question from providers&apos; own web pages, PDFs and documentation, plus a small number of third-party publications, between {formatDate(RESEARCH.evidence_window.sources_accessed_from)} and {formatDate(RESEARCH.evidence_window.pricing_observed_to)}. Gaps are left blank rather than filled with a phrase. Prices are list or published prices from official price pages, public framework documents and named reseller adverts; historical and non-UK prices are marked. Download the full dataset as <Link href="/research/data.json" className="underline">JSON</Link> (CC BY 4.0).
      </p>
    </div>
  );
}
