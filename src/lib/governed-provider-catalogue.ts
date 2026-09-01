import snapshot from "@data/governed-provider-catalogue.json";
import type { CapabilityStatus, ShortlistVendor } from "@/lib/shortlist-core";

export const GOVERNED_SHORTLIST_CONTRACT_VERSION = "governed-shortlist/1.0.0" as const;

type GovernedRecord = (typeof snapshot.providers)[number];
type SupportState = GovernedRecord["capabilities"][number]["support_state"];

const SLUGS: Record<string, string> = {
  aryaka: "aryaka", att: "att-business", "barracuda-secureedge": "barracuda-secureedge", bt: "bt-business",
  "cato-networks": "cato-networks", checkpoint: "check-point", cisco: "cisco", "cloudflare-one": "cloudflare-one",
  colt: "colt-technology-services", comcastbusiness: "comcast-business", "ericsson-cradlepoint": "cradlepoint-ericsson",
  expereo: "expereo", forcepoint: "forcepoint", "fortinet-fortisase": "fortinet", gtt: "gtt",
  "hpe-aruba-edgeconnect": "hpe-aruba", juniper: "juniper-networks", lumen: "lumen", netskope: "netskope",
  "ntt-data": "ntt", opensystems: "opensystems", orangebusiness: "orange-business",
  "palo-alto-prisma-sase": "palo-alto-networks", "sonicwall-cse": "sonicwall", velocloud: "arista-velocloud",
  verizon: "verizon-business", "versa-networks": "versa-networks", "virgin-media-o2": "virgin-media-o2",
  vodafone: "vodafone-business", zscaler: "zscaler",
};

const NAMES: Record<string, string> = {
  aryaka: "Aryaka", att: "AT&T Business", "barracuda-secureedge": "Barracuda SecureEdge", bt: "BT", checkpoint: "Check Point",
  "cato-networks": "Cato Networks", cisco: "Cisco", "cloudflare-one": "Cloudflare One", expereo: "Expereo", forcepoint: "Forcepoint", gtt: "GTT",
  colt: "Colt Technology Services", comcastbusiness: "Comcast Business", "ericsson-cradlepoint": "Ericsson Cradlepoint",
  "fortinet-fortisase": "Fortinet FortiSASE", "hpe-aruba-edgeconnect": "HPE Aruba EdgeConnect", juniper: "Juniper Networks",
  lumen: "Lumen", netskope: "Netskope", "ntt-data": "NTT DATA", opensystems: "Open Systems", orangebusiness: "Orange Business",
  "palo-alto-prisma-sase": "Palo Alto Networks Prisma SASE", "sonicwall-cse": "SonicWall Cloud Secure Edge",
  velocloud: "VeloCloud", verizon: "Verizon Business", "versa-networks": "Versa Networks", "virgin-media-o2": "Virgin Media O2 Business",
  vodafone: "Vodafone Business", zscaler: "Zscaler",
};

const FEATURE_CODES: Partial<Record<keyof ShortlistVendor["capabilities"], string[]>> = {
  f10_dynamic_path_selection: ["dynamic_path_selection"],
  f12_application_aware_routing: ["application_aware_routing", "application_identification"],
  f13_qos_and_traffic_shaping: ["qos_and_traffic_engineering"],
  f14_packet_loss_remediation: ["forward_error_correction_packet_duplication", "wan_optimisation"],
  f15_local_internet_breakout: ["local_internet_breakout"],
  f17_cellular_and_5g_support: ["cap_5g_lte_support"],
  f18_cloud_on_ramp: ["multi_cloud_networking", "virtual_cloud_edge_support"],
  f19_public_cloud_gateways: ["virtual_cloud_edge_support"],
  f23_multi_cloud_transit_fabric: ["multi_cloud_networking"],
  f24_flexible_edge_form_factors: ["edge_form_factors"],
  f25_high_availability_design: ["high_availability"],
  f27_integrated_next_generation_firewall: ["firewall_as_a_service", "cloud_firewall_cloud_network_security"],
  f30_zero_trust_network_access: ["ztna"],
  f31_secure_web_gateway: ["secure_web_gateway"],
  f32_casb_capability: ["casb_inline", "casb_api"],
  f33_data_loss_prevention: ["data_loss_prevention", "dlp_events"],
  f38_observability_and_digital_experience_monitoring: ["digital_experience_monitoring", "digital_experience_diagnostics"],
};

const positive = new Set(["supported", "partially_supported", "partner_delivered"]);
function status(states: SupportState[]): CapabilityStatus {
  if (states.includes("supported")) return "yes";
  if (states.includes("partner_delivered")) return "partner_integrated";
  if (states.includes("partially_supported")) return "partial";
  if (states.length && states.every((state) => state === "not_supported")) return "not_primary";
  return "unknown";
}

