import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";
import { runAgentLoop } from "@/lib/agent-run";
import { forceClearLock, listRuns, backdateApproval } from "@/lib/agent-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // generous ceiling; the loop self-limits to ~50s

function cronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function adminAuthorised(req: Request): Promise<boolean> {
  const session = await sessionFromRequest(req);
  return Boolean(session?.email && isAdminEmail(session.email));
}

/**
 * Scheduled run (Vercel Cron triggers via GET). Secured by CRON_SECRET only.
 */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  if (!cronAuthorised(req)) {
    return Response.json({ error: process.env.CRON_SECRET ? "Unauthorised." : "CRON_SECRET not configured." }, { status: 401, headers: cors });
  }
  const report = await runAgentLoop("cron");
  return Response.json({ ok: true, run: report }, { headers: cors });
}

/**
 * Manual run or admin maintenance. Allowed for a cron secret (trigger=manual) or
 * a Netify admin session. Body: { action?: "run" | "clear_lock", key?: string }.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const ok = cronAuthorised(req) || (await adminAuthorised(req));
  if (!ok) return Response.json({ error: "Unauthorised. Netify admin or cron secret required." }, { status: 401, headers: cors });

  let body: { action?: string; key?: string; rfp_id?: string; approval_id?: string; days?: number } = {};
  try { body = await req.json(); } catch { /* optional */ }

  if (body.action === "clear_lock") {
    await forceClearLock(body.key || "agent:run:lock");
    return Response.json({ ok: true, cleared: body.key || "agent:run:lock" }, { headers: cors });
  }
  if (body.action === "runs") {
    return Response.json({ ok: true, runs: await listRuns(20) }, { headers: cors });
  }
  // Admin test hook: age a pending approval so the stale-approval check (5 days)
  // can be proven live without waiting. Admin only (gated above).
  if (body.action === "age_approval") {
    if (!body.rfp_id || !body.approval_id) return Response.json({ error: "rfp_id and approval_id required." }, { status: 422, headers: cors });
    const days = typeof body.days === "number" ? body.days : 6;
    const aged = await backdateApproval(body.rfp_id, body.approval_id, days * 24 * 60 * 60 * 1000);
    return Response.json({ ok: Boolean(aged), aged }, { headers: cors });
  }

  const report = await runAgentLoop("manual");
  return Response.json({ ok: true, run: report }, { headers: cors });
}

export async function OPTIONS(req: Request) { return preflight(req); }
