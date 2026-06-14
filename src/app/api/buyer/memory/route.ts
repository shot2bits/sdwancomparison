import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";
import { getBuyerMemory, setBuyerMemoryFields, emptyMemory, RISK_TOLERANCE } from "@/lib/buyer-memory";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * The buyer's own memory. Transparent and editable by design: the buyer can see
 * exactly what the system thinks it knows, and change it. Identity required, and
 * a buyer only ever sees their own memory. Anonymous sessions have no memory.
 */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session?.email || session.role === "supplier") {
    return Response.json({ error: "Sign in as a buyer to view your saved memory.", auth_required: true }, { status: 401, headers: cors });
  }
  const memory = (await getBuyerMemory(session.email)) ?? emptyMemory(session.email);
  return Response.json({ memory }, { headers: cors });
}

/** Explicit buyer edit. Overwrites the provided fields (the buyer owns this data). */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session?.email || session.role === "supplier") {
    return Response.json({ error: "Sign in as a buyer to edit your memory.", auth_required: true }, { status: 401, headers: cors });
  }
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  const fields: Record<string, unknown> = {};
  const strArr = (v: unknown) => Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : undefined;
  if (typeof body.organisation === "string") fields.organisation = body.organisation.slice(0, 200);
  if (typeof body.organisation_size === "string") fields.organisation_size = body.organisation_size;
  if (typeof body.operating_model === "string") fields.operating_model = body.operating_model;
  if (typeof body.budget_notes === "string") fields.budget_notes = body.budget_notes.slice(0, 1000);
  if (typeof body.risk_tolerance === "string" && (RISK_TOLERANCE as readonly string[]).includes(body.risk_tolerance)) fields.risk_tolerance = body.risk_tolerance;
  for (const k of ["preferred_vendor_slugs", "avoided_vendor_slugs", "compliance_baseline", "regions", "notes"]) {
    const arr = strArr(body[k]);
    if (arr) fields[k] = arr;
  }

  const memory = await setBuyerMemoryFields(session.email, fields);
  return Response.json({ ok: true, memory }, { headers: cors });
}
