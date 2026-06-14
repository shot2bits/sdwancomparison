import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { partnerEmail } from "@/lib/partner-auth";
import { getPartnerApproval, setPartnerApprovalStatus, recordPartnerAudit } from "@/lib/partner-store";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Approve or reject a drafted external action. In Slice R1 there is no send
 * path: approving records the decision (ready to send once sending ships in a
 * later slice); rejecting discards. Nothing is sent to a customer, account
 * manager or BT.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const email = await partnerEmail(req);
  if (!email) return Response.json({ error: "Sign in to manage your drafts.", auth_required: true }, { status: 401, headers: cors });

  let body: { action?: "approve" | "reject"; approval_id?: string } = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  if (!body.approval_id || !body.action) return Response.json({ error: "approval_id and action are required." }, { status: 422, headers: cors });

  const item = await getPartnerApproval(email, body.approval_id);
  if (!item) return Response.json({ error: "Draft not found." }, { status: 404, headers: cors });
  if (item.status !== "pending") return Response.json({ error: `Draft already ${item.status}.` }, { status: 409, headers: cors });

  if (body.action === "reject") {
    const updated = await setPartnerApprovalStatus(email, item.id, "rejected");
    await recordPartnerAudit({ partner_email: email, action: "reject_external", actor: "partner", summary: `Rejected draft: ${item.summary}`, rationale: "Partner discarded the drafted outreach.", ref: item.id });
    return Response.json({ ok: true, approval: updated }, { headers: cors });
  }

  const updated = await setPartnerApprovalStatus(email, item.id, "approved");
  await recordPartnerAudit({ partner_email: email, action: "approve_external", actor: "partner", summary: `Approved draft (not yet sent): ${item.summary}`, rationale: "Partner approved the draft. Sending is a later slice; nothing has left in R1.", ref: item.id });
  return Response.json({ ok: true, approval: updated, note: "Approved. Sending is not enabled in this release, so nothing has been sent yet." }, { headers: cors });
}
