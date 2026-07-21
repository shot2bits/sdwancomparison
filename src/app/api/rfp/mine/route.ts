import { corsHeaders, preflight } from "@/lib/cors";
import { sessionFromRequest } from "@/lib/auth";
import { listBuyerRfpIds, getProject, saveProject, listResponses, listSignoffs, kvConfigured } from "@/lib/rfp-store";
import { projectPhase } from "@/lib/project-machine";
import { projectHealth } from "@/lib/project-health";
import { signoffHealthContext } from "@/lib/project-approvals";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** A signed-in buyer's saved RFPs. Requires a buyer session. */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session || (session.role !== "buyer" && session.role !== "netify")) {
    return Response.json({ error: "Sign in to see your saved RFPs.", auth_required: true }, { status: 401, headers: cors });
  }
  const ids = await listBuyerRfpIds(session.email);
  const rfps = [];
  for (const id of ids) {
    const p = await getProject(id);
    if (!p) continue;
    // Backfill: RFPs indexed to this account before owner_email existed adopt
    // it now, so the account keeps working as the owner credential everywhere.
    if (!p.owner_email && session.role === "buyer") {
      try { await saveProject({ ...p, owner_email: session.email }); } catch { /* best effort */ }
    }
    // Phase D2: phase and health per row, computed server-side with the
    // same functions the Project Home and the publish gate use (one truth).
    // Response counts are read only for post-publication rows (bounded set)
    // and only the COUNT is returned, never response bodies.
    const phase = projectPhase(p);
    let responseCount = 0;
    if (["published", "qa", "evaluation", "awarded", "transacting", "complete"].includes(phase)) {
      try { responseCount = (await listResponses(p.id)).length; } catch { /* count stays 0 */ }
    }
    // Approval state matters pre-publication only (bounded reads), and the
    // list must agree with the Project Home (one truth for health).
    let approvals: Array<{ decision?: "approved" | "declined" }> = [];
    if (phase === "drafted") {
      try { approvals = signoffHealthContext(await listSignoffs(p.id)); } catch { /* absent */ }
    }
    const health = projectHealth(p, { responseCount, approvals });
    rfps.push({ id: p.id, title: p.title, status: p.status, updated: p.updated, phase, responses: responseCount, health });
  }
  return Response.json({ rfps: rfps.sort((a, b) => b.updated - a.updated) }, { headers: cors });
}
