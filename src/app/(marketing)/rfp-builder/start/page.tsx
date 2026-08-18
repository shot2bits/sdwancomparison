import type { Metadata } from "next";
import RouteDiagnosis from "@/components/RouteDiagnosis";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Post a project, build an RFP, or start with a shortlist?",
  description:
    "Not sure how to approach your SASE, SSE or SD-WAN procurement? Answer three questions and Netify recommends the right route: a quick RFI, a full RFP, or a graded shortlist.",
  alternates: { canonical: `${SITE_URL}/rfp-builder/start/` },
  openGraph: {
    title: "Which procurement route fits your project?",
    description: "Three questions. One recommended route: RFI, full RFP or shortlist.",
    url: `${SITE_URL}/rfp-builder/start`,
    type: "website",
    locale: "en_GB",
  },
};

export default function RfpStartPage() {
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("Choose your route", "/rfp-builder/start"), getSpeakableSchema("/rfp-builder/start")];
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Choose your route</p>
        <h1 id="page-h1" className="mb-4">Not sure whether you need an RFI, an RFP or a shortlist?</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          Many buyers do not need a full RFP to start. Answer three questions and Netify recommends the fastest
          useful route. Nothing is gated: you can draft, preview and explore every path without signing in.
        </p>
      </div>
      <RouteDiagnosis />
    </div>
  );
}
