import { getProject, kvConfigured } from "@/lib/rfp-store";
import { buildRfpMarkdown, buildRfpHtml, type PublishedDocMeta } from "@/lib/rfp-document";
import { sessionFromRequest } from "@/lib/auth";
import { requireRfpOwner } from "@/lib/rfp-access";
import { getLatestPublishedSnapshot } from "@/lib/published-snapshot";
import type { ProjectDetails } from "@/lib/rfp-types";

export const runtime = "nodejs";

/**
 * Gated RFP download. Three conditions, all required:
 *  1. a signed-in session (the "create an account to download" product gate);
 *  2. RFP ownership (manage_token via ?manage=, or the owning account) — a
 *     session alone must not let a stranger download someone else's RFP by id;
 *  3. Living Procurement Canvas Phase 2 (14 Aug 2026), Robert's product
 *     rule: this project must be PUBLISHED, with an identifiable published
 *     snapshot -- Word/PDF export is one of the artefacts publication
 *     unlocks, not something a draft owner can reach by calling this route
 *     directly, bypassing whatever the UI happens to show or hide. The
 *     document rendered is the FROZEN snapshot's own content, never the
 *     live project -- so a later, unpublished edit can never silently
 *     change what a previously-issued download link produces; a buyer who
 *     wants the export to reflect a later edit must explicitly republish.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503 });
  const session = await sessionFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "Create an account to download the final RFP, save versions and invite vendors. You can keep editing the preview before signing in.", auth_required: true },
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

  if (project.status !== "published") {
    return Response.json(
      {
        error: "This document unlocks once you publish. Publishing matches this project against Netify's evaluated vendors and service providers, invites the strongest fits, and unlocks the Word and PDF documents together. Publishing is free.",
        publish_required: true,
      },
      { status: 403 },
    );
  }
  const snapshot = await getLatestPublishedSnapshot(id);
  if (!snapshot) {
    return Response.json(
      { error: "No published snapshot was found for this project. Publish again to create one." },
      { status: 409 },
    );
  }

  // Render EXACTLY what was published, never whatever the live project
  // currently contains (see this route's own doc comment).
  const frozenProject: ProjectDetails = {
    ...project,
    title: snapshot.frozen_content.title,
    buyer: snapshot.frozen_content.buyer,
    rfp_sections: snapshot.frozen_content.rfp_sections,
  };
  const publishedMeta: PublishedDocMeta = {
    version: snapshot.document_version,
    publishedAt: snapshot.published_at,
    methodologyVersion: snapshot.methodology_version,
    contentHash: snapshot.content_hash,
    assumptions: snapshot.accepted_assumptions,
    openDecisions: snapshot.open_decisions,
  };

  // Format selection (18 July 2026, publish-value work): the publish reward
  // is a document the buyer can circulate internally, so Word ships alongside
  // markdown. ?format=doc serves styled HTML as application/msword — Word
  // opens it natively, no new dependencies. ?format=print serves the same
  // document inline with an auto print dialogue (the browser-native save as
  // PDF path). Default stays markdown for existing links and agents.
  const format = new URL(req.url).searchParams.get("format");
  if (format === "doc") {
    return new Response(buildRfpHtml(frozenProject, { publishedMeta }), {
      headers: {
        "content-type": "application/msword",
        "content-disposition": `attachment; filename="netify-rfp-${id}.doc"`,
        "cache-control": "no-store",
      },
    });
  }
  if (format === "print") {
    return new Response(buildRfpHtml(frozenProject, { autoPrint: true, publishedMeta }), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (format === "json") {
    // Structured-data export (Phase 2, new this round): the same frozen
    // content and publication record every other export carries, machine-
    // readable. Gated identically to every other export above.
    return Response.json(
      {
        project_id: snapshot.project_id,
        title: snapshot.frozen_content.title,
        published_version: snapshot.document_version,
        published_at: snapshot.published_at,
        methodology_version: snapshot.methodology_version,
        rulebook_version: snapshot.rulebook_version,
        content_hash: snapshot.content_hash,
        buyer: snapshot.frozen_content.buyer,
        rfp_sections: snapshot.frozen_content.rfp_sections,
        accepted_assumptions: snapshot.accepted_assumptions,
        open_decisions: snapshot.open_decisions,
      },
      { headers: { "content-disposition": `attachment; filename="netify-rfp-${id}.json"`, "cache-control": "no-store" } },
    );
  }
  const markdown = buildRfpMarkdown(frozenProject, { publishedMeta });
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="netify-rfp-${id}.md"`,
      "cache-control": "no-store",
    },
  });
}
