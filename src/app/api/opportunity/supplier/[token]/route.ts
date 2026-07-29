import { corsHeaders, preflight } from "@/lib/cors";
import { resolveOpportunityToken, getOpportunity, kvConfigured } from "@/lib/rfp-store";
import { addFeedItem, vendorName, maskedFeed } from "@/lib/opportunity";
import type { Pricing } from "@/lib/opportunity-types";
import { sessionFromRequest, requireClaimedSupplierFor } from "@/lib/auth";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ token: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Supplier reads the opportunity and its live feed by token.
 *
 * Security: never return the buyer's credentials (buyer_token, owner_email)
 * to a supplier. Pricing amounts are private to the buyer: this supplier
 * sees its own submitted figures, other suppliers' amounts are masked.
 * Anonymous buyers' names are masked in the feed.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { token } = await ctx.params;
  const ref = await resolveOpportunityToken(token);
  if (!ref) return Response.json({ error: "Invalid token." }, { status: 404, headers: cors });
  const opp = await getOpportunity(ref.opp_id);
  if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
  const { buyer_token: _bt, owner_email: _oe, ...rest } = opp;
  // Contact details pass only after the buyer accepts an introduction
  // (Robert's E4 ruling, 29 Jul 2026). The spread above strips
  // owner_email unconditionally so it can never leak by accident; the
  // introduction object below is the ONE gate that carries it, and only
  // to the introduced supplier. Until then the supplier sees the fact of
  // the rule, not the address.
  const introduced = (opp.introduced ?? []).includes(ref.vendor_slug);
  const supplierView = {
    ...rest,
    buyer_token: "",
    buyer_org: opp.buyer_visibility === "anonymous" ? "" : opp.buyer_org,
    feed: maskedFeed(opp, ref.vendor_slug),
    introduction: introduced
      ? { accepted: true, contact_email: opp.owner_email || null, organisation: opp.buyer_org || null }
      : { accepted: false },
  };
  return Response.json({ opportunity: supplierView, vendor_slug: ref.vendor_slug, vendor_name: vendorName(ref.vendor_slug) }, { headers: cors });
}

/** Supplier posts to the feed: comment, register interest, submit pricing, or decline. */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { token } = await ctx.params;
  const ref = await resolveOpportunityToken(token);
  if (!ref) return Response.json({ error: "Invalid token." }, { status: 404, headers: cors });
  const opp = await getOpportunity(ref.opp_id);
  if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
  if (opp.status !== "open") return Response.json({ error: "This opportunity is not open." }, { status: 409, headers: cors });
  const session = await sessionFromRequest(req);
  const gate = await requireClaimedSupplierFor(session, ref.vendor_slug, cors);
  if (gate) return gate;
  let body: { type?: string; body?: string; pricing?: Pricing; links?: string[]; answers?: Record<string, string> };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const allowed = ["comment", "pricing", "interest", "decline", "response", "question"];
  const type = (allowed.includes(body.type ?? "") ? body.type : "comment") as "comment" | "pricing" | "interest" | "decline" | "response" | "question";
  const name = vendorName(ref.vendor_slug) ?? ref.vendor_slug;
  const updated = await addFeedItem(
    opp, "supplier", ref.vendor_slug, name, type, body.body ?? "",
    type === "pricing" || type === "response" ? (body.pricing ?? null) : null,
    body.links ?? [],
    type === "response" ? (body.answers ?? {}) : {},
  );
  // Same masking as the GET: never return buyer credentials or other
  // suppliers' pricing amounts in the post-action snapshot. The
  // introduction object mirrors the GET so the room state never flickers.
  const { buyer_token: _bt2, owner_email: _oe2, ...rest2 } = updated;
  const introducedNow = (updated.introduced ?? []).includes(ref.vendor_slug);
  return Response.json({
    ...rest2,
    buyer_token: "",
    buyer_org: updated.buyer_visibility === "anonymous" ? "" : updated.buyer_org,
    feed: maskedFeed(updated, ref.vendor_slug),
    introduction: introducedNow
      ? { accepted: true, contact_email: updated.owner_email || null, organisation: updated.buyer_org || null }
      : { accepted: false },
  }, { headers: cors });
}
