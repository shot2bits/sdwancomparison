import { kvGetJson, kvSetJson, newId } from "@/lib/rfp-store";
import { getAllVendors } from "@/lib/vendors";
import { EstateSchema, SiteSchema, type Estate, type Site, type IndicativeBand, SASE_ELEMENTS } from "@/lib/estate-types";

/** KV persistence for pricing portal estates. Key: estate:{id}. */

export async function getEstate(id: string): Promise<Estate | null> {
  if (!/^est_[a-z0-9]+$/i.test(id)) return null;
  const raw = await kvGetJson<Estate>(`estate:${id}`);
  if (!raw) return null;
  const parsed = EstateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function saveEstate(e: Estate): Promise<Estate> {
  const parsed = EstateSchema.parse({ ...e, updated: Date.now() });
  await kvSetJson(`estate:${parsed.id}`, parsed);
  return parsed;
}

export function newEstate(input: { sites?: unknown; service_model?: unknown; sase_elements?: unknown; vendor_slugs?: unknown }): Estate {
  const sites = Array.isArray(input.sites)
    ? input.sites.slice(0, 200).map((s) => SiteSchema.parse({ ...(s as object), id: newId("site") }))
    : [];
  const elements = Array.isArray(input.sase_elements)
    ? (input.sase_elements.filter((x) => (SASE_ELEMENTS as readonly string[]).includes(String(x))) as Estate["sase_elements"])
    : undefined;
  const known = new Set(getAllVendors().map((v) => v.slug));
  const vendor_slugs = Array.isArray(input.vendor_slugs)
    ? input.vendor_slugs.map(String).filter((s) => known.has(s)).slice(0, 12)
    : [];
  return EstateSchema.parse({
    id: newId("est"),
    created: Date.now(),
    updated: Date.now(),
    status: "draft",
    manage_token: newId("emk"),
    service_model: input.service_model === "co_managed" || input.service_model === "diy" ? input.service_model : "managed",
    sase_elements: elements && elements.length > 0 ? elements : undefined,
    vendor_slugs,
    sites,
  });
}

export function normaliseSites(raw: unknown): Site[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return SiteSchema.parse({ ...o, id: typeof o.id === "string" && o.id ? o.id : newId("site") });
  });
}

/**
 * Indicative pricing bands, cost model v0. ILLUSTRATIVE by design: bands are
 * derived from each vendor's public value tier and the estate shape, pending
 * the verified pricing research programme (docs/netify-pricing-research-pack.md).
 * Ordering and inclusion are never paid for. Real, firm pricing only ever
 * comes from provider bids, private to the buyer.
 */
const TIER_PER_USER: Record<string, [number, number]> = {
  budget: [22, 34],
  value: [26, 40],
  mid: [32, 50],
  premium: [40, 62],
};

export function indicativeBands(e: Estate): IndicativeBand[] {
  const vendors = getAllVendors();
  const chosen = e.vendor_slugs.length > 0 ? vendors.filter((v) => e.vendor_slugs.includes(v.slug)) : vendors.slice(0, 6);
  const modelUplift = e.service_model === "managed" ? 1.15 : e.service_model === "co_managed" ? 1.08 : 1.0;
  const extraElements = Math.max(0, e.sase_elements.length - 3);
  const elementUplift = 1 + extraElements * 0.06;
  const siteCount = Math.max(1, e.sites.length);
  const avgBandwidth = Math.max(50, Math.round(e.sites.reduce((n, s) => n + (s.primary_circuit.bandwidth_mbps || 0), 0) / siteCount));
  const failoverShare = e.sites.filter((s) => s.failover_circuit.type !== "none").length / siteCount;

  return chosen.map((v) => {
    const carrier = /carrier|global/i.test(v.category) && /managed/i.test(v.category) && !/cloud-native/i.test(v.category);
    if (carrier) {
      const base: [number, number] = [280, 520];
      const bwScale = Math.min(2.2, 0.7 + avgBandwidth / 800);
      const lo = Math.round(base[0] * bwScale * modelUplift * (1 + failoverShare * 0.18));
      const hi = Math.round(base[1] * bwScale * modelUplift * elementUplift * (1 + failoverShare * 0.22));
      return { vendor_slug: v.slug, vendor_name: v.name, category: v.category, unit: "per_site_month" as const, low: lo, high: hi, currency: "GBP" as const, basis: "cost model v0, illustrative: value tier, bandwidth, failover share and service model" };
    }
    const tier = TIER_PER_USER[v.value_tier ?? "mid"] ?? TIER_PER_USER.mid;
    const lo = Math.round(tier[0] * modelUplift);
    const hi = Math.round(tier[1] * modelUplift * elementUplift);
    return { vendor_slug: v.slug, vendor_name: v.name, category: v.category, unit: "per_user_month" as const, low: lo, high: hi, currency: "GBP" as const, basis: "cost model v0, illustrative: value tier, SASE elements and service model" };
  });
}

/** Seed pending bids at submission for the chosen vendors (or a sensible default set). */
export function seedBids(e: Estate): Estate {
  const vendors = getAllVendors();
  const chosen = e.vendor_slugs.length > 0
    ? vendors.filter((v) => e.vendor_slugs.includes(v.slug))
    : vendors.slice(0, 5);
  const bids = chosen.map((v) => ({
    vendor_slug: v.slug,
    vendor_name: v.name,
    status: "pending" as const,
    value: null,
    currency: "GBP",
    unit: "per_user_month" as const,
    term_months: 36,
    note: "",
    reason: "",
    at: Date.now(),
  }));
  return { ...e, status: "submitted", submitted_at: Date.now(), vendor_slugs: chosen.map((v) => v.slug), bids };
}
