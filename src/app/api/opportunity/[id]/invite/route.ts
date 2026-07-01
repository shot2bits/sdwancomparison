import { corsHeaders, preflight } from "@/lib/cors";
import { getOpportunity, kvConfigured } from "@/lib/rfp-store";
import { inviteSupplierToOpportunity } from "@/lib/opportunity";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/** Buyer invites a graded vendor; returns the per-supplier opportunity token. */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const opp = await getOpportunity(id);
  if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
  let body: { vendor_slug?: string; buyer_token?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  if (body.buyer_token !== opp.buyer_token) return Response.json({ error: "Not authorised." }, { status: 403, headers: cors });
  if (!body.vendor_slug) return Response.json({ error: "vendor_slug is required." }, { status: 422, headers: cors });
  const r = await inviteSupplierToOpportunity(opp, body.vendor_slug);
  if ("error" in r) return Response.json(r, { status: 422, headers: cors });
  return Response.json({ token: r.token, supplier_url: `/sase/opportunities/supplier/${r.token}`, opportunity: r.opp }, { headers: cors });
}
