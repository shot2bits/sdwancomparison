import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { executePublish } from "@/lib/rfp-publish";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Publish an RFP: invite the best-fit graded vendors, move the RFP to
 * published, list it on the public opportunity board and notify the Netify
 * team and the buyer. Requires the RFP owner (manage_token or the owning
 * account) AND a verified buyer/netify session: publishing reaches named
 * suppliers, so possession of the draft alone is no longer enough.
 * The publish mechanics live in lib/rfp-publish.ts, shared with the auth
 * verify endpoint's pending_submit path.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { manage_token?: string; shortlist_size?: number; list_on_board?: boolean; marketing_opt_in?: boolean } = {};
  try { body = await req.json(); } catch { /* body optional */ }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Publishing this RFP", cors);

  // Hard identity gate: signed-out owners and agents get a machine-readable
  // handoff instead of a silent token-only publish. Drafting stays open; the
  // manage_token remains the ownership proof, the session is the identity.
  const sessionEmail = access.session && (access.session.role === "buyer" || access.session.role === "netify") ? access.session.email : "";
  if (!sessionEmail) {
    return Response.json(
      {
        error: "sign_in_required",
        auth_required: true,
        message: "Publishing sends this RFP to suppliers, so it needs a verified work email. Open the builder, sign in and publish again; your draft is untouched.",
        sign_in_url: `${SITE_URL}/rfp-builder/${project.id}/`,
      },
      { status: 401, headers: cors },
    );
  }

  const { published, invited, criteria, board } = await executePublish(project, sessionEmail, {
    shortlist_size: body.shortlist_size,
    list_on_board: body.list_on_board,
    marketing_opt_in: body.marketing_opt_in,
  });

  return Response.json({ ok: true, status: published.status, invited, criteria, board }, { headers: cors });
}
