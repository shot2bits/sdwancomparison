/**
 * Definitions for the statically generated listicle landing pages at
 * /best/[slug]. Each page is a server-rendered, citable ranked list
 * driven by the same shortlist engine as the interactive tool.
 */

import {
  INTENT_LABELS,
  ORG_SIZE_LABELS,
  SECTOR_LABELS,
  type IntentKey,
  type OrgSizeKey,
  type SectorKey,
  type ShortlistInput,
} from "@/lib/shortlist-core";

export type BestPage = {
  slug: string;
  /** Partial engine input that defines the page. */
  input: Partial<ShortlistInput>;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  faqs: { q: string; a: string }[];
};

const YEAR = "2026";

function sectorPage(key: SectorKey, slugPart: string, sectorContext: string): BestPage {
  const label = SECTOR_LABELS[key];
  return {
    slug: `sd-wan-sase-providers-for-${slugPart}`,
    input: { sector: key, shortlist_size: 10 },
    title: `Best SD-WAN and SASE providers for ${label}`,
    metaTitle: `Best SD-WAN and SASE Providers for ${label} (${YEAR})`,
    metaDescription: `Ranked ${YEAR} shortlist of SD-WAN and SASE providers with ${label.toLowerCase()} sector evidence, scored across 40 capability features by Netify.`,
    h1: `Best SD-WAN and SASE providers for ${label.toLowerCase()} (${YEAR})`,
    intro: `Ranked shortlist of SD-WAN and SASE providers with public evidence of ${label.toLowerCase()} sector capability, scored against the Netify 40-feature evaluation matrix plus regional coverage, cloud support, AI capability and resilience. ${sectorContext} Sector grades are indicative desk research; confirm via RFP.`,
    faqs: [
      {
        q: `Which SD-WAN and SASE providers are strongest for ${label.toLowerCase()}?`,
        a: `Based on the Netify capability matrix, the leading providers for ${label.toLowerCase()} are listed in the ranking above. Each is graded on public evidence of sector capability, such as case studies, dedicated offerings and certifications, alongside 40 technical and service features.`,
      },
      {
        q: `How is this ${label.toLowerCase()} ranking calculated?`,
        a: `Providers without confirmed ${label.toLowerCase()} sector evidence are excluded. The remainder are scored on a weighted average across 40 capability features (graded yes, partial, via partner, via managed service, not primary or not confirmed) with the sector grade weighted at double. The same engine powers the interactive shortlist builder, the MCP tool and this page, so results are reproducible.`,
      },
      {
        q: `Can I adjust this shortlist for my own requirements?`,
        a: `Yes. The interactive shortlist builder lets you add your operating model, regions, clouds, security features, AI requirements and deployment ceiling on top of the ${label.toLowerCase()} filter. Every configuration is a shareable URL.`,
      },
    ],
  };
}

function orgPage(key: OrgSizeKey, slugPart: string): BestPage {
  const label = ORG_SIZE_LABELS[key];
  return {
    slug: `sd-wan-sase-providers-for-${slugPart}`,
    input: { organisation_size: key, shortlist_size: 10 },
    title: `Best SD-WAN and SASE providers for ${label.toLowerCase()}`,
    metaTitle: `Best SD-WAN and SASE Providers: ${label} (${YEAR})`,
    metaDescription: `Ranked ${YEAR} shortlist of SD-WAN and SASE providers positioned for ${label.toLowerCase()} buyers, scored across 40 features by Netify.`,
    h1: `Best SD-WAN and SASE providers for ${label.toLowerCase()} (${YEAR})`,
    intro: `Ranked shortlist of SD-WAN and SASE providers positioned for ${label.toLowerCase()} organisations, scored against the Netify 40-feature evaluation matrix. Organisation fit grades reflect public positioning, reference customers and commercial models, and are indicative desk research; confirm via RFP.`,
    faqs: [
      {
        q: `Which SD-WAN and SASE providers fit ${label.toLowerCase()} organisations best?`,
        a: `The ranking above lists providers with confirmed positioning for ${label.toLowerCase()} buyers, ordered by weighted capability score across the Netify 40-feature matrix.`,
      },
      {
        q: "How is this ranking calculated?",
        a: "Providers without evidence of fit for this organisation size are excluded; the rest are scored on a weighted average across 40 graded capability features. The same engine powers the interactive shortlist builder and the MCP tool.",
      },
      {
        q: "Can I refine this list?",
        a: "Yes. Open the interactive shortlist builder to layer sector, regions, security features, operating model and deployment speed on top of this view. Every configuration is a shareable URL.",
      },
    ],
  };
}

