import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listConnections, getConnection, kvConfigured } from "@/lib/rfp-store";
import { inviteSupplier, addMessage } from "@/lib/rfp-connect";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) { return preflight(req); }

/** Buyer: list supplier connections for the RFP. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  return Response.json({ connections: await listConnections(id) }, { headers: cors });
}

/**
 * Buyer actions:
 *  { vendor_slug, intro }                          -> invite a supplier
 *  { vendor_slug, action: "message"|"demo_request"|"contact_request", body } -> post to an existing connection
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { vendor_slug?: string; intro?: string; action?: string; body?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  if (!body.vendor_slug) return Response.json({ error: "vendor_slug is required." }, { status: 422, headers: cors });

  if (!body.action) {
    const conn = await inviteSupplier(id, body.vendor_slug, body.intro ?? "");
    if ("error" in conn) return Response.json(conn, { status: 422, headers: cors });
    return Response.json(conn, { headers: cors });
  }

  const conn = await getConnection(id, body.vendor_slug);
  if (!conn) return Response.json({ error: "Invite the supplier first." }, { status: 404, headers: cors });
  const type = body.action === "demo_request" ? "demo_request" : body.action === "contact_request" ? "contact_request" : "message";
  const defaults: Record<string, string> = {
    demo_request: "The buyer requests a product demonstration.",
    contact_request: "The buyer requests your contact details to take this forward.",
  };
  const updated = await addMessage(conn, "buyer", type, body.body || defaults[type] || "", {});
  return Response.json(updated, { headers: cors });
}
