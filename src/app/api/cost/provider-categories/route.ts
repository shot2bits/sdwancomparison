/**
 * GET /sase/api/cost/provider-categories
 *
 * Provider categories for the SASE cost and TCO page, generated from the
 * marketplace vendor dataset (never a hand-written list). See
 * lib/cost-categories.ts for the category membership and the flagged
 * marketplace-only entries.
 */
import { corsHeaders, preflight } from "@/lib/cors";
import { buildProviderCategories } from "@/lib/cost-categories";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const payload = buildProviderCategories();
  return Response.json(payload, {
    headers: {
      ...corsHeaders(req),
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
