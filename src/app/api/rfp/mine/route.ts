import { corsHeaders, preflight } from "@/lib/cors";
import { sessionFromRequest } from "@/lib/auth";
import { listBuyerRfpIds, getProjectsBulk, saveProject, listResponses, listSignoffs, kvConfigured } from "@/lib/rfp-store";
import { projectPhase } from "@/lib/project-machine";
import { projectHealth } from "@/lib/project-health";
import { signoffHealthContext } from "@/lib/project-approvals";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * A signed-in buyer's saved RFPs. Requires a buyer session.
 *
 * Performance (Harry's retest finding, 29 Jul 2026: the account page was
 * noticeably slow on Your Procurements): the old loop fetched every project
 * serially and then made its per-row reads serially too, so an account with
 * N projects paid two to three N storage round trips one after another.
 * Projects now load in one bulk read and the per-row reads (response counts
 * for post-publication rows, approvals for drafted rows, the legacy owner
 * backfill write) run concurrently. Same fields, same one-truth phase and
 * health functions, a fraction of the wall clock.
 */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session || (session.role !== "buyer" && session.role !== "netify")) {
    return Response.json({ error: "Sign in to see your saved RFPs.", auth_required: true }, { status: 401, headers: cors });
  }
  const ids = await listBuyerRfpIds(session.email);
  const projects = (await getProjectsBulk(ids)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const rfps = await Promise.all(projects.map(async (p) => {
    // Backfill: RFPs indexed to this account before owner_email existed adopt
    // it now, so the account keeps working as the owner credential everywhere.
    // Fire-and-forget: the write must never hold the page.
    if (!p.owner_email && session.role === "buyer") {
      saveProject({ ...p, owner_email: session.email }).catch(() => { /* best effort */ });
    }
    // Phase and health per row, computed server-side with the same functions
    // the Project Home and the publish gate use (one truth). Response counts
    // are read only for post-publication rows and only the COUNT is
    // returned, never response bodies; approvals matter pre-publication only.
    const phase = projectPhase(p);
    const [responseCount, approvals] = await Promise.all([
      ["published", "qa", "evaluation", "awarded", "transacting", "complete"].includes(phase)
        ? listResponses(p.id).then((r) => r.length).catch(() => 0)
        : Promise.resolve(0),
      phase === "drafted"
        ? listSignoffs(p.id).then((s) => signoffHealthContext(s)).catch(() => [] as Array<{ decision?: "approved" | "declined" }>)
        : Promise.resolve([] as Array<{ decision?: "approved" | "declined" }>),
    ]);
    const health = projectHealth(p, { responseCount, approvals });
    return { id: p.id, title: p.title, status: p.status, updated: p.updated, phase, responses: responseCount, health };
  }));

  return Response.json({ rfps: rfps.sort((a, b) => b.updated - a.updated) }, { headers: cors });
}
