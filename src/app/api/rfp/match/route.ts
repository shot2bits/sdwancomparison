import { corsHeaders, preflight } from "@/lib/cors";
import { matchSuppliers } from "@/lib/supplier-match";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Aggregate-only market size for the Describe wizard and the pre-publish
 * RFP Builder: how big the whole evaluated marketplace is for a scope,
 * region set and delivery model. Public and side-effect free.
 *
 * Living Procurement Canvas Phase 2 hotfix (14 Aug 2026), Robert's finding:
 * this route has no project id or status -- it cannot tell a pre-publish
 * caller from a post-publish one, so it must never carry anything
 * project-specific. It used to spread `matchSuppliers()`'s full result
 * into the response, including `count` (a narrowed match count) and
 * `names`/`slugs` (the actual narrowed vendor list) -- letting any caller,
 * published or not, read out real vendor identities. RfpBuilder.tsx did
 * exactly that, live, before publication.
 *
 * This route now returns ONLY `total` (the whole evaluated-market size,
 * filter-independent -- see supplier-match.ts, `total = all.length` before
 * narrowing) and `methodology`. `count`/`names`/`slugs` are dropped here,
 * at the boundary, rather than trusting every caller to discard them --
 * the only way to make the leak structurally impossible rather than just
 * currently-unused. A project's REAL matched/invited vendors live in the
 * owner-gated, publish-status-aware routes (`/api/rfp/[id]/report`, the
 * `/publish` response) -- never here.
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
    { ok: true, total: result.total, methodology: "Netify vendor dataset, live" },
    { headers: { ...cors, "cache-control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
