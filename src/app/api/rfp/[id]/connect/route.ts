import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listConnections, getConnection, kvConfigured } from "@/lib/rfp-store";
import { inviteSupplier, addMessage } from "@/lib/rfp-connect";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { isMarketUnlocked } from "@/lib/market-unlock";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) { return preflight(req); }

/** Buyer: list supplier connections for the RFP. Owner-only: each connection
 *  carries the supplier's private reply token, so an open list would let
 *  anyone with the id read (and impersonate) every invited supplier. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project);
  if (!access.ok) return ownerRequired("Listing vendor connections", cors);
  return Response.json({ connections: await listConnections(id) }, { headers: cors });
}

/**
 * Buyer actions (owner-only: inviting and messaging reach named suppliers):
 *  { vendor_slug, intro }                          -> invite a supplier
 *  { vendor_slug, action: "message"|"demo_request"|"contact_request", body } -> post to an existing connection
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  // Market-unlock correction round (16 Aug 2026), Robert's ruling on
  // ordering: load the project, parse only what owner authentication needs,
  // authenticate/authorise, and ONLY THEN check publication/market state —
  // reversing the row-8 hotfix's original order, which checked publish
  // state BEFORE ownership and so let an unauthorised caller distinguish a
  // draft (409) from other lifecycle states via the response alone, without
  // ever proving ownership. Body parsing happens here too (requireRfpOwner
  // needs a body-carried manage_token when no header/query token is
  // present) — nothing beyond what authentication itself requires.
  let body: { vendor_slug?: string; intro?: string; action?: string; body?: string; manage_token?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Inviting or messaging vendors", cors);

  // A supplier connection is a real, addressable, persisted invitation — the
  // brief's own Procurement Room description says publish "creates
  // invitations idempotently", i.e. invitations are a consequence of a
  // genuinely unlocked market, not something that can exist before it.
  // market-unlock.ts's canonical predicate replaces the row-8 hotfix's
  // `hasPublished(project.status)` check here: a project can satisfy
  // hasPublished() while its board listing (and therefore its market
  // unlock) has failed or never completed, and this route must refuse in
  // that state too, not just while the project is a plain draft.
  if (!(await isMarketUnlocked(id))) {
    return Response.json(
      { error: "This RFP's market has not unlocked yet — publish (and, if the board listing hasn't completed, list on the board) before inviting or contacting vendors.", code: "market_locked" },
      { status: 409, headers: cors },
    );
  }
  if (!body.vendor_slug) return Response.json({ error: "vendor_slug is required." }, { status: 422, headers: cors });

  if (!body.action) {
    const conn = await inviteSupplier(id, body.vendor_slug, body.intro ?? "");
    if ("error" in conn) return Response.json(conn, { status: 422, headers: cors });
    return Response.json(conn, { headers: cors });
  }

  const conn = await getConnection(id, body.vendor_slug);
  if (!conn) return Response.json({ error: "Invite the vendor first." }, { status: 404, headers: cors });
  const type = body.action === "demo_request" ? "demo_request" : body.action === "contact_request" ? "contact_request" : "message";
  const defaults: Record<string, string> = {
    demo_request: "The buyer requests a product demonstration.",
    contact_request: "The buyer requests your contact details to take this forward.",
  };
  const updated = await addMessage(conn, "buyer", type, body.body || defaults[type] || "", {});
  return Response.json(updated, { headers: cors });
}
