import { getProject, kvConfigured } from "@/lib/rfp-store";
import { buildRfpMarkdown } from "@/lib/rfp-document";
import { sessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Gated RFP download. The preview is open (same exposure as the id-scoped
 * API read), but the final document download requires a signed-in session —
 * this is the "create an account to download, save versions and invite
 * suppliers" gate from the product spec. Draft stays fully editable before
 * signing in; nothing is lost at the gate.
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

  const markdown = buildRfpMarkdown(project);
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="netify-rfp-${id}.md"`,
      "cache-control": "no-store",
    },
  });
}
