import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listConnections, getConnection, kvConfigured } from "@/lib/rfp-store";
import { inviteSupplier, addMessage } from "@/lib/rfp-connect";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { hasPublished } from "@/lib/project-machine";

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

  // Row-8 hotfix (16 Aug 2026): a supplier connection is a real, addressable,
  // persisted invitation — the brief's own Procurement Room description says
  // publish "creates invitations idempotently", i.e. invitations are a
  // consequence of publication, not something that can exist before it. This
  // route previously had no status check at all, so any owner (or anyone who
  // could satisfy requireRfpOwner) could invite, message or otherwise contact
  // a named supplier while the project was still a private draft — the exact
  // pre-publication supplier-identity/contact leak this hotfix closes. This
  // must be checked before requireRfpOwner, not after: it is a publication-
  // state rule, not an ownership rule, and applies equally to the owner.
  if (!hasPublished(project.status)) {
    return Response.json(
      { error: "Publish the RFP before inviting or contacting vendors.", code: "not_published" },
      { status: 409, headers: cors },
    );
  }

  let body: { vendor_slug?: string; intro?: string; action?: string; body?: string; manage_token?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Inviting or messaging vendors", cors);
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
