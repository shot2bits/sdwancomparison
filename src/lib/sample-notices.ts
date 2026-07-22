/**
 * Sample project notices: static, clearly labelled worked examples. They show
 * buyers what a good notice looks like and give crawlers and AI agents fully
 * server-rendered example pages even when the live board is quiet. They are
 * NEVER mixed into the live board data as real opportunities: every surface
 * that renders one labels it as a sample, and data.json feeds flag is_sample.
 */

import type { PublicOpportunity } from "@/lib/opportunity-types";

export type SampleNotice = PublicOpportunity & { slug: string; is_sample: true };

const BASE = {
  status: "open" as const,
  engagement_type: "quote_room" as const,
  auction_format: "open" as const,
  deadline: null,
  eligibility: "open" as const,
  invited_count: 0,
  bid_count: 0,
  comment_count: 0,
  budget_note: "",
  ai_assumptions: [],
  ai_gap_flags: [],
  methodology_version: "sase-marketplace-2026.1",
};

const DAY = 86_400_000;
const now = () => Date.now();

export const SAMPLE_NOTICES: SampleNotice[] = [
  {
    ...BASE,
    slug: "sample-uk-retailer-sd-wan-managed-underlay",
    is_sample: true,
    id: "sample_retail_sdwan",
    created: now() - 3 * DAY,
    updated: now() - 1 * DAY,
    last_activity: now() - 1 * DAY,
    title: "SD-WAN with managed underlay and firewall for 38 UK retail sites",
    buyer_org: "",
    buyer_visibility: "anonymous",
    buyer_sector: "retail_ecommerce",
    buyer_size_band: "mid_market",
    scope: ["sd_wan", "underlay_circuits", "firewall_fwaas", "managed_service"],
    sites: 38,
    regions: ["uk_ireland"],
    users_band: "500-2500",
    remote_users_band: "under_100",
    cloud_platforms: ["azure", "microsoft_365"],
    summary:
      "UK retailer with 38 stores plus a distribution centre replacing an ageing MPLS estate. We need managed SD-WAN with underlay circuits, local internet breakout for store systems, and a managed firewall service. Stores trade seven days a week, so migration must be phased with no trading-hours downtime.",
    current_environment:
      "MPLS WAN from a single carrier, contract ending in nine months. Branch firewalls at end of support. Azure-hosted retail platform and Microsoft 365.",
    desired_outcomes:
      "Lower per-site connectivity cost, faster store openings, centrally managed security policy, and clear SLAs with a single accountable provider.",
    compliance_requirements: ["pci_dss", "uk_gdpr"],
    evidence_requested: ["sector_references", "sla_schedule", "migration_plan", "pricing_structure"],
    evaluation_priorities: ["price", "managed_service", "migration_approach", "sector_experience"],
    response_mode: "indicative_pricing",
    response_deadline: now() + 14 * DAY,
    decision_target: now() + 45 * DAY,
    go_live_target: now() + 180 * DAY,
    timeline_note: "MPLS contract expires in nine months; phased migration must complete before then.",
    ai_summary:
      "A mid-market UK retailer (anonymous) is seeking indicative pricing for managed SD-WAN across 38 stores, including underlay circuits and managed firewall. Suitable respondents include managed SD-WAN providers and carriers with UK retail experience and PCI DSS credentials. Pricing responses are private to the buyer.",
  },
  {
    ...BASE,
    slug: "sample-financial-services-sase-remote-workforce",
    is_sample: true,
    id: "sample_finserv_sase",
    created: now() - 5 * DAY,
    updated: now() - 2 * DAY,
    last_activity: now() - 2 * DAY,
    title: "SASE platform for a hybrid workforce of 3,200 across UK and Europe",
    buyer_org: "",
    buyer_visibility: "anonymous",
    buyer_sector: "financial_services",
    buyer_size_band: "enterprise",
    scope: ["sase", "ztna", "swg", "sse"],
    sites: 12,
    regions: ["uk_ireland", "europe"],
    users_band: "2500-10000",
    remote_users_band: "2500-10000",
    cloud_platforms: ["aws", "azure", "microsoft_365"],
    summary:
      "Financial services firm consolidating VPN, web proxy and CASB point products into a single SASE platform. 12 offices, 3,200 users, most hybrid. ZTNA replacing legacy VPN is the first priority; branch SD-WAN refresh may follow as phase two.",
    current_environment:
      "Legacy VPN concentrators, on-premises web proxy nearing end of life, separate CASB. AWS and Azure workloads; Microsoft 365 throughout.",
    desired_outcomes:
      "Single policy across users and offices, faster access to cloud workloads, demonstrable zero-trust controls for regulators, and consolidated vendor spend.",
    compliance_requirements: ["dora", "iso_27001", "uk_gdpr"],
    evidence_requested: ["security_certifications", "sector_references", "coverage_evidence", "support_model"],
    evaluation_priorities: ["security_capability", "sector_experience", "sla", "coverage"],
    response_mode: "written_responses",
    response_deadline: now() + 21 * DAY,
    decision_target: now() + 60 * DAY,
    go_live_target: now() + 270 * DAY,
    timeline_note: "Written responses within three weeks; shortlist demos the following month.",
    ai_summary:
      "An enterprise financial services buyer (anonymous) requests written responses for a SASE platform covering 3,200 hybrid users across UK and Europe, prioritising ZTNA, regulatory evidence (DORA, ISO 27001) and sector references. Suitable respondents include SASE platform vendors and managed SSE providers with financial services experience.",
  },
  {
    ...BASE,
    slug: "sample-healthcare-sase-clinical-sites",
    is_sample: true,
    id: "sample_health_sase",
    created: now() - 2 * DAY,
    updated: now() - 1 * DAY,
    last_activity: now() - 1 * DAY,
    title: "Managed SASE for 23 clinical and community sites with NHS DSPT evidence",
    buyer_org: "",
    buyer_visibility: "anonymous",
    buyer_sector: "healthcare",
    buyer_size_band: "mid_market",
    scope: ["sase", "sd_wan", "ztna", "managed_service"],
    sites: 23,
    regions: ["uk_ireland"],
    users_band: "2500-10000",
    remote_users_band: "500-2500",
    cloud_platforms: ["azure", "microsoft_365"],
    summary:
      "Healthcare provider running 23 clinical and community sites on a mix of MPLS and consumer-grade broadband. We need a fully managed SASE service: resilient connectivity for 24x7 care settings, zero-trust access for community and home-working clinical staff, and central policy over patient-data flows. Clinical systems cannot take planned downtime during care hours, so migration windows are overnight and agreed site by site.",
    current_environment:
      "MPLS at 9 acute sites, broadband elsewhere, ageing site firewalls, legacy VPN for remote clinicians. Azure-hosted clinical applications and Microsoft 365; some legacy on-premises systems remain.",
    desired_outcomes:
      "Site resilience appropriate to clinical risk, one policy across staff and locations, NHS DSPT evidence maintained without bespoke work each year, and a single accountable provider with UK support.",
    compliance_requirements: ["nhs_dspt", "uk_gdpr", "cyber_essentials_plus"],
    evidence_requested: ["security_certifications", "sector_references", "sla_schedule", "migration_plan", "support_model"],
    evaluation_priorities: ["resilience", "security_capability", "sector_experience", "managed_service"],
    response_mode: "written_responses",
    response_deadline: now() + 21 * DAY,
    decision_target: now() + 75 * DAY,
    go_live_target: now() + 300 * DAY,
    timeline_note: "Written responses within three weeks; clinical safety review before shortlist; phased overnight migration agreed per site.",
    ai_summary:
      "A UK healthcare provider (anonymous) requests written responses for managed SASE across 23 clinical and community sites, prioritising resilience for 24x7 care, zero-trust access for clinical staff, and NHS DSPT plus Cyber Essentials Plus evidence. Suitable respondents include managed SASE and SD-WAN providers with healthcare references and UK support. Pricing responses are private to the buyer.",
  },
];

export function getSampleNotice(slug: string): SampleNotice | null {
  return SAMPLE_NOTICES.find((s) => s.slug === slug) ?? null;
}
