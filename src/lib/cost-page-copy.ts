/**
 * Copy-derived content blocks for the SASE cost and TCO data.json twin:
 * cost-driver definitions (Table 1), the delivery-model comparison
 * (Table 2) and the pricing-model comparison (Table 3).
 *
 * Source of truth: FINAL_PAGE_COPY_sase_cost_tco.md, applied verbatim.
 * The copy file has not been supplied yet (flagged at the Phase 1 stop
 * point), so the blocks are currently absent from the payload rather
 * than invented. When the file arrives, populate the three constants
 * below verbatim and they flow into /sase/api/cost/data.json and the
 * matching MCP tools automatically.
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

/** Table 1: cost drivers. Populate verbatim from the copy file. */
export const COST_DRIVER_DEFINITIONS: CostDriverDefinition[] | null = null;

/** Table 2: managed vs co-managed vs DIY. Populate verbatim from the copy file. */
export const DELIVERY_MODEL_COMPARISON: ComparisonTable | null = null;

/** Table 3: pricing models and where the risk sits. Populate verbatim from the copy file. */
export const PRICING_MODEL_COMPARISON: ComparisonTable | null = null;

/**
 * Spread into the data.json payload: blocks appear only once the copy
 * file content is in place.
 */
export const COST_PAGE_TABLES: Record<string, unknown> = {
  ...(COST_DRIVER_DEFINITIONS ? { costDrivers: COST_DRIVER_DEFINITIONS } : {}),
  ...(DELIVERY_MODEL_COMPARISON ? { deliveryModelComparison: DELIVERY_MODEL_COMPARISON } : {}),
  ...(PRICING_MODEL_COMPARISON ? { pricingModelComparison: PRICING_MODEL_COMPARISON } : {}),
};
