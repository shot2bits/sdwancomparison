import { corsHeaders, preflight } from "@/lib/cors";
import { getOpportunity, kvConfigured } from "@/lib/rfp-store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Fetch one opportunity.
 *
 * Security fix (marketplace rebuild): this endpoint previously returned the
 * full record — including buyer_token — to anyone who knew the id, which let
 * any visitor take buyer actions (invite, award, close). It now returns the
 * feed plus opportunity data WITHOUT buyer_token and owner_email unless the
 * caller proves ownership by supplying the matching buyer_token.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const opp = await getOpportunity(id);
  if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });

  const url = new URL(req.url);
  const providedToken = url.searchParams.get("buyer_token") ?? req.headers.get("x-buyer-token");
  const isOwner = Boolean(providedToken && providedToken === opp.buyer_token);

  if (isOwner) return Response.json(opp, { headers: cors });

  // Viewer projection: full notice + feed for the room, minus secrets. The
  // buyer name is masked when the notice is anonymous.
  const { buyer_token: _bt, owner_email: _oe, ...rest } = opp;
  const viewer = {
    ...rest,
    buyer_org: opp.buyer_visibility === "anonymous" ? "" : opp.buyer_org,
    buyer_token: "", // shape-compatible for older clients; never the real token
  };
  return Response.json(viewer, { headers: cors });
}
