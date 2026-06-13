import { corsHeaders, preflight } from "@/lib/cors";
import { getOpportunity, kvConfigured } from "@/lib/rfp-store";
import { addFeedItem } from "@/lib/opportunity";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/** Buyer posts a comment, awards the opportunity, or closes it. */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const opp = await getOpportunity(id);
  if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
  let body: { buyer_token?: string; action?: string; body?: string; award_slug?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  if (body.buyer_token !== opp.buyer_token) return Response.json({ error: "Not authorised." }, { status: 403, headers: cors });
  const name = opp.buyer_org || "Buyer";
  if (body.action === "award" && body.award_slug) {
    const updated = await addFeedItem({ ...opp, awarded_vendor_slug: body.award_slug }, "buyer", null, name, "award", body.body || `Awarded to ${body.award_slug}.`);
    return Response.json(updated, { headers: cors });
  }
  if (body.action === "close") {
    return Response.json(await addFeedItem(opp, "buyer", null, name, "closed", body.body || "Opportunity closed."), { headers: cors });
  }
  return Response.json(await addFeedItem(opp, "buyer", null, name, "comment", body.body ?? ""), { headers: cors });
}
