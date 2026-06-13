import { corsHeaders, preflight } from "@/lib/cors";
import { getConnectionByToken, getProject, kvConfigured } from "@/lib/rfp-store";
import { addMessage } from "@/lib/rfp-connect";
import { sessionFromRequest, requireSupplierFor } from "@/lib/auth";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ token: string }> };

export async function OPTIONS(req: Request) { return preflight(req); }

/** Supplier: read their connection (RFP summary + message thread) by token. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { token } = await ctx.params;
  const conn = await getConnectionByToken(token);
  if (!conn) return Response.json({ error: "Connection not found." }, { status: 404, headers: cors });
  const project = await getProject(conn.rfp_id);
  return Response.json({
    connection: conn,
    rfp: project ? {
      title: project.title, status: project.status, sector: project.buyer.sector,
      product_scope: project.buyer.product_scope, operating_model: project.buyer.operating_model,
      regions: project.buyer.regions, compliance: project.buyer.compliance,
      question_count: project.rfp_sections.filter((s) => s.included).reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0),
    } : null,
  }, { headers: cors });
}

/**
 * Supplier actions by token:
 *  { action: "message"|"demo_response"|"contact_share"|"decline", body, payload }
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { token } = await ctx.params;
  const conn = await getConnectionByToken(token);
  if (!conn) return Response.json({ error: "Connection not found." }, { status: 404, headers: cors });
  const session = await sessionFromRequest(req);
  const gate = requireSupplierFor(session, conn.vendor_slug, cors);
  if (gate) return gate;
  let body: { action?: string; body?: string; payload?: Record<string, string> };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const allowed = ["message", "demo_response", "contact_share", "decline"] as const;
  const type = (allowed as readonly string[]).includes(body.action ?? "") ? (body.action as (typeof allowed)[number]) : "message";
  const updated = await addMessage(conn, "supplier", type, body.body ?? "", body.payload ?? {});
  return Response.json(updated, { headers: cors });
}
