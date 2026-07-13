/**
 * MCP tools for the SASE cost and TCO capability (Phase 1 of the agentic
 * cost build). Follows the established pattern: tool definitions plus a
 * dispatcher; logic lives in the lib cores (estimator engine, category
 * builder, demand flywheel). Every description states the methodology
 * version and the disclaimer, so an agent quoting a result carries the
 * provenance with it.
 */

import { estimate, EstimateInput } from "@/lib/estimator/engine";
import { buildProviderCategories, COST_METHODOLOGY_VERSION } from "@/lib/cost-categories";
import { getDemandAggregate } from "@/lib/rfp-store";
import { FEATURE_NAMES } from "@/lib/vendors";
import {
  COST_DRIVER_DEFINITIONS,
  DELIVERY_MODEL_COMPARISON,
} from "@/lib/cost-page-copy";

const DISCLAIMER =
  "Indicative bands from the Netify SASE Methodology v2026.1 calibration, not vendor quotes.";

const SUPPRESSION_THRESHOLD = 20;

export const MCP_COST_TOOL_DEFINITIONS = [
  {
    name: "netify_estimate_sase_tco",
    description:
      `Estimate indicative SASE monthly cost and three year TCO bands in GBP for a given organisation profile. Netify SASE Methodology v${COST_METHODOLOGY_VERSION}. ${DISCLAIMER} Output is always a band [low, high] with a per-driver breakdown, never a vendor quote.`,
    inputSchema: {
      type: "object",
      properties: {
        users: { type: "integer", minimum: 50, maximum: 250000 },
        sites: { type: "integer", minimum: 1, maximum: 5000 },
        regions: {
          type: "array",
          items: {
            type: "string",
            enum: ["uk-europe", "north-america", "apac", "middle-east-africa", "latam"],
          },
          minItems: 1,
          maxItems: 5,
        },
        securityDepth: {
          type: "string",
          enum: ["sse-only", "full-sase", "full-sase-plus-advanced"],
        },
        deliveryModel: { type: "string", enum: ["managed", "co-managed", "diy"] },
        termYears: { type: "integer", enum: [1, 3, 5] },
      },
      required: ["users", "sites", "regions", "securityDepth", "deliveryModel", "termYears"],
    },
  },
  {
    name: "netify_get_sase_provider_categories",
    description:
      `SASE provider categories generated live from the Netify marketplace vendor dataset: category, member vendors, pricing units and evidenced delivery models, with marketplace profile links. Methodology v${COST_METHODOLOGY_VERSION}. ${DISCLAIMER}`,
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "netify_get_sase_demand_stats",
    description:
      `Anonymised aggregate demand data from Netify RFP Builder publishes (three most recent calendar months). Statistics with an underlying sample below ${SUPPRESSION_THRESHOLD} are suppressed; when total qualifying records are below ${SUPPRESSION_THRESHOLD} the tool returns available: false. Methodology v${COST_METHODOLOGY_VERSION}. ${DISCLAIMER}`,
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "netify_get_sase_cost_drivers",
    description:
      `Cost driver definitions from the Netify SASE cost and TCO research (Methodology v${COST_METHODOLOGY_VERSION}). ${DISCLAIMER}`,
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "netify_get_delivery_model_comparison",
    description:
      `Managed vs co-managed vs DIY SASE delivery comparison from the Netify SASE cost and TCO research (Methodology v${COST_METHODOLOGY_VERSION}). ${DISCLAIMER}`,
    inputSchema: { type: "object", properties: {}, required: [] },
  },
] as const;

export const COST_TOOL_NAMES = new Set<string>(
  MCP_COST_TOOL_DEFINITIONS.map((t) => t.name),
);

const REGION_LABELS: Record<string, string> = {
  uk_ireland: "UK and Ireland",
  europe: "Europe",
  north_america: "North America",
  asia_pacific: "Asia Pacific",
  apac: "Asia Pacific",
  middle_east_africa: "Middle East and Africa",
  latin_america: "Latin America",
};

function demandStatsPayload(agg: Awaited<ReturnType<typeof getDemandAggregate>>) {
  if (agg.samples < SUPPRESSION_THRESHOLD) return { available: false };
  const out: Record<string, unknown> = {
    available: true,
    windowDays: 90,
    windowBasis: "three most recent calendar months",
    generatedAt: new Date().toISOString(),
  };
  const dm = agg.operating_model;
  const managed = dm["managed"] ?? 0;
  const coManaged = dm["co_managed"] ?? 0;
  const diy = dm["diy"] ?? 0;
  const dmTotal = managed + coManaged + diy;
  if (dmTotal >= SUPPRESSION_THRESHOLD) {
    out.deliveryModelShare = {
      managed: Math.round((managed / dmTotal) * 100),
      coManaged: Math.round((coManaged / dmTotal) * 100),
      diy: Math.round((diy / dmTotal) * 100),
    };
  }
  const secTotal = Object.values(agg.mandatory_security_features).reduce((a, b) => a + b, 0);
  if (secTotal >= SUPPRESSION_THRESHOLD) {
    out.topSecurityComponents = Object.entries(agg.mandatory_security_features)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([fid]) => FEATURE_NAMES[fid])
      .filter(Boolean);
  }
  const regionTotal = Object.values(agg.regions).reduce((a, b) => a + b, 0);
  if (regionTotal >= SUPPRESSION_THRESHOLD) {
    const merged = new Map<string, number>();
    for (const [k, n] of Object.entries(agg.regions)) {
      const label = REGION_LABELS[k];
      if (!label) continue;
      merged.set(label, (merged.get(label) ?? 0) + n);
    }
    out.topRegionsInScope = [...merged.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label]) => label);
  }
  return out;
}

export async function callCostTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "netify_estimate_sase_tco": {
      const parsed = EstimateInput.safeParse(args);
      if (!parsed.success) {
        return { error: "Invalid estimate input.", issues: parsed.error.issues.slice(0, 10) };
      }
      return estimate(parsed.data);
    }
    case "netify_get_sase_provider_categories":
      return buildProviderCategories();
    case "netify_get_sase_demand_stats":
      return demandStatsPayload(await getDemandAggregate());
    case "netify_get_sase_cost_drivers":
      return COST_DRIVER_DEFINITIONS
        ? { methodologyVersion: COST_METHODOLOGY_VERSION, disclaimer: DISCLAIMER, costDrivers: COST_DRIVER_DEFINITIONS }
        : {
            available: false,
            note: "Cost driver definitions are supplied verbatim from the reviewed page copy and have not been loaded yet.",
          };
    case "netify_get_delivery_model_comparison":
      return DELIVERY_MODEL_COMPARISON
        ? { methodologyVersion: COST_METHODOLOGY_VERSION, disclaimer: DISCLAIMER, deliveryModelComparison: DELIVERY_MODEL_COMPARISON }
        : {
            available: false,
            note: "The delivery model comparison is supplied verbatim from the reviewed page copy and has not been loaded yet.",
          };
    default:
      return { error: `Unknown cost tool: ${name}` };
  }
}
