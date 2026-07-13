/**
 * GET /sase/api/cost/demand-stats
 *
 * Anonymised aggregates from RFP builder publishes, read from the
 * month-bucketed demand flywheel in lib/rfp-store.ts.
 *
 * Privacy gates (non-negotiable):
 * - Total qualifying samples < 20 -> { available: false } and nothing else.
 * - Any individual statistic whose underlying sample is < 20 is suppressed.
 * - Percentages as whole numbers; counts as bands, never exact; site counts
 *   banded at source; no timestamps finer than the month bucket; no names,
 *   domains or free text anywhere in the response.
 *
 * Fields reflect only what the RFP builder actually captures (Phase 1
 * pre-flight): delivery model preference, regions, product scope, site
 * bands and mandatory security features. User counts and contract terms
 * are not captured by the builder and therefore do not appear.
 */
import { corsHeaders, preflight } from "@/lib/cors";
import { getDemandAggregate } from "@/lib/rfp-store";
import { FEATURE_NAMES } from "@/lib/vendors";

export const runtime = "nodejs";

const SUPPRESSION_THRESHOLD = 20;

const REGION_LABELS: Record<string, string> = {
  uk_ireland: "UK and Ireland",
  europe: "Europe",
  north_america: "North America",
  asia_pacific: "Asia Pacific",
  apac: "Asia Pacific",
  middle_east_africa: "Middle East and Africa",
  latin_america: "Latin America",
};

function sampleBand(n: number): string {
  if (n <= 50) return "21 to 50 published requirements";
  if (n <= 100) return "51 to 100 published requirements";
  if (n <= 250) return "101 to 250 published requirements";
  if (n <= 500) return "251 to 500 published requirements";
  return "more than 500 published requirements";
}

function topLabels(
  counts: Record<string, number>,
  labelOf: (key: string) => string | null,
  limit: number,
): string[] {
  const merged = new Map<string, number>();
  for (const [key, n] of Object.entries(counts)) {
    const label = labelOf(key);
    if (!label) continue;
    merged.set(label, (merged.get(label) ?? 0) + n);
  }
  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const headers = {
    ...corsHeaders(req),
    "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
  };

  const agg = await getDemandAggregate();
  if (agg.samples < SUPPRESSION_THRESHOLD) {
    return Response.json({ available: false }, { headers });
  }

  const body: Record<string, unknown> = {
    available: true,
    windowDays: 90,
    windowBasis: "three most recent calendar months",
    generatedAt: new Date().toISOString(),
    sampleBand: sampleBand(agg.samples),
  };

  // Delivery model share: "any" expresses no preference and is excluded.
  const dm = agg.operating_model;
  const managed = dm["managed"] ?? 0;
  const coManaged = dm["co_managed"] ?? 0;
  const diy = dm["diy"] ?? 0;
  const dmTotal = managed + coManaged + diy;
  if (dmTotal >= SUPPRESSION_THRESHOLD) {
    body.deliveryModelShare = {
      managed: Math.round((managed / dmTotal) * 100),
      coManaged: Math.round((coManaged / dmTotal) * 100),
      diy: Math.round((diy / dmTotal) * 100),
    };
  }

  const secTotal = Object.values(agg.mandatory_security_features).reduce((a, b) => a + b, 0);
  if (secTotal >= SUPPRESSION_THRESHOLD) {
    body.topSecurityComponents = topLabels(
      agg.mandatory_security_features,
      (fid) => FEATURE_NAMES[fid] ?? null,
      3,
    );
  }

  const regionTotal = Object.values(agg.regions).reduce((a, b) => a + b, 0);
  if (regionTotal >= SUPPRESSION_THRESHOLD) {
    body.topRegionsInScope = topLabels(agg.regions, (k) => REGION_LABELS[k] ?? null, 3);
  }

  const siteTotal = Object.values(agg.site_bands).reduce((a, b) => a + b, 0);
  if (siteTotal >= SUPPRESSION_THRESHOLD) {
    const top = Object.entries(agg.site_bands).sort((a, b) => b[1] - a[1])[0];
    if (top) body.mostCommonSiteBand = `${top[0]} sites`;
  }

  return Response.json(body, { headers });
}
