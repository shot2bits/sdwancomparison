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
    metaTitle: `Best SD-WAN and SASE: ${label} (${YEAR})`,
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
    metaTitle: `Best SD-WAN and SASE: ${label} (${YEAR})`,
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
    metaTitle: `Best SD-WAN and SASE: ${label} (${YEAR})`,
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
  ];

export const BEST_PAGES: BestPage[] = [
  ...FLAGSHIP_PAGES,
  {
    slug: "managed-sd-wan-providers",
    input: { service_model: "managed", shortlist_size: 10 },
    title: "Best managed SD-WAN providers",
    metaTitle: `Best Managed SD-WAN Providers (${YEAR}): Top 10 Ranked`,
    metaDescription: `Netify's ${YEAR} ranking of managed SD-WAN service providers: fully managed offers scored across 40 evidence-graded features. Top 10 with scores.`,
    h1: `Best managed SD-WAN providers (${YEAR}): top 10 ranked`,
    intro: `Netify's ${YEAR} evaluation ranks managed SD-WAN service providers: vendors and carriers with public evidence of a fully managed operating model, scored across 40 capability features including last-mile circuit management, lifecycle, SLA-backed service and security. The top 10 are ranked below with scores. Add your sector, regions and security requirements in the interactive builder.`,
    faqs: [
      {
        q: "Who are the best managed SD-WAN service providers in " + YEAR + "?",
        a: "Based on the Netify evidence matrix (June " + YEAR + "), the leading fully managed routes are ranked above with scores. They span carriers (BT, Verizon, Orange, NTT, GTT, Vodafone, Colt) and managed-service-first platforms (Cato, Aryaka). The right fit depends on your regions, sector and how much control you want to keep, which the interactive shortlist builder scores against all 30 providers.",
      },
      {
        q: "What is the difference between managed and co-managed SD-WAN?",
        a: "Fully managed means the provider owns design, deployment, monitoring, changes and incident response end to end, usually including circuits. Co-managed shares control: your team keeps policy visibility and agreed change rights while the provider runs the platform and underlay. Most providers in this ranking offer both; the matrix grades each model separately.",
      },
      {
        q: "Should I buy SD-WAN from a carrier or direct from a vendor?",
        a: "Carriers bundle circuits, deployment and 24x7 operations under one contract with named service management, which suits estates without deep network teams. Buying direct (DIY) gives maximum control and typically lower cost for capable teams. The shortlist builder lets you filter by operating model to compare both routes on the same scoring.",
      },
    ],
  },
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
