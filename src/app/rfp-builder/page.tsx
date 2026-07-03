import type { Metadata } from "next";
import RfpBuilder from "@/components/RfpBuilder";
import RfpBuilderPathCards from "@/components/RfpBuilderPathCards";
import { buildMethodology } from "@/lib/rfp-methodology";
import { featureList } from "@/lib/capabilities";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "SASE & SD-WAN RFP Builder: AI Agent (2026)",
  description:
    "Build a market-ready SASE and SD-WAN RFP with an AI agent: requirement synthesis, methodology-backed questions, vendor suggestions and supplier Q&A.",
  alternates: { canonical: `${SITE_URL}/rfp-builder/` },
  openGraph: {
    title: "SASE & SD-WAN RFP Builder: AI Agent (2026)",
    description: "From a vague business need to a market-ready RFP, guided by an AI agent backed by the Netify evaluation methodology.",
    url: `${SITE_URL}/rfp-builder`,
    type: "website",
    locale: "en_GB",
  },
};

export default function RfpBuilderPage() {
  const m = buildMethodology();
  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/rfp-builder#app`,
    name: "Netify SASE and SD-WAN RFP Builder",
    url: `${SITE_URL}/rfp-builder`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Agentic RFP builder for SASE and SD-WAN procurement. Synthesises requirements from business context, generates methodology-backed questions, suggests best-fit vendors and manages the supplier clarification loop through the RFP lifecycle.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    provider: { "@id": `${SITE_URL}/#organization` },
    softwareVersion: m.version,
    featureList: featureList(),
  };
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("RFP builder", "/rfp-builder"), getSpeakableSchema("/rfp-builder"), webApp];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Agentic RFP builder</p>
        <h1 id="page-h1" className="mb-4">Post a SASE or SD-WAN project, build an RFP, and invite verified providers.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          Start with a short project notice or create a full RFP. Netify helps you structure
          the requirement, publish it to the right suppliers and compare responses — with
          questions mapped to the Netify SASE Methodology v{m.version}.
        </p>
      </div>

      {/* Four buyer paths. The full RFP is one route, not the only route.
          Collapses to a slim strip once an RFP is underway (client wrapper);
          the cards stay server-rendered for crawlers. */}
      <RfpBuilderPathCards>
        <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a href="/sase/opportunities/new/" className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
            <h2 className="text-base font-semibold mb-1">Post a project</h2>
            <p className="text-sm text-[var(--ink-700)]">Publish a short opportunity notice in minutes. Best for early pricing, discovery calls or supplier interest.</p>
          </a>
          <a href="#build" className="relative block rounded-sm border border-amber-500 bg-amber-50 p-5 no-underline text-inherit transition-colors hover:bg-amber-100">
            <span className="absolute -top-2.5 left-4 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-950">You&apos;re here</span>
            <h2 className="text-base font-semibold mb-1">Build a full RFP</h2>
            <p className="text-sm text-[var(--ink-700)]">Create a structured SASE, SSE or SD-WAN RFP using Netify&apos;s question bank and AI gap checking. Start below on this page.</p>
          </a>
          <a href="/sase/opportunities/board/" className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
            <h2 className="text-base font-semibold mb-1">Browse opportunities</h2>
            <p className="text-sm text-[var(--ink-700)]">See open SASE, SSE and SD-WAN projects on the marketplace.</p>
          </a>
          <a href="/sase/rfp-builder/start/" className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
            <h2 className="text-base font-semibold mb-1">Not sure?</h2>
            <p className="text-sm text-[var(--ink-700)]">Answer a few questions and Netify will recommend the right route.</p>
          </a>
        </div>

        <p className="mb-12 -mt-8 text-sm text-[var(--ink-600)]">
          Know your route already? Read about{" "}
          <a href="/sase/rfp-builder/sase/" className="underline">the SASE RFP path</a>,{" "}
          <a href="/sase/rfp-builder/sd-wan/" className="underline">the SD-WAN RFP path</a> or{" "}
          <a href="/sase/rfp-builder/sse/" className="underline">the SSE RFP path</a> — each explains what&apos;s in scope
          and shows sample questions from the bank, then starts this same builder preloaded for that scope. There is one
          builder; the paths just set it up for you.
        </p>
      </RfpBuilderPathCards>

      <div id="build" />
      <RfpBuilder />
    </div>
  );
}
