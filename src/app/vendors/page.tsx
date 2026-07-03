import Link from "next/link";
import type { Metadata } from "next";
import {
  getVendorsByGroup,
  getAllVendors,
  GROUP_LABELS,
  GROUP_DESCRIPTIONS,
  type VendorGroup,
} from "@/lib/vendors";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/vendors/` },
  title: "SD-WAN and SASE vendor comparison: all 30 vendors",
  description:
    "Side-by-side comparison of 30 SD-WAN and SASE platforms and managed providers, grouped by category and graded against a 40-feature evaluation framework.",
};

const GROUP_ORDER: VendorGroup[] = [
  "technology_vendors",
  "cloud_native_sase",
  "sse_platforms",
  "cellular_wireless",
  "global_managed_providers",
];

export default function VendorsPage() {
  const grouped = getVendorsByGroup();
  const totalCount = Object.values(grouped).reduce((sum, g) => sum + g.length, 0);
  const allVendors = getAllVendors();

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Vendors", "/vendors"),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/vendors#collection`,
      name: `All ${totalCount} SD-WAN and SASE vendors`,
      description: `Directory of ${totalCount} SD-WAN and SASE platforms and managed providers, each graded against a 40-feature evaluation framework.`,
      url: `${SITE_URL}/vendors`,
      isPartOf: { "@id": `${SITE_URL}/#organization` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: allVendors.length,
        itemListElement: allVendors.map((v, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: v.name,
          url: `${SITE_URL}/vendors/${v.slug}`,
        })),
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      <div className="mb-12 max-w-3xl fade-rise">
        <p className="eyebrow mb-3">Vendor index</p>
        <h1 id="page-h1" className="mb-4">All {totalCount} SD-WAN and SASE vendors.</h1>
        <p className="text-lg text-[var(--ink-700)]">
          Grouped by category. Each vendor is graded against the same 40-feature
          evaluation matrix. Click any vendor to see the full capability profile,
          evidence sources, key differentiators and watch-outs.
        </p>
        <div className="mt-4 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base,#faf9f7)] p-3 text-sm text-[var(--ink-600)]">
          <p>
            <strong className="text-[var(--ink-800)]">Same vendors, two different pages.</strong> This index is the{" "}
            <strong className="text-[var(--ink-800)]">research view</strong>: independent capability grades against the
            40-feature framework, with evidence sources and watch-outs — it powers the{" "}
            <Link href="/shortlist" className="underline">shortlist builder</Link> and RFP evaluation. The{" "}
            <a href="https://netify.co.uk/marketplace/" className="underline">Netify Marketplace</a> is the{" "}
            <strong className="text-[var(--ink-800)]">commercial directory</strong>: company profiles, accreditations
            and contact routes. Compare capabilities here; engage companies there.
          </p>
        </div>
      </div>

      {/* Jump nav */}
      <nav className="mb-12 flex flex-wrap gap-x-6 gap-y-2 text-sm border-y border-[var(--ink-200)] py-4">
        <span className="eyebrow">Jump to</span>
        {GROUP_ORDER.map((g) => (
          <a key={g} href={`#${g}`} className="no-underline text-[var(--ink-700)] hover:text-[var(--accent)]">
            {GROUP_LABELS[g]}{" "}
            <span className="text-[var(--ink-300)]">({grouped[g].length})</span>
          </a>
        ))}
      </nav>

      {GROUP_ORDER.map((group, gi) => {
        const vendors = grouped[group];
        if (vendors.length === 0) return null;
        return (
          <section
            key={group}
            id={group}
            className="mb-20 fade-rise scroll-mt-20"
            style={{ animationDelay: `${gi * 80}ms` }}
          >
            <div className="grid md:grid-cols-12 gap-6 mb-8">
              <div className="md:col-span-4">
                <p className="eyebrow mb-2">{vendors.length} vendors</p>
                <h2>{GROUP_LABELS[group]}</h2>
              </div>
              <div className="md:col-span-7 md:col-start-6">
                <p className="text-[var(--ink-700)] mt-2">
                  {GROUP_DESCRIPTIONS[group]}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {vendors.map((v) => {
                const yesCount = v.score_summary.yes_count;
                const totalFeatures = 40;
                const yesPct = Math.round((yesCount / totalFeatures) * 100);
                return (
                  <Link
                    key={v.slug}
                    href={`/vendors/${v.slug}`}
                    className="vendor-card no-underline text-[var(--ink-900)] block group"
                  >
                    <div className="flex items-baseline justify-between gap-4 mb-3">
                      <h3 className="display group-hover:text-[var(--accent)] transition-colors">
                        {v.name}
                      </h3>
                      <span className="text-xs text-[var(--ink-500)] font-mono whitespace-nowrap">
                        {yesCount}/{totalFeatures} yes
                      </span>
                    </div>
                    <p className="text-sm text-[var(--ink-500)] mb-3">
                      {v.category}
                    </p>
                    <p className="text-sm text-[var(--ink-700)] line-clamp-3">
                      {v.key_differentiators[0]}
                    </p>
                    <div className="mt-4 pt-4 border-t border-[var(--ink-100)] flex items-center justify-between text-xs text-[var(--ink-500)]">
                      <span>Evidence coverage {Math.round(v.score_summary.evidence_coverage_pct * 100)}%</span>
                      <span className="text-[var(--accent)] group-hover:underline">
                        View profile →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
