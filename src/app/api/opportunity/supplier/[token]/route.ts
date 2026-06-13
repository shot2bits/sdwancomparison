import { corsHeaders, preflight } from "@/lib/cors";
import { resolveOpportunityToken, getOpportunity, kvConfigured } from "@/lib/rfp-store";
import { addFeedItem, vendorName } from "@/lib/opportunity";
import type { Pricing } from "@/lib/opportunity-types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ token: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/** Supplier reads the opportunity and its live feed by token. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { token } = await ctx.params;
  const ref = await resolveOpportunityToken(token);
  if (!ref) return Response.json({ error: "Invalid token." }, { status: 404, headers: cors });
  const opp = await getOpportunity(ref.opp_id);
  if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
  return Response.json({ opportunity: opp, vendor_slug: ref.vendor_slug, vendor_name: vendorName(ref.vendor_slug) }, { headers: cors });
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
  let body: { type?: string; body?: string; pricing?: Pricing };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const allowed = ["comment", "pricing", "interest", "decline"];
  const type = (allowed.includes(body.type ?? "") ? body.type : "comment") as "comment" | "pricing" | "interest" | "decline";
  const name = vendorName(ref.vendor_slug) ?? ref.vendor_slug;
  const updated = await addFeedItem(opp, "supplier", ref.vendor_slug, name, type, body.body ?? "", type === "pricing" ? (body.pricing ?? null) : null);
  return Response.json(updated, { headers: cors });
}
