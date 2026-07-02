import { corsHeaders, preflight } from "@/lib/cors";
import { getOpportunity, kvConfigured } from "@/lib/rfp-store";
import { maskedFeed } from "@/lib/opportunity";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Poll endpoint: feed items after ?since= (ms). Powers the near-realtime room.
 *
 * Privacy: pricing amounts are private to the posting buyer. Only a caller
 * presenting the matching buyer_token receives amounts; everyone else gets
 * the masked feed (pricing submissions visible, figures withheld). Anonymous
 * buyers' names are masked for non-owners too.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const opp = await getOpportunity(id);
  if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? 0);
  const providedToken = url.searchParams.get("buyer_token") ?? req.headers.get("x-buyer-token");
  const isOwner = Boolean(providedToken && providedToken === opp.buyer_token);
  const feed = isOwner ? opp.feed : maskedFeed(opp);
  const items = feed.filter((f) => f.created > since);
  return Response.json({ items, now: Date.now(), status: opp.status, invited: opp.invited }, { headers: cors });
}
