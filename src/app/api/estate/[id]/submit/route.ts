import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { getEstate, saveEstate, seedBids } from "@/lib/estate-store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Submit an estate for bids: bid rows are seeded pending for the chosen
 * providers and the room starts showing pending pricing immediately.
 * v1 (branch): manage-key gated. Before release this gains the same
 * verified-identity gate as RFP publishing, since bids reach named
 * suppliers. Bids are brokered by the Netify team until supplier
 * self-serve lands (deal room phase B).
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const estate = await getEstate(id);
  if (!estate) return Response.json({ error: "Estate not found." }, { status: 404, headers: cors });
  let body: { manage_token?: string; contact_email?: string } = {};
  try { body = await req.json(); } catch { /* token can come via query */ }
  const url = new URL(req.url);
  const token = String(body.manage_token ?? url.searchParams.get("manage") ?? "");
  if (token !== estate.manage_token) return Response.json({ error: "Manage key required." }, { status: 401, headers: cors });
  if (estate.sites.length === 0) return Response.json({ error: "Add at least one site before submitting." }, { status: 422, headers: cors });
  if (estate.status === "submitted") {
    return Response.json({ estate, note: "Already submitted; bids unchanged." }, { headers: cors });
  }
  const withEmail = typeof body.contact_email === "string" && body.contact_email.includes("@")
    ? { ...estate, contact_email: body.contact_email.trim().toLowerCase() }
    : estate;
  const saved = await saveEstate(seedBids(withEmail));
  return Response.json({ estate: saved, bids_seeded: saved.bids.length }, { headers: cors });
}
