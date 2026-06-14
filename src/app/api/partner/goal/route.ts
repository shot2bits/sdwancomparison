import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { partnerEmail } from "@/lib/partner-auth";
import { upsertPartnerGoal, recordPartnerAudit } from "@/lib/partner-store";
import { GOAL_KINDS, type GoalKind } from "@/lib/partner-types";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const email = await partnerEmail(req);
  if (!email) return Response.json({ error: "Sign in to set a reseller goal.", auth_required: true }, { status: 401, headers: cors });

  let body: { outcome?: string; kind?: string; opportunity_count?: number; window_end_ts?: number | null; segment?: string; status?: string } = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  const goal = await upsertPartnerGoal(email, {
    outcome: (body.outcome ?? "").slice(0, 500),
    kind: (GOAL_KINDS as readonly string[]).includes(String(body.kind)) ? (body.kind as GoalKind) : "generate_opportunities",
    targets: { opportunity_count: Math.max(0, Math.round(Number(body.opportunity_count ?? 0))), window_end_ts: body.window_end_ts ? Number(body.window_end_ts) : null, segment: (body.segment ?? "").slice(0, 120) },
    status: body.status === "paused" || body.status === "achieved" || body.status === "cancelled" ? body.status : "active",
  });
  await recordPartnerAudit({ partner_email: email, action: "goal_set", actor: "partner", summary: `Goal set: ${goal.outcome.slice(0, 120)}`, rationale: "Partner set their commercial goal." });
  return Response.json({ ok: true, goal }, { headers: cors });
}
