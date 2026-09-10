import {
  buildShortlist,
  DEFAULT_INPUT,
  type ShortlistInput,
  type ShortlistVendor,
  type VendorVerdict,
} from "@/lib/shortlist-core";
import featureDefinitions from "@data/feature-definitions.json";

const FEATURE_NAMES = Object.fromEntries(
  (featureDefinitions as { features: Array<{ id: string; name: string }> }).features.map((feature) => [feature.id, feature.name]),
);

export const SHORTLIST_VIEW_CONTRACT_VERSION = "shortlist-market-view/1.0.0" as const;

export const SHORTLIST_VIEW_KEYS = ["all", "sd-wan-vendors", "sase-vendors", "managed-sd-wan"] as const;
export type ShortlistMarketView = (typeof SHORTLIST_VIEW_KEYS)[number];

type ViewDefinition = {
  label: string;
  title: string;
  answer: string;
  input: Partial<ShortlistInput>;
  eligible: (provider: ShortlistVendor) => boolean;
};

const evidenced = (provider: ShortlistVendor, feature: string) =>
  ["yes", "partial", "partner_integrated", "managed_service_dependent"].includes(provider.capabilities[feature]);

const technologyVendor = (provider: ShortlistVendor) =>
  provider.category.includes("technology vendor") ||
  (!/(managed .*provider|carrier|connectivity provider|network provider|naas provider)/i.test(provider.category) &&
    /(vendor|platform|network services)/i.test(provider.category));

export const SHORTLIST_VIEWS: Record<ShortlistMarketView, ViewDefinition> = {
  all: {
    label: "All providers",
    title: "All SD-WAN and SASE providers",
    answer: "All 30 researched providers are ranked against the same 40-capability evidence model.",
    input: {},
    eligible: () => true,
  },
  "sd-wan-vendors": {
    label: "SD-WAN vendors",
    title: "SD-WAN vendors compared",
    answer: "This view ranks technology vendors with public evidence for an encrypted SD-WAN overlay and gives extra weight to path selection, application routing, traffic control, cloud access and resilience.",
    input: {
      required_features: ["f09_encrypted_overlay_fabric"],
      preferred_features: ["f10_dynamic_path_selection", "f12_application_aware_routing", "f13_qos_and_traffic_shaping", "f18_cloud_on_ramp", "f25_high_availability_design"],
      weight_preset: "network_led",
    },
    eligible: (provider) => technologyVendor(provider) && evidenced(provider, "f09_encrypted_overlay_fabric"),
  },
  "sase-vendors": {
    label: "SASE vendors",
    title: "SASE vendors compared",
    answer: "This view ranks technology vendors with public SASE evidence and gives extra weight to ZTNA, secure web gateway, CASB, data loss prevention and centralised orchestration.",
    input: {
      preferred_features: ["f28_full_sase_platform", "f30_zero_trust_network_access", "f31_secure_web_gateway", "f32_casb_capability", "f33_data_loss_prevention", "f36_centralised_orchestration"],
      weight_preset: "security_led",
    },
    eligible: (provider) => technologyVendor(provider) && ["f28_full_sase_platform", "f30_zero_trust_network_access", "f31_secure_web_gateway"].some((feature) => evidenced(provider, feature)),
  },
  "managed-sd-wan": {
    label: "Managed SD-WAN providers",
    title: "Managed SD-WAN providers compared",
    answer: "This view ranks providers with public evidence for both managed service delivery and an encrypted SD-WAN overlay, with extra weight on migration, last-mile and lifecycle management.",
    input: {
      service_model: "managed",
      required_features: ["f01_fully_managed_service", "f09_encrypted_overlay_fabric"],
      preferred_features: ["f05_professional_services_and_migration_support", "f06_last_mile_circuit_management", "f07_lifecycle_management", "f16_mpls_coexistence_and_migration"],
      weight_preset: "managed_service_led",
    },
    eligible: (provider) => evidenced(provider, "f01_fully_managed_service") && evidenced(provider, "f09_encrypted_overlay_fabric"),
  },
};

export function parseShortlistMarketView(value: string | null | undefined): ShortlistMarketView {
  return SHORTLIST_VIEW_KEYS.includes(value as ShortlistMarketView) ? value as ShortlistMarketView : "all";
}

export function inputForShortlistMarketView(view: ShortlistMarketView): ShortlistInput {
  const preset = SHORTLIST_VIEWS[view].input;
  return {
    ...DEFAULT_INPUT,
    ...preset,
    required_features: [...(preset.required_features ?? DEFAULT_INPUT.required_features)],
    preferred_features: [...(preset.preferred_features ?? DEFAULT_INPUT.preferred_features)],
  };
}

export function buildShortlistMarketView(vendors: ShortlistVendor[], view: ShortlistMarketView): VendorVerdict[] {
  const definition = SHORTLIST_VIEWS[view];
  const eligible = vendors.filter(definition.eligible);
  return buildShortlist(
    eligible,
    { ...inputForShortlistMarketView(view), shortlist_size: eligible.length },
    FEATURE_NAMES,
  ).shortlist;
}

export function firstUnconfirmedDecision(provider: ShortlistVendor): string {
  const feature = Object.entries(provider.capabilities).find(([, state]) => state === "unknown");
  return feature ? FEATURE_NAMES[feature[0]] ?? "Commercial and delivery detail" : "Commercial and delivery detail";
}
