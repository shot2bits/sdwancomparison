import { corsHeaders, preflight } from "@/lib/cors";
import { getOpportunity, kvConfigured } from "@/lib/rfp-store";
import { addFeedItem, buyerActorName, acceptIntroduction } from "@/lib/opportunity";

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
  let body: { buyer_token?: string; action?: string; body?: string; award_slug?: string; vendor_slug?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  if (body.buyer_token !== opp.buyer_token) return Response.json({ error: "Not authorised." }, { status: 403, headers: cors });
  // Never sign feed posts with the organisation name on an anonymous notice.
  const name = buyerActorName(opp);
  if (body.action === "accept_introduction" && body.vendor_slug) {
    // The fourth promise made mechanical (Robert's E4 ruling, 29 Jul
    // 2026): the buyer chooses which suppliers receive their contact
    // details, and when. This is the choosing; the supplier route opens
    // the contact only on this record.
    const result = await acceptIntroduction(opp, String(body.vendor_slug));
    if ("error" in result) return Response.json({ error: result.error }, { status: 422, headers: cors });
    return Response.json(result, { headers: cors });
  }
  if (body.action === "award" && body.award_slug) {
    const updated = await addFeedItem({ ...opp, awarded_vendor_slug: body.award_slug }, "buyer", null, name, "award", body.body || `Awarded to ${body.award_slug}.`);
    return Response.json(updated, { headers: cors });
  }
  if (body.action === "close") {
    // The buyer's own close, honouring the publish signature's "Yours to
    // close" (Harry's Section 1 finding, 28 Jul 2026: the room offered no
    // close control). addFeedItem already derives status "closed" from the
    // feed type and saves; this call additionally stamps `updated`, exactly
    // as the admin moderation close does, so the board's freshness line and
    // the closed archive order stay honest. The live board and data.json
    // drop the notice on the status alone.
    const updated = await addFeedItem({ ...opp, updated: Date.now() }, "buyer", null, name, "closed", body.body || "Opportunity closed by the buyer.");
    return Response.json(updated, { headers: cors });
  }
  return Response.json(await addFeedItem(opp, "buyer", null, name, "comment", body.body ?? ""), { headers: cors });
}
