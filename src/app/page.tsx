import type { Metadata } from "next";
import Link from "next/link";
import GuidedStart from "@/components/GuidedStart";
import { getAllVendors, FEATURES, FEATURE_CATEGORIES } from "@/lib/vendors";
import { SITE_URL, getOrganizationSchema, getSpeakableSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Netify: SASE, SSE and SD-WAN marketplace and RFP builder",
  description:
    "Vendor-neutral SASE, SSE and SD-WAN marketplace. Compare 30 graded vendors, run a reverse auction or live quote room, or build an RFP. Browse free, agent-ready.",
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
      {/* Hero: the single guided front door */}
      <div className="mb-12 fade-rise">
        <p className="eyebrow mb-4">SASE, SSE and SD-WAN marketplace</p>
        <h1 id="page-h1" className="display mb-5" style={{ fontSize: "var(--text-display)", fontWeight: 600, letterSpacing: "-0.02em" }}>
          From a network need to competing offers, in one place.
        </h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)] mb-8 max-w-2xl">
          Describe what you need and choose what to do with it: compare a shortlist of {totalCount}
          {" "}graded vendors, run a reverse auction, open a live quote room, or build a formal RFP.
          Vendor-neutral, graded against a {featureCount}-feature framework across {categoryCount} categories.
          Browse and build without an account.
        </p>
        <GuidedStart />
        <div className="flex items-center gap-6 flex-wrap mt-5 text-sm">
          <Link href="/how-it-works" className="no-underline text-[var(--ink-700)] hover:text-[var(--accent)]">How it works</Link>
          <Link href="/vendors" className="no-underline text-[var(--ink-700)] hover:text-[var(--accent)]">Browse {totalCount} vendors</Link>
          <Link href="/for-suppliers" className="no-underline text-[var(--ink-700)] hover:text-[var(--accent)]">For vendors and providers</Link>
          <a href="https://netify.co.uk" className="no-underline text-[var(--ink-500)] hover:text-[var(--accent)]">About Netify ↗</a>
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
          <div>
            <p className="mb-3">
              For each of the {totalCount} vendors in our matrix, we have scored
              against {featureCount} capabilities drawn from real-world SD-WAN and
              SASE RFPs, covering the likes of:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Service delivery and operating model,</li>
              <li>Network architecture and transport,</li>
              <li>Gateway and PoP design,</li>
              <li>Security and SASE depth,</li>
              <li>Operations and assurance,</li>
              <li>Commercial flexibility.</li>
            </ul>
          </div>
          <p>
            However, we appreciate that not all solutions implement features in
            the same way and so to assist with comparing these, we have graded
            each capability between native capability
            (<span className="status-pill status-yes">Yes</span>), limited or
            indirect evidence (<span className="status-pill status-partial">Partial</span>),
            partner-delivered capability
            (<span className="status-pill status-partner_integrated">Partner / integrated</span>),
            managed-service dependency, non-primary positioning, and unknowns
            (requiring RFP validation).
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
