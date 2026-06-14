import { corsHeaders, preflight } from "@/lib/cors";
import { sessionFromRequest } from "@/lib/auth";
import { kvConfigured, getOpportunity, listInvitedOpportunityIds, listPublicOpportunities, getOrCreateOpportunityToken } from "@/lib/rfp-store";
import { toPublicOpportunity } from "@/lib/opportunity-types";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Opportunities relevant to the signed-in supplier: ones they were invited to,
 * plus open-eligibility opportunities any matching vendor may bid on. Each comes
 * with a stable room token so the supplier can open and bid. Session-gated.
 */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session) return Response.json({ error: "Sign in required.", auth_required: true }, { status: 401, headers: cors });
  if (session.role === "buyer") return Response.json({ error: "Supplier sign-in required." }, { status: 403, headers: cors });
  const slug = session.vendor_slug;
  if (!slug) return Response.json({ ok: true, vendor_slug: null, invited: [], open: [] }, { headers: cors });

  const invitedIds = new Set(await listInvitedOpportunityIds(slug));
  const invited: unknown[] = [];
  for (const id of invitedIds) {
    const o = await getOpportunity(id);
    if (o && o.status === "open") {
      invited.push({ ...toPublicOpportunity(o), room_token: await getOrCreateOpportunityToken(o.id, slug) });
    }
  }

  const open: unknown[] = [];
  for (const p of await listPublicOpportunities()) {
    if (invitedIds.has(p.id)) continue;
    if (p.eligibility !== "open") continue;
    open.push({ ...p, room_token: await getOrCreateOpportunityToken(p.id, slug) });
  }

  return Response.json({ ok: true, vendor_slug: slug, invited, open }, { headers: cors });
}