function excerpt(overview: string) {
  const paragraph = overview.split(/\n{2,}/)[0].trim();
  const sentences = paragraph.match(/[^.!?]+[.!?]+(?:[”’"']|$)?/g) ?? [paragraph];
  const selected = sentences.slice(0, 2).join(" ").trim();
  return selected.length <= 700 ? selected : `${selected.slice(0, 697).trimEnd()}...`;
}

function blank(record: GovernedRecord): ShortlistVendor {
  const unknown = "unknown" as const;
  return {
    slug: SLUGS[record.provider.slug], name: NAMES[record.provider.slug] ?? record.provider.display_name,
    website: `https://netify.co.uk/marketplace/${record.provider.slug}/`, category: record.provider.provider_types.join(" / ").replaceAll("_", " "),
    product_focus: record.products.map((product) => product.name).slice(0, 4).join(", "), cost_model: "Confirm commercial model through RFP.",
    public_pricing_visibility: "quote_based", value_tier: "mid", uk_delivery: "global_managed", uk_basis: "Confirm UK delivery scope through RFP.",
    capabilities: {}, deployment_speed: unknown,
    regions: { uk_ireland: unknown, europe: unknown, north_america: unknown, asia_pacific: unknown, middle_east_africa: unknown, latin_america: unknown, china_mainland: unknown },
    supported_clouds: { aws: unknown, azure: unknown, gcp: unknown, oracle_cloud: unknown, alibaba_cloud: unknown },
    ai_capability: { ai_driven_operations: unknown, ai_security_analytics: unknown, ai_assistant: unknown, note: "Use the governed profile for current evidence." },
    resilience: { disaster_recovery: unknown, note: "Use the governed profile for current evidence." },
    sectors: { healthcare: unknown, financial_services: unknown, retail_ecommerce: unknown, manufacturing: unknown, energy_utilities: unknown, government_public_sector: unknown, education: unknown, transport_logistics: unknown, professional_services: unknown, hospitality_leisure: unknown },
    organisation_fit: { large_global_enterprise: unknown, mid_market: unknown, small_business: unknown }, pricing_units: ["custom_quote"],
    identity_providers: { entra_id: unknown, okta: unknown, ping: unknown, google_workspace: unknown }, device_posture: unknown,
    agent_platforms: { windows: unknown, macos: unknown, ios: unknown, android: unknown, linux: unknown, chromeos: unknown, agentless: unknown },
    pop_count: null, sla_availability_pct: null, support_model: { follow_the_sun_24x7: unknown, uk_support_desk: unknown, named_tam: unknown },
    logging: { siem_export: unknown, log_retention_days: null }, marketplace_url: `https://netify.co.uk/marketplace/${record.provider.slug}/`,
    shortlist_summary: excerpt(record.editorial.overview), key_differentiators: [], best_fit_for: [], watch_outs: [],
    evidence_coverage_pct: 0, last_verified: record.revision.reviewed_at.slice(0, 10),
  };
}

export function getGovernedShortlistDataset(legacy: ShortlistVendor[]): ShortlistVendor[] {
  const bySlug = new Map(legacy.map((provider) => [provider.slug, provider]));
  return snapshot.providers.map((record) => {
    const comparisonSlug = SLUGS[record.provider.slug];
    const provider = { ...(bySlug.get(comparisonSlug) ?? blank(record)), slug: comparisonSlug } as ShortlistVendor;
    provider.name = NAMES[record.provider.slug] ?? provider.name;
    provider.marketplace_url = `https://netify.co.uk/marketplace/${record.provider.slug}/`;
    provider.shortlist_summary = excerpt(record.editorial.overview);
    provider.last_verified = record.revision.reviewed_at.slice(0, 10);
    provider.evidence_coverage_pct = record.capabilities.filter((capability) => positive.has(capability.support_state) && capability.freshness_state === "current").length / record.capabilities.length;
    const capabilities = { ...provider.capabilities };
    for (const [feature, codes] of Object.entries(FEATURE_CODES)) {
      if (!codes) continue;
      capabilities[feature] = status(record.capabilities.filter((capability) => codes.includes(capability.capability_code) && capability.freshness_state === "current").map((capability) => capability.support_state));
    }
    provider.capabilities = capabilities;
    return provider;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function getGovernedProviderSummaries() {
  return snapshot.providers.map((record) => ({
    slug: record.provider.slug, comparisonSlug: SLUGS[record.provider.slug], name: NAMES[record.provider.slug] ?? record.provider.display_name,
    providerTypes: record.provider.provider_types, summary: excerpt(record.editorial.overview), reviewedAt: record.revision.reviewed_at,
    datasetVersion: record.revision.dataset_version, products: record.products, capabilities: record.capabilities,
    geographies: record.geographies, serviceModels: record.service_models, sectors: record.sector_evidence,
    compliance: record.compliance, integrations: record.integrations, caseStudies: record.case_studies,
    evidenceSources: record.evidence_sources, evaluations: record.evaluations,
    evidenceSourceCount: record.evidence_source_count, url: `https://netify.co.uk/marketplace/${record.provider.slug}/`,
  }));
}

export function getGovernedProviderSummary(comparisonSlug: string) {
  return getGovernedProviderSummaries().find((provider) => provider.comparisonSlug === comparisonSlug);
}

export const GOVERNED_SOURCE_VERSION = snapshot.contract_version;
