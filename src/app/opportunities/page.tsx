import type { Metadata } from "next";
import OpportunityBuyer from "@/components/OpportunityBuyer";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Post a live SASE & SD-WAN opportunity | Netify",
  description: "Post a network opportunity, from underlay circuits to full SASE, and have graded suppliers reply in real time with comments and indicative pricing.",
  alternates: { canonical: `${SITE_URL}/opportunities` },
  openGraph: { title: "Post a live SASE & SD-WAN opportunity", description: "Graded suppliers reply in real time with comments and pricing.", url: `${SITE_URL}/opportunities`, type: "website", locale: "en_GB" },
};

export default function OpportunitiesPage() {
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("Opportunities", "/opportunities"), getSpeakableSchema("/opportunities")];
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Live marketplace</p>
        <h1 id="page-h1" className="mb-4">Post an opportunity. Watch suppliers respond in real time.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Describe what you need, from just underlay circuits to full SASE, SSE and SD-WAN. Invite graded suppliers from the Netify marketplace and see them reply live with comments and indicative pricing.</p>
      </div>
      <OpportunityBuyer />
    </div>
  );
}
