/**
 * Story export (Phase D3): the audit artefact a buyer can hand to a
 * board. Markdown built by the same pure builder the story page renders
 * from, so the export and the screen can never disagree. Owner-gated
 * exactly like the document download.
 */

import { getProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner } from "@/lib/rfp-access";
import { buildStoryMarkdown } from "@/lib/project-story";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!kvConfigured()) return new Response("Storage not configured.", { status: 503 });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return new Response("Not found.", { status: 404 });

  const access = await requireRfpOwner(req, project);
  if (!access.ok) {
    return new Response("The project story belongs to its buyer. Open it from the project home (which carries your key) or sign in with the owning account.", { status: 401 });
  }

  const md = buildStoryMarkdown(project);
  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="netify-project-story-${id}.md"`,
      "cache-control": "no-store",
    },
  });
}
