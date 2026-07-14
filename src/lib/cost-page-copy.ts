/**
 * Copy-derived content blocks for the SASE cost and TCO data.json twin:
 * cost-driver definitions (Table 1), the delivery-model comparison
 * (Table 2) and the pricing-model comparison (Table 3).
 *
 * Source of truth: "Affordable SASE for Global Enterprise Networks: A
 * Cost and TCO Guide" by Harry Yelland, reviewed by Abigail Sturt on
 * 30 June 2026 (the FINAL_PAGE_COPY document, supplied 14 July 2026).
 * Table content applied verbatim, with the editorial dash rule applied
 * (no spaced-hyphen punctuation inside strings).
 */

export interface CostDriverDefinition {
  driver: string;
  definition: string;
}

export interface ComparisonRow {
  [column: string]: string;
}

export interface ComparisonTable {
  columns: string[];
  rows: ComparisonRow[];
}

/** Table 1: cost drivers, verbatim from the copy file. */
export const COST_DRIVER_DEFINITIONS: CostDriverDefinition[] | null = [
  { driver: "Users and devices", definition: "Base pricing unit for most providers; grows with headcount and contractor access. Check how growth and true-ups are charged across the term. Similar exposure under managed and DIY models." },
  { driver: "Sites and regions", definition: "PoP footprint and data residency requirements vary by provider and region. Check PoP coverage and latency commitments in every region in scope. Managed providers typically absorb more of this complexity." },
  { driver: "Bandwidth profile", definition: "Bandwidth-linked pricing creates exposure during migration or seasonal peaks. Check how overage is triggered and billed. DIY teams carry the monitoring burden themselves." },
  { driver: "Security depth", definition: "Capability is often tiered, with DLP, CASB and DEM gated behind premium plans. Check whether what you need is base or premium tier. Managed providers can include more as standard within the service." },
  { driver: "Delivery model", definition: "The single biggest lever on total cost. Check the internal skill and capacity available today; the delivery model decides where the other costs land." },
  { driver: "Implementation and migration", definition: "Discovery, identity integration and phased rollout are real, often underweighted costs. Check what is included in onboarding versus billed as professional services. DIY carries the full project cost internally." },
  { driver: "Hidden and recurring costs", definition: "Log retention, overage, support tiers and renewal uplift compound over the term. Check renewal terms and the contracted uplift mechanism. Managed contracts typically bundle more of this upfront." },
];

/** Table 2: managed vs co-managed vs DIY, verbatim from the copy file. */
export const DELIVERY_MODEL_COMPARISON: ComparisonTable | null = {
  columns: ["Factor", "Managed", "Co-managed", "DIY"],
  rows: [
    { "Factor": "Cost predictability", "Managed": "Highest: single accountable party, bundled service", "Co-managed": "Moderate: shared responsibility, partially predictable", "DIY": "Lowest: internal cost scales with complexity" },
    { "Factor": "Internal skill required", "Managed": "Minimal", "Co-managed": "Moderate: policy ownership retained", "DIY": "Highest: full 24x7 NOC/SOC capability needed" },
    { "Factor": "Time to value", "Managed": "Fastest", "Co-managed": "Moderate", "DIY": "Slowest" },
    { "Factor": "Control", "Managed": "Lower direct control", "Co-managed": "Policy control retained", "DIY": "Full control" },
    { "Factor": "Where SD-WAN sits", "Managed": "Delivered as part of the managed service", "Co-managed": "Jointly operated within the platform", "DIY": "Self-deployed as part of the architecture" },
    { "Factor": "Best-fit profile", "Managed": "Teams without 24x7 capacity, global or complex estates", "Co-managed": "Teams wanting policy ownership without daily operations", "DIY": "Teams with strong in-house security and networking capability" },
  ],
};

/** Table 3: pricing models and where the risk sits, verbatim from the copy file. */
export const PRICING_MODEL_COMPARISON: ComparisonTable | null = {
  columns: ["Model", "How it works", "Affordability risk", "Best fit"],
  rows: [
    { "Model": "Per-user subscription", "How it works": "Cost scales directly with licensed headcount", "Affordability risk": "Lowest risk; most predictable to forecast", "Best fit": "Organisations with stable, well-known user counts" },
    { "Model": "Bandwidth-based", "How it works": "Cost scales with traffic volume", "Affordability risk": "Exposure during migration projects or seasonal peaks", "Best fit": "Organisations with consistent, well-understood traffic patterns" },
    { "Model": "Tiered bundle", "How it works": "Capability grouped into pricing tiers", "Affordability risk": "Required features often sit in a higher tier than expected", "Best fit": "Organisations that map required capability to tier before buying" },
  ],
};

/**
 * Spread into the data.json payload: blocks appear only once the copy
 * file content is in place.
 */
export const COST_PAGE_TABLES: Record<string, unknown> = {
  ...(COST_DRIVER_DEFINITIONS ? { costDrivers: COST_DRIVER_DEFINITIONS } : {}),
  ...(DELIVERY_MODEL_COMPARISON ? { deliveryModelComparison: DELIVERY_MODEL_COMPARISON } : {}),
  ...(PRICING_MODEL_COMPARISON ? { pricingModelComparison: PRICING_MODEL_COMPARISON } : {}),
};
