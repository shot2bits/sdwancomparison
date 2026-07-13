/**
 * /sase/cost-estimator/: the SASE cost and TCO estimator page.
 *
 * Upgraded from a minimal mount to the full page standard (13 Jul 2026):
 * agentic advantage statement, extractable answer block, H2 structure and
 * the JSON-LD stack (WebApplication + BreadcrumbList + Speakable +
 * Person). The Phase 2 article at /insights/sase-cost-tco-global-
 * enterprise/ becomes the authority front door when it ships; this page
 * is the on-platform tool home. No pricing figures in prose: bands
 * appear only inside the estimator output (editorial rule).
 */
import type { Metadata } from "next";
import { CostEstimator } from "@/components/CostEstimator";
import { SITE_URL, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

const jsonLd = (obj: unknown): string => JSON.stringify(obj).replace(/</g, "\\u003c");

const CANONICAL = `${SITE_URL}/cost-estimator/`;

export const metadata: Metadata = {
  title: "SASE Cost and TCO Estimator",
  description:
    "Estimate indicative SASE monthly cost and three year TCO bands by users, sites, regions, security depth, delivery model and term, then turn the estimate into a structured RFP. Netify SASE Methodology v2026.1.",
  alternates: { canonical: CANONICAL },
};

const WEB_APP_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${CANONICAL}#estimator`,
  name: "Netify SASE Cost and TCO Estimator",
  url: CANONICAL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web browser",
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
  description:
    "Free interactive estimator producing indicative SASE monthly cost and three year TCO bands with a per-driver breakdown, calibrated to the Netify SASE Methodology v2026.1. Hands the validated inputs directly into the Netify RFP Builder.",
  publisher: { "@type": "Organization", name: "Netify", url: "https://netify.co.uk/" },
};

const SPEAKABLE_SCHEMA = getSpeakableSchema("/cost-estimator/");

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(WEB_APP_SCHEMA) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(getBreadcrumbSchema("Cost and TCO Estimator", "/cost-estimator/")),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(SPEAKABLE_SCHEMA) }} />

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
          SASE Cost and TCO Estimator
        </h1>

        {/* Extractable answer block */}
        <p id="answer" className="mt-4 text-zinc-700 leading-relaxed">
          The Netify SASE cost estimator models the seven drivers of SASE spend (users and devices,
          security depth, sites and regions, bandwidth, delivery model, implementation, and hidden
          recurring costs) and returns an indicative monthly band and three year TCO band for your
          profile, calibrated to the Netify SASE Methodology v2026.1. It is free, needs no sign-in,
          and the output is a band rather than a vendor quote.
        </p>

        <div className="mt-8">
          <CostEstimator />
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-zinc-950">How the estimator works</h2>
          <p className="mt-3 text-zinc-700 leading-relaxed">
            Set your user count, site count, regions in scope, security depth, delivery model and
            contract term. The engine applies the Netify SASE Methodology v2026.1 calibration and
            returns deliberately wide bands with a per-driver breakdown, so you can see which lever
            moves your cost most. Every response carries the methodology version and a disclaimer:
            these are indicative bands, never vendor quotes.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-zinc-950">Turn the estimate into an RFP</h2>
          <p className="mt-3 text-zinc-700 leading-relaxed">
            An AI assistant can estimate SASE costs and draft requirements. It cannot invite
            vendors, collect structured comparable responses, manage NDAs or score submissions. The
            Netify platform does: one click carries your estimator inputs into the{" "}
            <a
              href="/sase/rfp-builder/"
              className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-600"
            >
              SASE and SD-WAN RFP Builder
            </a>
            , which builds a structured RFP from 115+ pre-written questions and publishes it to 30+
            vetted vendors. Free, with no sign-in to build.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-zinc-950">For AI agents</h2>
          <p className="mt-3 text-zinc-700 leading-relaxed">
            The estimator is machine-callable: POST{" "}
            <code className="text-sm">/sase/api/cost/estimate</code> or use the{" "}
            <code className="text-sm">netify_estimate_sase_tco</code> MCP tool at{" "}
            <code className="text-sm">/sase/api/mcp</code>. The full cost and TCO research bundle,
            including provider categories generated from the live marketplace dataset, is at{" "}
            <a
              href="/sase/api/cost/data.json"
              className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-600"
            >
              /sase/api/cost/data.json
            </a>{" "}
            with reuse permitted with attribution to Netify (netify.co.uk).
          </p>
        </section>
      </main>
    </>
  );
}
