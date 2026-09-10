/**
 * Supplier matching for the Describe wizard's live panel and the match API.
 * Answers "how many verified suppliers on the marketplace fit this project"
 * from the vendor dataset only: category text, display group and the
 * per-region coverage matrix. Honest by construction: counts are derived
 * from dataset facts, never padded, and a narrow scope returning a small
 * number is the correct behaviour (flow spec, 14 July 2026, open question 1
 * resolved in favour of honesty).
 */

import type { ShortlistVendor } from "@/lib/shortlist-core";
import { getShortlistDataset, getVendorGroup, type VendorGroup } from "@/lib/vendors";

export type MatchResult = {
  count: number;
  total: number;
  /** Up to eight vendor names for the panel, alphabetical. */
  names: string[];
  slugs: string[];
};

/** Normalise wizard/product keys and persisted product_scope values. */
function normaliseScope(scope: string): "sdwan" | "sse" | "sase" | "any" {
  const s = scope.toLowerCase();
  if (s === "sdwan" || s === "sdwan_only" || s === "sd-wan") return "sdwan";
  if (s === "sse" || s === "sse_only") return "sse";
  if (s === "sase" || s === "full_sase" || s === "single_vendor_sase" || s === "best_of_breed") return "sase";
  return "any";
}

function scopeMatches(scope: "sdwan" | "sse" | "sase" | "any", category: string, group: VendorGroup): boolean {
  if (scope === "any") return true;
  const cat = category.toLowerCase();
  if (scope === "sdwan") {
    return cat.includes("sd-wan") || group === "technology_vendors" || group === "cellular_wireless" || group === "global_managed_providers";
  }
  if (scope === "sse") {
    return cat.includes("sse") || group === "sse_platforms" || group === "cloud_native_sase";
  }
  // sase
  return cat.includes("sase") || group === "cloud_native_sase" || group === "sse_platforms" || group === "global_managed_providers";
}

/**
 * A region counts as covered unless the dataset marks it absent or unknown.
 * Partial and partner-delivered coverage still count (real coverage for most
 * buyers), but "unknown" is not evidence and never matches.
 */
function regionCovered(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return v !== "" && v !== "no" && v !== "none" && v !== "unknown";
}

export function matchSuppliers(
  opts: { scope?: string; regions?: string[]; model?: string; preferred_regions?: string[] },
  vendors: ShortlistVendor[] = getShortlistDataset(),
): MatchResult {
  const scope = normaliseScope(opts.scope ?? "any");
  const regions = (opts.regions ?? []).filter(Boolean);
  const model = (opts.model ?? "any").toLowerCase();

  const all = vendors;
  const matched = all.filter((v) => {
    const group = getVendorGroup(v);
    if (!scopeMatches(scope, v.category, group)) return false;
    // DIY buyers do not buy carrier-managed services; managed buyers can buy
    // from anyone (vendors deliver managed via partners, noted in profiles).
    if (model === "diy" && group === "global_managed_providers") return false;
    // Every requested region must have dataset coverage.
    const coverage = (v.regions ?? {}) as Record<string, unknown>;
    for (const r of regions) {
      if (!regionCovered(coverage[r])) return false;
    }
    return true;
  });

  // Display order (20 July 2026): when a regional signal exists, the eight
  // names shown lead with the strongest coverage for it (yes above partial
  // above the rest) instead of a bare alphabetical slice. Counts unchanged.
  const rankRegions = [...(opts.preferred_regions ?? []), ...regions];
  const bandFor = (v: (typeof matched)[number]): number => {
    let best = 0;
    const coverage = (v.regions ?? {}) as Record<string, unknown>;
    for (const r of rankRegions) {
      const g = String(coverage[r] ?? "").toLowerCase();
      if (g === "yes") best = Math.max(best, 2);
      else if (g === "partial" || g === "partner_integrated") best = Math.max(best, 1);
    }
    return best;
  };
  const names = matched
    .slice()
    .sort((a, b) => (rankRegions.length ? bandFor(b) - bandFor(a) : 0) || a.name.localeCompare(b.name))
    .map((v) => v.name);
  return {
    count: matched.length,
    total: all.length,
    names: names.slice(0, 8),
    slugs: matched.map((v) => v.slug).sort(),
  };
}
