import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, getOpportunity, kvGetJson, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { listRfpOnBoard } from "@/lib/rfp-publish";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * The standing board-listing action (Robert's gate ruling, 23 Jul 2026:
 * 41 published RFPs, 9 ever supplier-visible — a published-but-unlisted
 * RFP could only reach the board by re-running the whole publish, invites
 * and emails included). This route lists WITHOUT re-inviting.
 *
 *   GET  → the owner's listing state ({listed, url}), so the builder can
 *          show the true board state on load, not only after a publish.
 *   POST → create or refresh the anonymised board notice for an already
 *          published RFP. Same identity bar as publish itself: manage_token
 *          proves ownership, a verified session proves identity, because
 *          listing reaches the supplier community.
 */

async function boardState(rfpId: string): Promise<{ listed: boolean; opportunity_id?: string; url?: string; notice_status?: string }> {
  const oppId = await kvGetJson<string>(`rfp:${rfpId}:board_opp`);
  if (!oppId) return { listed: false };
  const opp = await getOpportunity(oppId);
  if (!opp) return { listed: false };
  return { listed: true, opportunity_id: opp.id, url: `${SITE_URL}/opportunities/${opp.id}/`, notice_status: opp.status };
}

export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project);
  if (!access.ok) return ownerRequired("Reading this RFP's board listing", cors);
  return Response.json({ ok: true, status: project.status, board: await boardState(project.id) }, { headers: cors });
}

export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { manage_token?: string } = {};
  try { body = await req.json(); } catch { /* body optional */ }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Listing this RFP on the board", cors);

  // Identity gate, exactly as publish: the board reaches suppliers.
  const sessionEmail = access.session && (access.session.role === "buyer" || access.session.role === "netify") ? access.session.email : "";
  if (!sessionEmail) {
    return Response.json(
      {
        error: "sign_in_required",
        auth_required: true,
        message: "Listing on the board makes this RFP visible to verified vendors and service providers, so it needs a verified work email. Sign in and try again; nothing has been listed.",
        sign_in_url: `${SITE_URL}/rfp-builder/${project.id}/`,
      },
      { status: 401, headers: cors },
    );
  }

  if (project.status !== "published") {
    return Response.json(
      { error: "Only a published RFP can be listed on the board. Publish first; listing is part of the publish step." },
      { status: 409, headers: cors },
    );
  }

  try {
    const listed = await listRfpOnBoard(project, project.owner_email || sessionEmail);
    return Response.json({ ok: true, board: { listed: true, ...listed } }, { headers: cors });
  } catch (e) {
    return Response.json({ error: (e as Error).message || "Board listing failed; try again." }, { status: 500, headers: cors });
  }
}
