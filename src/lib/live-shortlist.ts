import { comparisonSlugForGovernedProvider } from "@/lib/governed-provider-catalogue";
import type { ProviderMatchRecord } from "@/lib/provider-matching";
import {
  CLOUD_KEYS,
  ORG_SIZE_KEYS,
  REGION_KEYS,
  SECTOR_KEYS,
  type CapabilityStatus,
  type ShortlistVendor,
} from "@/lib/shortlist-core";
import { FEATURES, getShortlistDataset } from "@/lib/vendors";

export const LIVE_SHORTLIST_CONTRACT_VERSION = "neon-shortlist/1.0.0" as const;

export type LiveShortlistDataset = {
  vendors: ShortlistVendor[];
  source: "neon" | "snapshot_fallback";
  datasetVersions: string[];
  loadedAt: string;
};

const FEATURE_CODES: Record<string, string[]> = {
  f01_fully_managed_service: [],
  f02_diy_self_managed_model: [],
  f03_co_managed_service: [],
  f04_multi_tenant_msp_white_label_support: [],
  f05_professional_services_and_migration_support: ["brownfield_migration_support"],
  f06_last_mile_circuit_management: ["supported_wan_underlays", "site_and_circuit_performance"],
  f07_lifecycle_management: ["configuration_generation", "zero_touch_provisioning"],
  f08_flexible_commercial_model: [],
  f09_encrypted_overlay_fabric: ["sd_wan"],
  f10_dynamic_path_selection: ["dynamic_path_selection"],
  f11_active_active_link_utilisation: [],
  f12_application_aware_routing: ["application_aware_routing", "application_identification"],
  f13_qos_and_traffic_shaping: ["qos_and_traffic_engineering"],
  f14_packet_loss_remediation: ["forward_error_correction_packet_duplication", "wan_optimisation"],
  f15_local_internet_breakout: ["local_internet_breakout"],
  f16_mpls_coexistence_and_migration: ["brownfield_migration_support"],
  f17_cellular_and_5g_support: ["cap_5g_lte_support"],
  f18_cloud_on_ramp: ["multi_cloud_networking", "virtual_cloud_edge_support"],
  f19_public_cloud_gateways: ["virtual_cloud_edge_support"],
  f20_private_pops_dedicated_pops: [],
  f21_private_global_backbone: [],
  f22_regional_breakout_and_data_residency: [],
  f23_multi_cloud_transit_fabric: ["multi_cloud_networking"],
  f24_flexible_edge_form_factors: ["edge_form_factors"],
  f25_high_availability_design: ["high_availability"],
  f26_sla_backed_service_fabric: ["sla_reporting"],
  f27_integrated_next_generation_firewall: ["firewall_as_a_service", "cloud_firewall_cloud_network_security"],
  f28_full_sase_platform: ["sd_wan", "ztna", "secure_web_gateway", "firewall_as_a_service"],
  f29_sse_ecosystem_integration: ["casb_api", "casb_inline", "secure_web_gateway", "ztna"],
  f30_zero_trust_network_access: ["ztna"],
  f31_secure_web_gateway: ["secure_web_gateway"],
  f32_casb_capability: ["casb_inline", "casb_api"],
  f33_data_loss_prevention: ["data_loss_prevention", "dlp_events"],
  f34_remote_user_access: ["clientless_access", "managed_laptops", "mobile_devices", "remote_user_experience", "unmanaged_byod_devices", "vdi_environments"],
  f35_soc_siem_soar_integration: ["raw_log_access", "security_events", "threat_intelligence"],
  f36_centralised_orchestration: ["automated_policy_recommendation", "configuration_generation", "zero_touch_provisioning"],
  f37_customer_portal_and_rbac: ["custom_reports", "executive_dashboard", "scheduled_reports"],
  f38_observability_and_digital_experience_monitoring: ["application_performance", "digital_experience_diagnostics", "digital_experience_monitoring", "user_experience"],
  f39_apis_and_automation: ["automated_remediation", "configuration_generation"],
  f40_managed_service_assurance: ["network_health", "root_cause_analysis", "sla_reporting", "threat_reporting"],
};

type EvidenceState = { support_state: string; freshness_state: string };
const positive = new Set(["supported", "partially_supported", "partner_delivered"]);

function evidenceStatus(records: Array<EvidenceState | undefined>): CapabilityStatus {
  const states = records.filter((record): record is EvidenceState => Boolean(record) && record?.freshness_state === "current").map((record) => record.support_state);
  if (states.includes("supported")) return "yes";
  if (states.includes("partner_delivered")) return "partner_integrated";
  if (states.includes("partially_supported")) return "partial";
  if (states.length > 0 && states.every((state) => state === "not_supported")) return "not_primary";
  return "unknown";
}

