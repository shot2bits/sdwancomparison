import { getProject, kvConfigured } from "@/lib/rfp-store";
import { buildRfpMarkdown } from "@/lib/rfp-document";
import { sessionFromRequest } from "@/lib/auth";
import { requireRfpOwner } from "@/lib/rfp-access";

export const runtime = "nodejs";

/**
 * Gated RFP download. Two conditions, both required:
 *  1. a signed-in session (the "create an account to download" product gate);
 *  2. RFP ownership (manage_token via ?manage=, or the owning account) — a
 *     session alone must not let a stranger download someone else's RFP by id.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503 });
  const session = await sessionFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "Create an account to download the final RFP, save versions and invite suppliers. You can keep editing the preview before signing in.", auth_required: true },
      { status: 401 },
    );
  }
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404 });

  const access = await requireRfpOwner(req, project);
  if (!access.ok) {
    return Response.json(
      { error: "Only this RFP's owner can download the document. Open the preview from your builder (which carries your key), or sign in with the email that created the RFP.", owner_only: true },
      { status: 403 },
    );
  }

  const markdown = buildRfpMarkdown(project);
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="netify-rfp-${id}.md"`,
      "cache-control": "no-store",
    },
  });
}
