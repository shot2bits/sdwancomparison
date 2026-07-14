import type { Metadata } from "next";
import DescribeWizard from "@/components/DescribeWizard";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";

// /rfp-builder/new/ - the Describe step of the Describe, Generate, Publish
// flow (docs/netify-rfp-flow-spec-2026-07-14.md). Server-rendered intro so
// the page is indexable and citable; the wizard itself is a client island.

export const metadata: Metadata = {
  title: "Start a SASE or SD-WAN Project: Two-Minute Brief",
  description:
    "Describe your SASE or SD-WAN project in two minutes. Netify builds the full RFP from its question bank and shows which verified suppliers match before you publish.",
  alternates: { canonical: `${SITE_URL}/rfp-builder/new/` },
  openGraph: {
    title: "Start a SASE or SD-WAN Project: Two-Minute Brief",
    description:
      "Five quick questions, then Netify assembles a complete RFP you review, trim and publish to verified vendors and managed providers.",
    url: `${SITE_URL}/rfp-builder/new/`,
    type: "website",
    locale: "en_GB",
  },
};

export default function NewProjectPage() {
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Start your project", "/rfp-builder/new"),
    getSpeakableSchema("/rfp-builder/new"),
  ];
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Start your project</p>
        <h1 id="page-h1" className="mb-4">Describe your SASE or SD-WAN project in two minutes.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          Answer five quick questions and Netify assembles a complete RFP from its question bank,
          shows which verified suppliers match, and lets you publish to the marketplace when you
          are ready. Free for buyers, and nothing is shared until you choose to publish.
        </p>
      </div>
      <DescribeWizard />
    </div>
  );
}
