/**
 * JSON-LD helpers. All schemas emitted by shortlist surfaces live here.
 * Schema.org class names keep US spelling by specification.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://netify.co.uk/sase";

export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Netify",
    url: "https://netify.co.uk",
    logo: "https://netify.co.uk/opengraph-image.png",
    sameAs: ["https://netify.co.uk", "https://insights.netify.co.uk"],
  };
}

export function getBreadcrumbSchema(pageName: string, pagePath: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: pageName, item: `${SITE_URL}${pagePath}` },
    ],
  };
}

export function getSpeakableSchema(pagePath: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}${pagePath}#webpage`,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#page-h1", "#page-subhead"],
    },
  };
}

export function getShortlistWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/shortlist#webapplication`,
    name: "Netify SASE and SD-WAN Shortlist Builder",
    url: `${SITE_URL}/shortlist`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Interactive tool that builds a bespoke SASE and SD-WAN provider shortlist from 30 graded vendors. Filter by operating model, region, cloud support, AI capability, resilience and 40 capability features, or describe requirements in plain language to the AI advisor.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

export function getShortlistDatasetSchema(vendorCount: number, featureCount: number) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${SITE_URL}/shortlist#dataset`,
    name: "Netify SASE and SD-WAN vendor capability matrix",
    description: `Capability grades for ${vendorCount} SASE and SD-WAN vendors across ${featureCount} features plus regional coverage, cloud support, AI capability, resilience and deployment speed. Grades reflect public source evidence reviewed by Netify.`,
    url: `${SITE_URL}/shortlist`,
    license: "https://netify.co.uk/terms-conditions/",
    creator: { "@id": `${SITE_URL}/#organization` },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${SITE_URL}/shortlist/data.json`,
      },
    ],
  };
}

export function getShortlistFaqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
