import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, getConnection, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { inviteSupplier, addMessage } from "@/lib/rfp-connect";
import { listApprovals, getApproval, setApprovalStatus, listReviews, listAudit, listDigests, recordAudit } from "@/lib/agent-store";
import { isMarketUnlocked } from "@/lib/market-unlock";
import { getLatestPublishedSnapshot } from "@/lib/published-snapshot";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/** Buyer view: pending proposals, bid reviews and the audit trail. Owner-only:
 *  bid reviews score named suppliers against each other, which no supplier
 *  (or stranger with the id) should be able to read. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project);
  if (!access.ok) return ownerRequired("Reading agent reviews and approvals", cors);
  const [approvals, reviews, audit, digests] = await Promise.all([listApprovals(id), listReviews(id), listAudit(id), listDigests(id)]);
  return Response.json({
    approvals,
    reviews,
    digests,
    audit: audit.slice(0, 100),
    risks: audit.filter((a) => a.action === "risk_flag").slice(0, 20),
  }, { headers: cors });
}

/**
 * Approve or reject a proposed action. This is the human-in-the-loop gate.
 * Approving executes the underlying action; in Slice 1 the only kind is
 * send_clarification, which posts the question to the supplier in-app (no
 * email, no auto-send). Needs identity: buyer/Netify session OR manage_token.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { action?: "approve" | "reject"; approval_id?: string; edited_question?: string; manage_token?: string } = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Approving an action", cors);
  const sessionOk = !access.viaToken;
  if (!body.approval_id || !body.action) return Response.json({ error: "approval_id and action are required." }, { status: 422, headers: cors });

  const item = await getApproval(id, body.approval_id);
  if (!item) return Response.json({ error: "Proposal not found." }, { status: 404, headers: cors });
  if (item.status !== "pending") return Response.json({ error: `Proposal already ${item.status}.` }, { status: 409, headers: cors });

  if (body.action === "reject") {
    const updated = await setApprovalStatus(id, item.id, "rejected");
    await recordAudit({ rfp_id: id, action: "reject_action", actor: sessionOk ? "buyer" : "agent", summary: `Rejected: ${item.summary}`, rationale: "Buyer declined the proposed action.", ref: item.id });
    return Response.json({ ok: true, approval: updated }, { headers: cors });
  }

  // approve -> execute
  const question = (body.edited_question ?? item.payload.question ?? "").trim();
  try {
    if (item.kind === "send_clarification" && item.vendor_slug) {
      if (!(await isMarketUnlocked(id))) {
        return Response.json({ error: "This supplier action is locked until publication and MarketUnlock complete successfully.", code: "market_locked" }, { status: 409, headers: cors });
      }
      let conn = await getConnection(id, item.vendor_slug);
      if (!conn) {
        const snapshot = await getLatestPublishedSnapshot(id);
        const frozen = snapshot?.provider_evidence?.find((provider) => provider.slug === item.vendor_slug)?.record;
        const inv = await inviteSupplier(id, item.vendor_slug, "", frozen);
        if ("error" in inv) throw new Error(inv.error);
        conn = inv;
      }
      await addMessage(conn, "buyer", "message", question);
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed to execute action." }, { status: 502, headers: cors });
  }

  const updated = await setApprovalStatus(id, item.id, "executed");
  await recordAudit({ rfp_id: id, action: "execute_action", actor: sessionOk ? "buyer" : "agent", summary: `Sent clarification to ${item.vendor_name || item.vendor_slug}`, rationale: `Approved by ${sessionOk ? "buyer" : "token holder"}. Original proposal rationale: ${item.rationale}`, ref: item.id });
  return Response.json({ ok: true, approval: updated }, { headers: cors });
}
