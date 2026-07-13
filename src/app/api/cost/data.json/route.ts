/**
 * GET /sase/api/cost/data.json
 *
 * Machine-readable twin of the SASE cost and TCO research: one document
 * bundling the provider categories, the demand aggregates, the estimator
 * contract and the methodology metadata. This is the Cite This Research
 * target for the page at /insights/sase-cost-tco-global-enterprise/ and
 * the discovery document for AI agents (the callable tools are listed
 * under interactiveSurfaces).
 *
 * The cost-driver definitions and the delivery-model and pricing-model
 * comparison tables come verbatim from FINAL_PAGE_COPY_sase_cost_tco.md;
 * they are added when that file is supplied (tracked in
 * lib/cost-page-copy.ts). Nothing here is ever invented.
 */
import { corsHeaders, preflight } from "@/lib/cors";
import { buildProviderCategories, COST_METHODOLOGY_VERSION } from "@/lib/cost-categories";
import { getDemandAggregate } from "@/lib/rfp-store";
import { COST_PAGE_TABLES } from "@/lib/cost-page-copy";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";

const SUPPRESSION_THRESHOLD = 20;

// SITE_URL is "https://netify.co.uk/sase" (this app's basePath); the cost
// and TCO article lives on the apex domain.
const APEX_URL = SITE_URL.replace(/\/sase$/, "");

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const providerCategories = buildProviderCategories();

  // Demand block mirrors the demand-stats endpoint's suppression gate.
  const agg = await getDemandAggregate();
  const demandStats =
    agg.samples < SUPPRESSION_THRESHOLD
      ? { available: false as const }
      : { available: true as const, note: "Full aggregate at /sase/api/cost/demand-stats" };

  return Response.json(
    {
      title: "Netify SASE Cost and TCO dataset",
      page: `${APEX_URL}/insights/sase-cost-tco-global-enterprise/`,
      methodologyVersion: COST_METHODOLOGY_VERSION,
      generatedAt: new Date().toISOString(),
      license: "Reuse permitted with attribution to Netify (netify.co.uk)",
      publisher: "Netify Group Limited",
      disclaimer:
        "Indicative bands from the Netify SASE Methodology v2026.1 calibration, not vendor quotes.",
      providerCategories,
      demandStats,
      ...COST_PAGE_TABLES,
      estimator: {
        endpoint: `${SITE_URL}/api/cost/estimate`,
        method: "POST",
        input: {
          users: "integer, 50 to 250000",
          sites: "integer, 1 to 5000",
          regions:
            'array, unique subset of ["uk-europe","north-america","apac","middle-east-africa","latam"]',
          securityDepth: '"sse-only" | "full-sase" | "full-sase-plus-advanced"',
          deliveryModel: '"managed" | "co-managed" | "diy"',
          termYears: "1 | 3 | 5",
        },
        output: {
          monthlyBandGBP: "[low, high]",
          threeYearTcoBandGBP: "[low, high]",
          byDriver:
            "usersAndDevices, securityDepth, sitesAndRegions, bandwidthProfile, deliveryModel, implementationAndMigration, hiddenAndRecurring: each [low, high]",
          oneOffImplementationBandGBP: "[low, high]",
          methodologyVersion: "string",
          disclaimer: "string",
          notes: "string[]",
        },
      },
      interactiveSurfaces: [
        {
          type: "mcp",
          endpoint: `${SITE_URL}/api/mcp`,
          tools: [
            "netify_estimate_sase_tco",
            "netify_get_sase_provider_categories",
            "netify_get_sase_demand_stats",
            "netify_get_sase_cost_drivers",
            "netify_get_delivery_model_comparison",
          ],
        },
      ],
    },
    {
      headers: {
        ...corsHeaders(req),
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