function namedStatus(records: Record<string, EvidenceState>, names: string[]): CapabilityStatus {
  const wanted = names.map((name) => name.toLowerCase());
  return evidenceStatus(Object.entries(records).filter(([name]) => wanted.some((item) => name.toLowerCase().includes(item))).map(([, value]) => value));
}

function combinedSaseStatus(record: ProviderMatchRecord): CapabilityStatus {
  const states = FEATURE_CODES.f28_full_sase_platform.map((code) => record.capabilities[code]).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const current = states.filter((state) => state.freshness_state === "current");
  if (current.length === 4 && current.every((state) => positive.has(state.support_state))) return "yes";
  if (current.some((state) => positive.has(state.support_state))) return "partial";
  if (current.length > 0 && current.every((state) => state.support_state === "not_supported")) return "not_primary";
  return "unknown";
}

function excerpt(value: string): string {
  const paragraph = value.split(/\n{2,}/)[0]?.trim() ?? "";
  const sentences = paragraph.match(/[^.!?]+[.!?]+(?:[”’"']|$)?/g) ?? [paragraph];
  const selected = sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  return selected.length <= 700 ? selected : `${selected.slice(0, 697).trimEnd()}...`;
}

const REGION_TERMS: Record<(typeof REGION_KEYS)[number], string[]> = {
  uk_ireland: ["united kingdom", "uk", "ireland"], europe: ["europe", "emea"],
  north_america: ["north america", "united states", "usa", "canada", "mexico"],
  asia_pacific: ["asia pacific", "apac", "australia", "new zealand", "japan", "singapore", "india"],
  middle_east_africa: ["middle east", "africa"], latin_america: ["latin america", "south america", "brazil"],
  china_mainland: ["china"],
};

const SECTOR_TERMS: Record<(typeof SECTOR_KEYS)[number], string[]> = {
  healthcare: ["health", "nhs", "hospital", "telehealth"],
  financial_services: ["financial", "bank", "insurance", "fintech"],
  retail_ecommerce: ["retail", "consumer goods", "e-commerce", "ecommerce"],
  manufacturing: ["manufactur", "industrial", "chemical", "electronics", "beverage"],
  energy_utilities: ["energy", "utilit", "water", "oil", "gas", "power"],
  government_public_sector: ["government", "public sector", "public safety"],
  education: ["education", "university", "school"],
  transport_logistics: ["transport", "logistics", "shipping", "rail", "fleet", "haulage"],
  professional_services: ["professional service", "legal", "account", "consult", "business service"],
  hospitality_leisure: ["hospitality", "hotel", "restaurant", "stadium", "leisure"],
};

function targetBuyerStatus(targets: string[], terms: string[]): CapabilityStatus {
  const text = targets.join(" ").toLowerCase();
  return terms.some((term) => text.includes(term)) ? "yes" : "unknown";
}

export function mergeNeonProviderRecords(base: ShortlistVendor[], records: ProviderMatchRecord[]): ShortlistVendor[] {
  const bySlug = new Map(base.map((provider) => [provider.slug, provider]));
  return records.map((record) => {
    const slug = comparisonSlugForGovernedProvider(record.slug);
    const original = bySlug.get(slug);
    if (!original) throw new Error(`No comparison record for governed provider ${record.slug}`);
    const provider: ShortlistVendor = JSON.parse(JSON.stringify(original));
    provider.name = record.display_name;
    provider.category = record.provider_types.join(" / ").replaceAll("_", " ");
    provider.product_focus = record.product_names.slice(0, 4).join(", ");
    provider.shortlist_summary = excerpt(record.overview);
    provider.marketplace_url = `https://netify.co.uk/marketplace/${record.slug}/`;
    provider.last_verified = record.reviewed_at?.slice(0, 10) ?? provider.last_verified;
    provider.evidence_source_count = record.evidence_source_count;
    provider.independent_evidence_source_count = 0;

    provider.capabilities = Object.fromEntries(FEATURES.map((feature) => {
      if (feature.id === "f28_full_sase_platform") return [feature.id, combinedSaseStatus(record)];
      const codes = FEATURE_CODES[feature.id] ?? [];
      if (feature.id === "f01_fully_managed_service") return [feature.id, namedStatus(record.service_models, ["fully_managed", "fully managed", "managed_service", "managed service"] )];
      if (feature.id === "f02_diy_self_managed_model") return [feature.id, namedStatus(record.service_models, ["self_managed", "self managed", "diy"] )];
      if (feature.id === "f03_co_managed_service") return [feature.id, namedStatus(record.service_models, ["co_managed", "co-managed", "co managed"] )];
      if (feature.id === "f04_multi_tenant_msp_white_label_support") return [feature.id, namedStatus(record.service_models, ["msp", "white label", "multi tenant"] )];
      return [feature.id, evidenceStatus(codes.map((code) => record.capabilities[code]))];
    }));
    provider.evidence_coverage_pct = Object.values(provider.capabilities).filter((state) => state !== "unknown").length / FEATURES.length;

    provider.regions = Object.fromEntries(REGION_KEYS.map((key) => [key, namedStatus(record.regions, REGION_TERMS[key])])) as ShortlistVendor["regions"];
    provider.sectors = Object.fromEntries(SECTOR_KEYS.map((key) => [key, namedStatus(record.sectors, SECTOR_TERMS[key])])) as ShortlistVendor["sectors"];
    provider.supported_clouds = Object.fromEntries(CLOUD_KEYS.map((key) => [key, targetBuyerStatus(record.integration_names, key === "gcp" ? ["google cloud", "gcp"] : key === "azure" ? ["azure"] : key === "aws" ? ["aws", "amazon web services"] : key === "oracle_cloud" ? ["oracle cloud"] : ["alibaba cloud"])])) as ShortlistVendor["supported_clouds"];
    provider.ai_capability = {
      ai_driven_operations: evidenceStatus(["anomaly_detection", "automated_policy_recommendation", "automated_remediation", "capacity_path_optimisation", "root_cause_analysis"].map((code) => record.capabilities[code])),
      ai_security_analytics: evidenceStatus(["ai_data_protection_controls", "security_events", "threat_detection_classification", "user_entity_behaviour_analytics"].map((code) => record.capabilities[code])),
      ai_assistant: evidenceStatus(["ai_assistant_copilot", "natural_language_querying", "report_summarisation"].map((code) => record.capabilities[code])),
      note: "Statuses use the current published Neon provider record.",
    };
    provider.resilience = { disaster_recovery: evidenceStatus([record.capabilities.high_availability]), note: "Status uses current published Neon high availability evidence." };
    provider.organisation_fit = Object.fromEntries(ORG_SIZE_KEYS.map((key) => [key, targetBuyerStatus(record.target_buyers, key === "large_global_enterprise" ? ["large", "global", "enterprise"] : key === "mid_market" ? ["mid-market", "mid market", "medium"] : ["small", "smb", "sme"])])) as ShortlistVendor["organisation_fit"];
    provider.identity_providers = { entra_id: targetBuyerStatus(record.integration_names, ["entra", "azure ad"]), okta: targetBuyerStatus(record.integration_names, ["okta"]), ping: targetBuyerStatus(record.integration_names, ["ping identity", "pingid"]), google_workspace: targetBuyerStatus(record.integration_names, ["google workspace"] ) };
    provider.device_posture = evidenceStatus([record.capabilities.managed_laptops, record.capabilities.unmanaged_byod_devices]);
    provider.agent_platforms = { windows: provider.device_posture, macos: provider.device_posture, ios: evidenceStatus([record.capabilities.mobile_devices]), android: evidenceStatus([record.capabilities.mobile_devices]), linux: provider.device_posture, chromeos: provider.device_posture, agentless: evidenceStatus([record.capabilities.clientless_access]) };
    provider.logging = { siem_export: evidenceStatus([record.capabilities.raw_log_access, record.capabilities.security_events]), log_retention_days: null };
    provider.deployment_speed = "unknown";
    provider.uk_delivery = "global_managed";
    provider.uk_basis = "UK contracting entity is not confirmed by the published Neon provider record.";
    return provider;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLiveShortlistDataset(): Promise<LiveShortlistDataset> {
  const base = getShortlistDataset();
  const loadedAt = new Date().toISOString();
  try {
    const { loadProviderMatchRecords } = await import("@/lib/provider-match-source");
    const records = await loadProviderMatchRecords();
    if (records.length !== base.length) throw new Error(`Expected ${base.length} published provider records, received ${records.length}`);
    const vendors = mergeNeonProviderRecords(base, records);
    return { vendors, source: "neon", datasetVersions: [...new Set(records.map((record) => record.dataset_version))].sort(), loadedAt };
  } catch (error) {
    console.error("Live shortlist provider source unavailable, using the reviewed snapshot.", error);
    return { vendors: base, source: "snapshot_fallback", datasetVersions: [], loadedAt };
  }
}
