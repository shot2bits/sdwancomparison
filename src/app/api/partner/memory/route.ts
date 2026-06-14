import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { partnerEmail } from "@/lib/partner-auth";
import { setPartnerMemoryFields, recordPartnerAudit } from "@/lib/partner-store";
import { ORCA_STATUSES } from "@/lib/partner-types";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** Explicit partner edit of their own memory (transparent and editable). */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const email = await partnerEmail(req);
  if (!email) return Response.json({ error: "Sign in to edit your partner memory.", auth_required: true }, { status: 401, headers: cors });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  const fields: Record<string, unknown> = {};
  const strArr = (v: unknown) => Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : undefined;
  if (typeof body.company_name === "string") fields.company_name = body.company_name.slice(0, 200);
  if (typeof body.companies_house_no === "string") fields.companies_house_no = body.companies_house_no.slice(0, 20);
  if (typeof body.orca_status === "string" && (ORCA_STATUSES as readonly string[]).includes(body.orca_status)) fields.orca_status = body.orca_status;
  if (typeof body.orca_code_on_file === "boolean") fields.orca_code_on_file = body.orca_code_on_file;
  if (typeof body.monthly_opportunity_target === "number") fields.monthly_opportunity_target = Math.max(0, Math.round(body.monthly_opportunity_target));
  if (typeof body.sales_capacity === "string") fields.sales_capacity = body.sales_capacity.slice(0, 300);
  if (typeof body.margin_or_commission_goal === "string") fields.margin_or_commission_goal = body.margin_or_commission_goal.slice(0, 300);
  for (const k of ["target_customer_type", "preferred_sectors", "broadband_focus", "preferred_addons", "blockers", "notes"]) {
    const arr = strArr(body[k]); if (arr) fields[k] = arr;
  }

  const memory = await setPartnerMemoryFields(email, fields);
  await recordPartnerAudit({ partner_email: email, action: "memory_edit", actor: "partner", summary: "Partner edited their memory.", rationale: "Buyer-owned data, explicit edit." });
  return Response.json({ ok: true, memory }, { headers: cors });
}
