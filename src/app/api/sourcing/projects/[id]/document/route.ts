import { getProject } from "@/lib/rfp-store";
import { requireRfpOwner } from "@/lib/rfp-access";
import {
  buildRfpMarkdown,
  buildRfpHtml,
  livingDocumentToRfpSections,
} from "@/lib/rfp-document";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  const { id } = await ctx.params;
  const p = await getProject(id);
  if (
    !p ||
    !p.entrance_context?.raw_input.sourcing_request_id ||
    !(await requireRfpOwner(req, p)).ok
  )
    return Response.json(
      { error: "Private project access required." },
      { status: 401, headers },
    );
  const draft = {
    ...p,
    title: p.title + " — private draft",
    rfp_sections: p.procurement_document
      ? livingDocumentToRfpSections(p.procurement_document)
      : p.rfp_sections,
  };
  const word = new URL(req.url).searchParams.get("format") === "doc";
  return new Response(word ? buildRfpHtml(draft) : buildRfpMarkdown(draft), {
    headers: {
      ...headers,
      "Content-Type": word
        ? "application/msword"
        : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="netify-${id}-draft.${word ? "doc" : "md"}"`,
    },
  });
}
