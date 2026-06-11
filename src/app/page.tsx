import type { Metadata } from "next";
import Link from "next/link";
import { getAllVendors, FEATURES, FEATURE_CATEGORIES } from "@/lib/vendors";
import { SITE_URL, getOrganizationSchema, getSpeakableSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/` },
};

export default function Home() {
  const vendors = getAllVendors();
  const totalCount = vendors.length;
  const featureCount = FEATURES.length;
  const categoryCount = FEATURE_CATEGORIES.length;

  const schemas = [getOrganizationSchema(), getSpeakableSchema("/")];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
      {schemas.map((sc, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sc) }}
        />
      ))}
      {/* Hero */}
      <div className="grid md:grid-cols-12 gap-8 mb-20 fade-rise">
        <div className="md:col-span-8">
          <p className="eyebrow mb-4">SD-WAN and SASE research</p>
          <h1 id="page-h1" className="display mb-6" style={{ fontSize: "var(--text-display)", fontWeight: 600, letterSpacing: "-0.02em" }}>
            A vendor-neutral comparison of {totalCount} SD-WAN and SASE platforms,
            graded against a {featureCount}-feature evaluation framework.
          </h1>
          <p id="page-subhead" className="text-lg text-[var(--ink-700)] mb-8 max-w-2xl">
            Most vendor comparisons are written by vendors. This one is published by
            Netify and grades each platform against the same {categoryCount} capability
            categories, using only public source evidence. Every status grade is
            traceable to its source.
          </p>
          <div className="flex items-center gap-6 flex-wrap">
            <Link
              href="/shortlist"
              className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-zinc-950 font-medium no-underline hover:bg-amber-400 transition-colors rounded-full"
            >
              Build your shortlist
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/vendors"
              className="inline-flex items-center gap-2 px-5 py-3 border border-[var(--ink-900)] no-underline hover:bg-zinc-900 hover:text-white transition-colors rounded-full"
            >
              Browse {totalCount} vendors
            </Link>
            <a
              href="https://netify.co.uk"
              className="no-underline text-sm text-[var(--ink-500)] hover:text-[var(--accent)]"
            >
              About Netify ↗
            </a>
          </div>
        </div>
      </div>

      <hr className="rule mb-16" />

      {/* Methodology */}
      <section className="grid md:grid-cols-12 gap-8 mb-20">
        <div className="md:col-span-4">
          <p className="eyebrow mb-3">Methodology</p>
          <h2>Six grades, one matrix, every claim sourced.</h2>
        </div>
        <div className="md:col-span-7 md:col-start-6 space-y-6 text-[var(--ink-700)]">
          <p>
            Each vendor is scored against {featureCount} capabilities drawn from
            real-world SD-WAN and SASE RFPs. Capabilities span six categories:
            service delivery and operating model, network architecture and transport,
            gateway and PoP design, security and SASE depth, operations and
            assurance, and commercial flexibility.
          </p>
          <p>
            Each capability is graded using one of six status values rather than a
            simple yes or no. The grades distinguish between native capability
            (<span className="status-pill status-yes">Yes</span>), limited or
            indirect evidence (<span className="status-pill status-partial">Partial</span>),
            partner-delivered capability
            (<span className="status-pill status-partner_integrated">Partner / integrated</span>),
            managed-service dependency, non-primary positioning, and unknowns
            requiring RFP validation. These distinctions matter to buyers.
          </p>
          <p>
            Source URLs and an evidence summary are provided for every vendor.
            Where public evidence is limited, the grade reflects that limitation
            rather than assuming the capability is present.
          </p>
        </div>
      </section>

      <hr className="rule mb-16" />

      {/* What you can do here */}
      <section className="grid md:grid-cols-3 gap-8 mb-16">
        <div>
          <p className="eyebrow mb-3">For buyers</p>
          <h3 className="mb-3">Shortlist by capability, not by marketing</h3>
          <p className="text-[var(--ink-700)]">
            Filter and compare vendors against the capabilities that matter to
            your specific architecture, geography and operating model.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">For consultants</p>
          <h3 className="mb-3">A consistent reference frame</h3>
          <p className="text-[var(--ink-700)]">
            Every vendor evaluated against the same matrix, so comparisons are
            structural rather than narrative.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">For AI agents</p>
          <h3 className="mb-3">Structured, citable, machine-readable</h3>
          <p className="text-[var(--ink-700)]">
            Every vendor record is published with structured data so AI assistants
            and research agents can cite specific capability grades and sources.
          </p>
        </div>
      </section>

      <hr className="rule mb-16" />

      {/* CTA */}
      <section className="text-center py-12">
        <h2 className="mb-6">Start with the full vendor list.</h2>
        <Link
          href="/vendors"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-zinc-950 font-medium no-underline hover:bg-amber-400 transition-colors rounded-full"
        >
          Browse all {totalCount} vendors
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
