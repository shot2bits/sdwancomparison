import type { Metadata } from "next";
import Link from "next/link";
import { COMPARE_PAIRS } from "@/lib/compare-pages";
import { getVendor } from "@/lib/vendors";
import { SITE_URL, getBreadcrumbSchema, getOrganizationSchema } from "@/lib/structured-data";

/**
 * Index page for the curated /compare/[pair] head-to-heads. Previously
 * /compare/ was a 404 (only the [pair] pages existed) -- the same gap
 * /best/ had until 2 Jul 2026 (see that page's own header comment), found
 * again by Harry Yelland's 10 Aug 2026 platform test (Test 3: "Best/Compare
 * -> desk handoff"). Every pair below is already reachable one click from
 * its two vendor pages ("Head to head") and from sitemap.xml, but had no
 * hub of its own -- added here on the same pattern as /best/page.tsx.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Compare SD-WAN and SASE providers head to head (2026)",
  description:
    "Graded head-to-head comparisons of SD-WAN and SASE platforms and managed providers: 40 capability features plus regional coverage, cloud support, AI and resilience.",
  alternates: { canonical: `${SITE_URL}/compare/` },
  openGraph: {
    title: "Compare SD-WAN and SASE providers head to head (2026)",
    description:
      "Graded head-to-head comparisons of SD-WAN and SASE platforms and managed providers, scored across 40 capability features.",
    url: `${SITE_URL}/compare/`,
    type: "website",
    locale: "en_GB",
  },
};

export default function CompareIndexPage() {
  const pairs = COMPARE_PAIRS.map((p) => ({
    slug: p.slug,
    aName: getVendor(p.a).name,
    bName: getVendor(p.b).name,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getOrganizationSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(getBreadcrumbSchema("Compare SD-WAN and SASE providers", "/compare/")),
        }}
      />

      <div className="mb-12 fade-rise">
        <p className="eyebrow mb-3">Head-to-head comparisons · Updated 2026</p>
        <h1 className="mb-4">Compare SD-WAN and SASE providers</h1>
        <p className="text-lg text-[var(--ink-700)] max-w-3xl">
          Every comparison below is graded from the same 40-capability evidence matrix that
          powers the interactive shortlist builder, plus regional coverage, cloud support, AI
          capability and resilience. Pick a curated pairing, or build your own comparison
          interactively.
        </p>
        <div className="mt-5 flex gap-3 flex-wrap">
          <Link
            href="/shortlist"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-zinc-950 font-medium no-underline hover:bg-amber-400 transition-colors rounded-full text-sm"
          >
            Build your own shortlist →
          </Link>
          <Link
            href="/vendors"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[var(--ink-300,#d4d4d8)] text-[var(--ink-900)] font-medium no-underline hover:bg-[var(--ink-100,#f4f4f5)] transition-colors rounded-full text-sm"
          >
            Browse all vendors
          </Link>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 list-none m-0 p-0">
        {pairs.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/compare/${p.slug}`}
              className="block h-full rounded-xl border border-[var(--ink-200)] bg-[var(--paper-card,#fff)] p-5 no-underline transition-colors hover:border-[var(--ink-300,#d4d4d8)]"
            >
              <p className="font-medium text-[var(--ink-900)] leading-snug">
                {p.aName} vs {p.bName}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
