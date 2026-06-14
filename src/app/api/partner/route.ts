import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { partnerEmail } from "@/lib/partner-auth";
import {
  getOrInitPartnerMemory, getPartnerGoal, listArtefacts, listTasks,
  listPartnerApprovals, listPartnerDigests, listPartnerAudit,
} from "@/lib/partner-store";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** Workspace snapshot for the signed-in partner. One call powers the UI. */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const email = await partnerEmail(req);
  if (!email) return Response.json({ error: "Sign in with your work email to open the partner workspace.", auth_required: true }, { status: 401, headers: cors });

  const [memory, goal, artefacts, tasks, approvals, digests, audit] = await Promise.all([
    getOrInitPartnerMemory(email), getPartnerGoal(email), listArtefacts(email), listTasks(email),
    listPartnerApprovals(email), listPartnerDigests(email), listPartnerAudit(email),
  ]);
  return Response.json({ email, memory, goal, artefacts, tasks, approvals, digests: digests.slice(0, 10), audit: audit.slice(0, 100) }, { headers: cors });
}
