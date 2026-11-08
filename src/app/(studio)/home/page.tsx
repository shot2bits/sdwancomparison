import type { Metadata } from "next";
import OpportunityStudio from "@/components/opportunity-studio/OpportunityStudio";
import { canonicalQuestions } from "@/lib/rfp-question-bank";
import {
  RFP_META_DESCRIPTION,
  RFP_DEFINITIONS,
} from "@/components/procurement/ProcurementEntry";
import RfpPublicContent from "@/components/procurement/RfpPublicContent";
import RfpCitationEvidence from "@/components/procurement/RfpCitationEvidence";
import CommercialFooter from "@/components/CommercialFooter";
import SiteFooter from "@/components/SiteFooter";
import { getOrganizationSchema } from "@/lib/structured-data";
import "@/components/opportunity-studio/studio.css";
const APEX = "https://netify.co.uk";
const BUILDER_URL = `${APEX}/sase-sd-wan-rfp-builder/`;
export const metadata: Metadata = {
  title: "Free SD-WAN and SASE RFP Builder and Template",
  description: RFP_META_DESCRIPTION,
  alternates: { canonical: BUILDER_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Free SD-WAN and SASE RFP Builder and Template | Netify",
    description: RFP_META_DESCRIPTION,
    url: BUILDER_URL,
    type: "website",
    locale: "en_GB",
  },
};
export default function Page() {
  const schemas = [
    getOrganizationSchema(),
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": BUILDER_URL + "#webapplication",
      name: "Netify SASE and SD-WAN Opportunity Studio",
      url: BUILDER_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Build a short RFI or detailed RFP, verify your work email, publish an anonymous opportunity and choose which approved suppliers may engage. Private project access is available through MCP.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
      softwareVersion: "opportunity-studio/1",
    },
  ];
  return (
    <>
      <main id="main-content">
        {schemas.map((s, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
          />
        ))}
        <OpportunityStudio
          questions={canonicalQuestions()}
          testEnvironment={process.env.VERCEL_ENV !== "production"}
        />
        <details className="ns-buying-guide">
          <summary>
            SASE and SD-WAN RFP guidance, examples and methodology
          </summary>
          <dl>
            {RFP_DEFINITIONS.map((d) => (
              <div key={d.term}>
                <dt>{d.term}</dt>
                <dd>{d.text}</dd>
              </div>
            ))}
          </dl>
          <RfpPublicContent />
          <RfpCitationEvidence />
        </details>
      </main>
      <SiteFooter>
        <CommercialFooter />
      </SiteFooter>
    </>
  );
}