function intentPage(key: IntentKey, slugPart: string, context: string): BestPage {
  const label = INTENT_LABELS[key];
  return {
    slug: `sd-wan-sase-providers-for-${slugPart}`,
    input: { intent: key, shortlist_size: 10 },
    title: `Best SD-WAN and SASE providers for ${label.toLowerCase()}`,
    metaTitle: `Best SD-WAN and SASE Providers for ${label} (${YEAR})`,
    metaDescription: `Ranked ${YEAR} shortlist of SD-WAN and SASE providers for ${label.toLowerCase()} projects, scored across 40 features by Netify.`,
    h1: `Best SD-WAN and SASE providers for ${label.toLowerCase()} (${YEAR})`,
    intro: `Ranked shortlist of SD-WAN and SASE providers for buyers prioritising ${label.toLowerCase()}. ${context} Scores use the Netify 40-feature matrix with weighting adjusted for this priority. Grades are based on public evidence; confirm via RFP.`,
    faqs: [
      {
        q: `Which SD-WAN and SASE providers are best for ${label.toLowerCase()}?`,
        a: `The ranking above orders providers by weighted capability score with feature weighting tuned for ${label.toLowerCase()}: the features that matter most for this priority carry more than double weight.`,
      },
      {
        q: "How is this ranking calculated?",
        a: "All 30 providers in the Netify matrix are scored on a weighted average across 40 graded capability features, with this page's priority preset boosting the most relevant features. The same engine powers the interactive shortlist builder and the MCP tool.",
      },
      {
        q: "Can I refine this list?",
        a: "Yes. Open the interactive shortlist builder to add your sector, regions, operating model and security requirements on top of this priority. Every configuration is a shareable URL.",
      },
    ],
  };
}

const FLAGSHIP_PAGES: BestPage[] = [
  {
    slug: "sd-wan-providers",
    input: { shortlist_size: 10 },
    title: "Best SD-WAN providers",
    metaTitle: `Best SD-WAN Providers (${YEAR}): 30 Vendors Ranked`,
    metaDescription: `Netify's ${YEAR} ranking of SD-WAN providers: 30 vendors scored across 40 capability features with public evidence grades. Top 10 with scores.`,
    h1: `Best SD-WAN providers (${YEAR}): 30 vendors ranked by evidence`,
    intro: `Netify's ${YEAR} evaluation grades 30 SD-WAN providers and vendors against 40 capability features using public source evidence, covering service model, transport, PoP and backbone design, security, and operations. The top 10 by weighted score are ranked below, each with score, deployment speed and caveats. Filter the full field by sector, region, cloud and operating model in the interactive builder.`,
    faqs: [
      {
        q: "Who are the best SD-WAN providers in " + YEAR + "?",
        a: "Based on the Netify 40-feature evidence matrix (June " + YEAR + "), the top-ranked providers are listed above with their weighted scores. Leaders include Cato Networks, Fortinet, Versa Networks, Palo Alto Networks and BT Business among managed routes. The right choice depends on sector, regions, operating model and security requirements, which the interactive shortlist builder scores for free.",
      },
      {
        q: "How does Netify rank SD-WAN providers?",
        a: "Every provider is graded on the same 40 features (graded yes 1.0, via partner 0.75, via managed service 0.65, partial 0.5, not confirmed 0.15, not primary 0) plus regional coverage, cloud support, AI capability, resilience and deployment speed. Scores are weighted averages; the engine, grades and methodology are published and reproducible via the page URL, JSON twin and MCP tool.",
      },
      {
        q: "What is the difference between an SD-WAN vendor and an SD-WAN provider?",
        a: "Vendors build the platform (Cisco, Fortinet, Versa, VeloCloud); providers deliver it as a managed service over their networks (BT, Verizon, Orange, GTT). Many buyers procure a vendor platform through a provider. The Netify matrix grades both on the same scale so they can be compared in one shortlist.",
      },
    ],
  },
  {
    slug: "sase-providers",
    input: { weight_preset: "security_led", shortlist_size: 10 },
    title: "Best SASE providers",
    metaTitle: `Best SASE Providers (${YEAR}): 30 Vendors Ranked`,
    metaDescription: `Netify's ${YEAR} ranking of SASE providers and vendors: 30 platforms scored on ZTNA, SWG, CASB, DLP and SD-WAN convergence. Top 10 with scores.`,
    h1: `Best SASE providers (${YEAR}): ranked on security-led scoring`,
    intro: `Netify's ${YEAR} evaluation ranks 30 SASE and SD-WAN platforms with security-led weighting: ZTNA, SWG, CASB, DLP and FWaaS capability carry the most weight, alongside PoP coverage, identity integration and operating model. The top 10 are ranked below with scores and caveats. Adjust the weighting or add your sector, regions and clouds in the interactive builder.`,
    faqs: [
      {
        q: "Who are the best SASE providers in " + YEAR + "?",
        a: "With security-led weighting on the Netify 40-feature matrix (June " + YEAR + "), the leaders are ranked above with scores. Single-vendor SASE strength sits with Cato Networks, Fortinet, Palo Alto Prisma and Versa; SSE depth leaders Zscaler and Netskope pair with third-party SD-WAN; BT Managed SASE leads UK managed routes.",
      },
      {
        q: "Single-vendor SASE or best-of-breed: which should I choose?",
        a: "Single-vendor SASE (Cato, Fortinet, Palo Alto, Versa) gives one console and policy model with simpler operations. Best-of-breed pairs an SSE leader (Zscaler, Netskope) with a dedicated SD-WAN vendor for maximum per-category depth at the cost of integration. The shortlist builder scores both patterns against your requirements.",
      },
      {
        q: "How is this SASE ranking calculated?",
        a: "All 30 platforms are scored on the same published evidence grades with security features weighted 1.8x under the security-led profile. Scoring is deterministic and reproducible: the same criteria at the canonical URL, the JSON twin or the MCP tool return the same ranking.",
      },
    ],
  },
];

