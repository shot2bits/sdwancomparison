import type { Metadata } from "next";
import Link from "next/link";
import { FEATURES } from "@/lib/vendors";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { GOVERNED_SHORTLIST_CONTRACT_VERSION } from "@/lib/governed-provider-catalogue";
import { SHORTLIST_VIEW_CONTRACT_VERSION, SHORTLIST_VIEW_KEYS, SHORTLIST_VIEWS } from "@/lib/shortlist-market-views";
import { SITE_URL } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Netify SD-WAN and SASE Provider Research Methodology",
  description: "How Netify researches, grades, ranks and updates its comparison of 30 SD-WAN and SASE vendors and managed providers.",
  alternates: { canonical: `${SITE_URL}/shortlist/research-methodology/` },
};

export const dynamic = "force-dynamic";

export default async function ResearchMethodologyPage() {
  const live = await getLiveShortlistDataset();
  const reviewed = live.vendors.map((provider) => provider.last_verified).sort().slice(-1)[0];
  const sources = live.vendors.reduce((total, provider) => total + (provider.evidence_source_count ?? 0), 0);
  const schema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Netify SD-WAN and SASE Provider Research Methodology",
    dateModified: reviewed,
    author: { "@type": "Organization", name: "Netify Group Limited" },
    publisher: { "@type": "Organization", name: "Netify Group Limited" },
    isPartOf: { "@type": "Dataset", name: "Netify SD-WAN and SASE provider comparison", url: `${SITE_URL}/shortlist/data.json` },
  };
  return <main className="mx-auto max-w-4xl px-6 py-16">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <p className="eyebrow mb-3">Research methodology</p>
    <h1>How Netify compares SD-WAN and SASE providers</h1>
    <p className="mt-4 text-lg leading-8 text-[var(--ink-700)]">The comparison covers {live.vendors.length} providers and {FEATURES.length} capabilities. It uses {sources} cited sources in the current governed records. The latest provider review date is {reviewed}.</p>

    <section className="mt-10">
      <h2>What the grades mean</h2>
      <p className="mt-3 leading-7">A capability is recorded as supported, partially supported, partner delivered, managed-service dependent, not primary or not confirmed. Not confirmed means the reviewed public sources did not support the claim. It is not treated as proof that the provider lacks the capability.</p>
    </section>
    <section className="mt-10">
      <h2>How the market views are formed</h2>
      <div className="mt-4 space-y-4">
        {SHORTLIST_VIEW_KEYS.map((view) => <div key={view} className="rounded-lg border p-4"><h3 className="text-lg">{SHORTLIST_VIEWS[view].title}</h3><p className="mt-2 text-sm leading-6 text-[var(--ink-700)]">{SHORTLIST_VIEWS[view].answer}</p></div>)}
      </div>
    </section>
    <section className="mt-10">
      <h2>How to cite and reuse the research</h2>
      <p className="mt-3 leading-7">Suggested citation: Netify Group Limited, “Netify SD-WAN and SASE provider comparison”, reviewed {reviewed}, <Link className="underline" href="/shortlist/">https://netify.co.uk/sase/shortlist/</Link>.</p>
      <ul className="mt-4 list-disc space-y-2 pl-5">
        <li><Link className="underline" href="/shortlist/data.json">JSON dataset</Link></li>
        <li><Link className="underline" href="/shortlist/data.csv">CSV dataset</Link></li>
        <li><Link className="underline" href="/shortlist/cite.bib">BibTeX citation</Link></li>
      </ul>
      <p className="mt-4 text-sm text-[var(--ink-600)]">Contracts: {GOVERNED_SHORTLIST_CONTRACT_VERSION}; {SHORTLIST_VIEW_CONTRACT_VERSION}. Quote the review date and link to the provider profile when repeating a provider claim.</p>
    </section>
  </main>;
}
