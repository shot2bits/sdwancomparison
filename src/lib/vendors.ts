import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { VendorSchema, type Vendor } from "@data/schema";
import featureDefinitions from "@data/feature-definitions.json";

const VENDORS_DIR = join(process.cwd(), "data", "vendors");

export type FeatureDefinition = {
  id: string;
  number: number;
  category: string;
  name: string;
  definition: string;
  rfp_question: string;
  rfp_evidence_requested: string;
};

export const FEATURES: FeatureDefinition[] = (featureDefinitions as { features: FeatureDefinition[] }).features;

export const FEATURE_CATEGORIES: string[] = Array.from(
  new Set(FEATURES.map((f) => f.category)),
);

export function getAllVendorSlugs(): string[] {
  return readdirSync(VENDORS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function getVendor(slug: string): Vendor {
  const path = join(VENDORS_DIR, `${slug}.json`);
  const raw = readFileSync(path, "utf8");
  return VendorSchema.parse(JSON.parse(raw));
}

export function getAllVendors(): Vendor[] {
  return getAllVendorSlugs()
    .map(getVendor)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Map detailed spreadsheet categories into broader display groups.
 * Used on the listing page to cluster vendors meaningfully.
 */
export type VendorGroup =
  | "technology_vendors"
  | "cloud_native_sase"
  | "sse_platforms"
  | "cellular_wireless"
  | "global_managed_providers";

export const GROUP_LABELS: Record<VendorGroup, string> = {
  technology_vendors: "Technology vendors",
  cloud_native_sase: "Cloud-native SASE platforms",
  sse_platforms: "SSE platforms",
  cellular_wireless: "Cellular and wireless-first",
  global_managed_providers: "Global managed providers",
};

export const GROUP_DESCRIPTIONS: Record<VendorGroup, string> = {
  technology_vendors:
    "Vendors that build and sell the underlying SD-WAN or SASE platform, typically consumed direct or via partners and integrators.",
  cloud_native_sase:
    "Platforms designed cloud-first with a single converged identity for SD-WAN and security, often with private backbone or extensive PoPs.",
  sse_platforms:
    "Security Service Edge platforms (SWG, CASB, ZTNA, DLP) that integrate with separate or native SD-WAN.",
  cellular_wireless:
    "Vendors whose primary positioning is cellular, 5G or wireless-bonded access.",
  global_managed_providers:
    "Carriers and global service providers delivering managed SD-WAN and SASE on top of multi-vendor platforms.",
};

export function getVendorGroup(vendor: Vendor): VendorGroup {
  const slug = vendor.slug;
  // Slug-based mapping is more reliable than fuzzy category text matching
  const SLUG_TO_GROUP: Record<string, VendorGroup> = {
    "cisco": "technology_vendors",
    "fortinet": "technology_vendors",
    "palo-alto-networks": "technology_vendors",
    "versa-networks": "technology_vendors",
    "hpe-aruba": "technology_vendors",
    "arista-velocloud": "technology_vendors",
    "juniper-networks": "technology_vendors",
    "fatpipe-networks": "technology_vendors",
    "forcepoint": "technology_vendors",
    "check-point": "technology_vendors",
    "sonicwall": "technology_vendors",
    "peplink": "cellular_wireless",
    "cradlepoint-ericsson": "cellular_wireless",
    "cato-networks": "cloud_native_sase",
    "aryaka": "cloud_native_sase",
    "cloudflare-one": "cloud_native_sase",
    "zscaler": "sse_platforms",
    "netskope": "sse_platforms",
    "orange-business": "global_managed_providers",
    "bt-business": "global_managed_providers",
    "verizon-business": "global_managed_providers",
    "att-business": "global_managed_providers",
    "ntt": "global_managed_providers",
    "lumen": "global_managed_providers",
    "gtt": "global_managed_providers",
    "vodafone-business": "global_managed_providers",
    "telefonica-tech": "global_managed_providers",
    "colt-technology-services": "global_managed_providers",
    "comcast-business": "global_managed_providers",
    "hughes": "global_managed_providers",
  };
  return SLUG_TO_GROUP[slug] ?? "technology_vendors";
}

export function getVendorsByGroup(): Record<VendorGroup, Vendor[]> {
  const vendors = getAllVendors();
  const groups: Record<VendorGroup, Vendor[]> = {
    technology_vendors: [],
    cloud_native_sase: [],
    sse_platforms: [],
    cellular_wireless: [],
    global_managed_providers: [],
  };
  for (const v of vendors) {
    groups[getVendorGroup(v)].push(v);
  }
  return groups;
}

/**
 * Group capability statuses by feature category for the matrix display.
 */
export function getCapabilitiesByCategory(
  vendor: Vendor,
): Array<{ category: string; features: Array<{ feature: FeatureDefinition; status: string }> }> {
  const byCat = new Map<string, Array<{ feature: FeatureDefinition; status: string }>>();
  for (const f of FEATURES) {
    const status = (vendor.capabilities as Record<string, string>)[f.id] ?? "unknown";
    const arr = byCat.get(f.category) ?? [];
    arr.push({ feature: f, status });
    byCat.set(f.category, arr);
  }
  return Array.from(byCat.entries()).map(([category, features]) => ({ category, features }));
}

export const STATUS_LABELS: Record<string, string> = {
  yes: "Yes",
  partial: "Partial",
  partner_integrated: "Partner / integrated",
  managed_service_dependent: "Managed-service dependent",
  not_primary: "Not primary",
  unknown: "Unknown",
};

export const STATUS_DESCRIPTIONS: Record<string, string> = {
  yes: "Public evidence found in vendor sources.",
  partial: "Limited or indirect public evidence; confirm in RFP.",
  partner_integrated: "Available through partner, integrated platform or service dependency.",
  managed_service_dependent: "Provider-specific via managed service.",
  not_primary: "Not primary positioning; not publicly emphasised.",
  unknown: "Not confirmed by reviewed public sources; validate in RFP.",
};
