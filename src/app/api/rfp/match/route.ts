import { corsHeaders, preflight } from "@/lib/cors";
import { matchSuppliers } from "@/lib/supplier-match";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Live supplier match for the Describe wizard: how many verified suppliers
 * on the marketplace fit a scope, region set and delivery model. Public and
 * side-effect free; counts come from the vendor dataset, never invented.
 *
 *   GET /api/rfp/match?scope=sdwan&regions=uk_ireland.europe&model=managed
 */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "any";
  const regions = (url.searchParams.get("regions") ?? "").split(".").filter(Boolean);
  const model = url.searchParams.get("model") ?? "any";
  const result = matchSuppliers({ scope, regions, model });
  return Response.json(
    { ok: true, ...result, methodology: "Netify vendor dataset, live" },
    { headers: { ...cors, "cache-control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