export const BEST_PAGES: BestPage[] = [
  ...FLAGSHIP_PAGES,
  sectorPage("healthcare", "healthcare", "Typical drivers include clinical application performance, site resilience for 24x7 care settings and patient data protection."),
  sectorPage("financial_services", "financial-services", "Typical drivers include low-latency connectivity, regulatory compliance and strong data loss prevention."),
  sectorPage("retail_ecommerce", "retail", "Typical drivers include rapid store rollout, PCI segmentation, cellular backup and centralised management at scale."),
  sectorPage("manufacturing", "manufacturing", "Typical drivers include OT and IoT security, plant connectivity, global site coverage and MPLS migration."),
  sectorPage("energy_utilities", "energy-and-utilities", "Typical drivers include remote site coverage, OT security and high-resilience designs for critical infrastructure."),
  sectorPage("government_public_sector", "government", "Typical drivers include sovereignty and data residency, certified security and framework procurement routes."),
  sectorPage("education", "education", "Typical drivers include campus scale, content filtering, budget-led commercial models and easy management."),
  sectorPage("transport_logistics", "transport-and-logistics", "Typical drivers include vehicle and vessel connectivity, cellular-first designs and wide-area site coverage."),
  sectorPage("professional_services", "professional-services", "Typical drivers include hybrid work security, client data confidentiality and fast multi-office deployment."),
  sectorPage("hospitality_leisure", "hospitality", "Typical drivers include guest Wi-Fi separation, PCI compliance, multi-site rollout and cost-effective bandwidth."),
  orgPage("large_global_enterprise", "large-global-enterprises"),
  orgPage("mid_market", "mid-market"),
  orgPage("small_business", "small-business"),
  intentPage("cost_saving", "cost-saving", "Typical moves include replacing MPLS with broadband and internet underlays, local breakout and flexible commercial terms."),
  intentPage("mpls_migration", "mpls-migration", "Typical projects run MPLS and SD-WAN side by side during transition, with managed last-mile and dynamic path control."),
  intentPage("rapid_deployment", "rapid-deployment", "Typical needs include cloud-delivered onboarding, zero-touch provisioning and cellular options for instant connectivity."),
  intentPage("remote_workforce", "remote-and-hybrid-work", "Typical needs include ZTNA for private apps, secure web access for any location and consistent policy off-network."),
  intentPage("security_consolidation", "security-consolidation", "Typical goals include collapsing point security products into a single SASE platform with one policy and one console."),
  intentPage("global_expansion", "global-expansion", "Typical needs include private backbones, regional breakout, data residency control and coverage into new markets."),
];

export function getBestPage(slug: string): BestPage | undefined {
  return BEST_PAGES.find((p) => p.slug === slug);
}
