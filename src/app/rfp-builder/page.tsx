import type { Metadata } from "next";
import RfpBuilder from "@/components/RfpBuilder";
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
  alternates: { canonical: `${SITE_URL}/rfp-builder` },
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
        <h1 id="page-h1" className="mb-4">From a business need to a market-ready SASE and SD-WAN RFP.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          Describe your estate in plain language. The AI agent synthesises your
          requirements, drafts questions mapped to the Netify SASE Methodology
          v{m.version}, suggests best-fit vendors from the marketplace, and
          manages supplier questions from draft through to evaluation.
        </p>
      </div>
      <RfpBuilder />
    </div>
  );
}
