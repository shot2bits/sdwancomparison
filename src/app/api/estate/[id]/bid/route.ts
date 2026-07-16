import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";
import { getEstate, saveEstate } from "@/lib/estate-store";
import { BidSchema } from "@/lib/estate-types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Record a bid against an estate. Two identities may write:
 * - a Netify session (the team brokers pricing in, matching how RFP
 *   responses are relayed today), for any vendor;
 * - a verified supplier session, only for its own vendor_slug.
 * Bid values are private: they render only to the manage-key holder.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const estate = await getEstate(id);
  if (!estate) return Response.json({ error: "Estate not found." }, { status: 404, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session) return Response.json({ error: "Sign-in required to bid." }, { status: 401, headers: cors });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const slug = String(body.vendor_slug ?? "");
  const isNetify = session.role === "netify";
  const isOwnSupplier = session.role === "supplier" && session.vendor_slug === slug;
  if (!isNetify && !isOwnSupplier) return Response.json({ error: "Not authorised for this vendor." }, { status: 403, headers: cors });

  const idx = estate.bids.findIndex((b) => b.vendor_slug === slug);
  if (idx === -1) return Response.json({ error: "This vendor was not invited to bid on this estate." }, { status: 404, headers: cors });

  const status = body.status === "declined" ? "declined" : "received";
  const parsed = BidSchema.safeParse({
    ...estate.bids[idx],
    status,
    value: status === "received" && typeof body.value === "number" ? body.value : null,
    currency: typeof body.currency === "string" ? body.currency : "GBP",
    unit: body.unit === "per_site_month" || body.unit === "total_month" ? body.unit : "per_user_month",
    term_months: typeof body.term_months === "number" ? body.term_months : 36,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
    reason: status === "declined" && typeof body.reason === "string" ? body.reason.slice(0, 200) : "",
    at: Date.now(),
  });
  if (!parsed.success) return Response.json({ error: "Invalid bid payload." }, { status: 422, headers: cors });

  const bids = [...estate.bids];
  bids[idx] = parsed.data;
  const saved = await saveEstate({ ...estate, bids });
  return Response.json({ ok: true, bid: { vendor_slug: slug, status: parsed.data.status } , bids_total: saved.bids.length }, { headers: cors });
}
