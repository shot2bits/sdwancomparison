/**
 * Provider categories for the SASE cost and TCO page (Phase 1 of the
 * agentic cost build). Generated from the marketplace vendor dataset in
 * /data/vendors - the single source of truth. Never a hand-written list:
 * every vendor entry is read from its validated dataset record at request
 * time, so dataset corrections flow through automatically.
 *
 * The four categories are the editorial grouping from the SASE cost and
 * TCO guide (FINAL_PAGE_COPY_sase_cost_tco.md). Category membership is an
 * editorial decision from that copy; the per-vendor facts (pricing units,
 * delivery models, marketplace URL) are dataset facts.
 *
 * Globalgig and Virgin Media O2 have no vendor dataset records (flagged in
 * the Phase 1 pre-flight). Per the spec they are included from their
 * marketplace page records only: name and marketplace URL, with dataset
 * fields omitted rather than invented.
 */

import { getVendor, getAllVendorSlugs } from "@/lib/vendors";
import type { Vendor } from "@data/schema";

export const COST_METHODOLOGY_VERSION = "2026.1";

export type CostCategoryId =
  | "unified-single-vendor"
  | "enterprise-mega-vendors"
  | "cloud-platform-vendors"
  | "telco-carrier-managed";

export interface CostCategoryVendor {
  name: string;
  marketplaceUrl: string | null;
  /** Hyphenated pricing units from the dataset, e.g. "per-site, per-user". */
  pricingModel?: string;
  /** Delivery models with public evidence in the capability matrix. */
  deliveryModels?: ("managed" | "co-managed" | "diy")[];
  /** Set when the vendor has no dataset record (marketplace page only). */
  datasetRecord?: false;
}

export interface CostCategory {
  id: CostCategoryId;
  label: string;
  /** Verbatim from FINAL_PAGE_COPY_sase_cost_tco.md; absent until supplied. */
  typicalCommercialModel?: string;
  /** Verbatim from FINAL_PAGE_COPY_sase_cost_tco.md; absent until supplied. */
  bestFitProfile?: string;
  vendors: CostCategoryVendor[];
}

/**
 * Category membership (editorial, from the copy file). Slugs must exist in
 * /data/vendors; the two marketplace-only entries are declared separately.
 */
const CATEGORY_MEMBERS: Record<CostCategoryId, { label: string; slugs: string[] }> = {
  "unified-single-vendor": {
    label: "Unified single-vendor platforms",
    slugs: ["cato-networks", "fortinet", "versa-networks", "check-point", "aryaka"],
  },
  "enterprise-mega-vendors": {
    label: "Enterprise mega-vendors",
    slugs: ["zscaler", "palo-alto-networks"],
  },
  "cloud-platform-vendors": {
    label: "Cloud-platform vendors",
    slugs: ["cloudflare-one", "netskope"],
  },
  "telco-carrier-managed": {
    label: "Telco / carrier-managed",
    slugs: [
      "bt-business",
      "colt-technology-services",
      "ntt",
      "verizon-business",
      "comcast-business",
    ],
  },
};

/**
 * Category descriptors, verbatim from the copy file (Table 4 of
 * "Affordable SASE for Global Enterprise Networks: A Cost and TCO Guide",
 * Harry Yelland, reviewed by Abigail Sturt 30 June 2026; supplied 14 July).
 */
const CATEGORY_DESCRIPTORS: Partial<
  Record<CostCategoryId, { typicalCommercialModel: string; bestFitProfile: string }>
> = {
  "unified-single-vendor": {
    typicalCommercialModel: "Per-user, platform-bundled licensing",
    bestFitProfile: "Organisations prioritising converged simplicity and lower operating cost",
  },
  "enterprise-mega-vendors": {
    typicalCommercialModel: "Tiered, feature-depth-led licensing",
    bestFitProfile: "Large estates needing the deepest available feature set",
  },
  "cloud-platform-vendors": {
    typicalCommercialModel: "Per-user with modular security add-ons",
    bestFitProfile: "Organisations prioritising global edge reach and predictable entry pricing",
  },
  "telco-carrier-managed": {
    typicalCommercialModel: "Managed service, often bundled with connectivity",
    bestFitProfile: "Global estates wanting one accountable managed provider",
  },
};

/**
 * Vendors with marketplace pages but no dataset record. Name and URL come
 * from the marketplace page records in the main site repo
 * (lib/marketplace-content/stubs: globalgig.ts, virgin-media.ts).
 */
const MARKETPLACE_ONLY_MEMBERS: Record<string, { category: CostCategoryId; entry: CostCategoryVendor }> = {
  globalgig: {
    category: "telco-carrier-managed",
    entry: {
      name: "Globalgig",
      marketplaceUrl: "https://netify.co.uk/marketplace/globalgig/",
      datasetRecord: false,
    },
  },
  "virgin-media-o2": {
    category: "telco-carrier-managed",
    entry: {
      name: "Virgin Media O2",
      marketplaceUrl: "https://netify.co.uk/marketplace/virgin-media/",
      datasetRecord: false,
    },
  },
};

function pricingModelOf(v: Vendor): string {
  return v.pricing_units.map((u) => u.replace(/_/g, "-")).join(", ");
}

function deliveryModelsOf(v: Vendor): ("managed" | "co-managed" | "diy")[] {
  const out: ("managed" | "co-managed" | "diy")[] = [];
  if (v.capabilities.f01_fully_managed_service === "yes") out.push("managed");
  if (v.capabilities.f03_co_managed_service === "yes") out.push("co-managed");
  if (v.capabilities.f02_diy_self_managed_model === "yes") out.push("diy");
  return out;
}

export interface ProviderCategoriesPayload {
  generatedAt: string;
  source: string;
  methodologyVersion: string;
  notes: string[];
  categories: CostCategory[];
}

export function buildProviderCategories(): ProviderCategoriesPayload {
  const known = new Set(getAllVendorSlugs());
  const notes: string[] = [];
  const categories: CostCategory[] = (
    Object.entries(CATEGORY_MEMBERS) as [CostCategoryId, { label: string; slugs: string[] }][]
  ).map(([id, def]) => {
    const vendors: CostCategoryVendor[] = [];
    for (const slug of def.slugs) {
      if (!known.has(slug)) {
        notes.push(`Vendor slug ${slug} missing from dataset; omitted.`);
        continue;
      }
      const v = getVendor(slug);
      vendors.push({
        name: v.name,
        marketplaceUrl: v.marketplace_url,
        pricingModel: pricingModelOf(v),
        deliveryModels: deliveryModelsOf(v),
      });
    }
    for (const [slug, m] of Object.entries(MARKETPLACE_ONLY_MEMBERS)) {
      if (m.category === id) {
        vendors.push(m.entry);
        notes.push(
          `${m.entry.name} (${slug}) has no vendor dataset record; listed from its marketplace page record only.`,
        );
      }
    }
    const desc = CATEGORY_DESCRIPTORS[id];
    return {
      id,
      label: def.label,
      ...(desc ?? {}),
      vendors,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "Netify marketplace vendor dataset",
    methodologyVersion: COST_METHODOLOGY_VERSION,
    notes,
    categories,
  };
}
