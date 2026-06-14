import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";
import { getGoal, upsertGoal, recordAudit } from "@/lib/agent-store";
import { GoalTargetsSchema, type ProcurementGoal } from "@/lib/agent-types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/** Read the standing procurement goal for an RFP. Open to read. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  return Response.json({ goal: await getGoal(id) }, { headers: cors });
}

/**
 * Set or update the goal. The goal drives autonomous behaviour, so writing it
 * needs identity: a buyer/Netify session OR the RFP manage_token (agents use
 * the token). Reading stays open.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: Partial<ProcurementGoal> & { manage_token?: string } = {};
  try { body = await req.json(); } catch { /* optional */ }

  const session = await sessionFromRequest(req);
  const sessionOk = session?.role === "buyer" || session?.role === "netify";
  const tokenOk = Boolean(project.manage_token) && body.manage_token === project.manage_token;
  if (!sessionOk && !tokenOk) {
    return Response.json({ error: "Setting a procurement goal needs identity. Sign in, or pass the RFP manage_token.", auth_required: true }, { status: 401, headers: cors });
  }

  const patch: Partial<ProcurementGoal> = {};
  if (typeof body.outcome === "string") patch.outcome = body.outcome.slice(0, 2000);
  if (Array.isArray(body.must_have)) patch.must_have = body.must_have.map(String).slice(0, 40);
  if (body.targets) patch.targets = GoalTargetsSchema.parse(body.targets);
  if (body.status) patch.status = body.status;
  if (body.autonomy) patch.autonomy = body.autonomy; // Slice 1: UI only offers propose_approve

  const goal = await upsertGoal(id, patch);
  await recordAudit({ rfp_id: id, action: "goal_set", actor: sessionOk ? "buyer" : "agent", summary: `Goal updated: ${goal.outcome.slice(0, 120) || "(no outcome text)"}`, rationale: "Buyer or authorised agent set the standing procurement goal." });
  return Response.json({ goal }, { headers: cors });
}
