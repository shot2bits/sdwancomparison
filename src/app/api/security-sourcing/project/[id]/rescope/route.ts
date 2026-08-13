/**
 * Re-scope endpoint (Phase D4). The page and the rescope_security_project
 * MCP tool call the same pure core, so web and agent re-scopes cannot
 * diverge (Article 17). Consent is required and recorded verbatim with
 * the version-consequence sentence inside it (Article 13).
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { openSecurityGaps } from "@/lib/project-machine";
import { buildRescopedProject, rescopeConsentText, documentEdited } from "@/lib/security/rescope-project";
import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import { parseIncomingSourceTurns } from "@/lib/workspace/source-ledger";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;

  let body: {
    requirement?: SecurityRequirementInput;
    manage_token?: string;
    consent?: boolean;
    replace_edits_consent?: boolean;
    /** Fourth amendment (13 Aug 2026), gap 2 fix: this route is the ONLY
     *  save path a Security Sourcing project takes after its first save
     *  (subsequent Save and the pre-publish refresh both land here), so
     *  this is the field that makes wording typed after the first save
     *  actually persist. */
    source_turns?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404, headers: cors });

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Re-scoping this project", cors);

  if (!body.requirement || typeof body.requirement !== "object") {
    return Response.json({ error: "requirement is required." }, { status: 400, headers: cors });
  }
  if (body.consent !== true) {
    return Response.json(
      { error: "Consent is required to re-scope.", consent_text: rescopeConsentText(project) },
      { status: 400, headers: cors },
    );
  }

  let result;
  try {
    result = await buildRescopedProject({
      project,
      requirement: body.requirement,
      via: "web",
      actorRef: access.session?.email ?? "",
      replaceEdits: body.replace_edits_consent === true,
      sourceTurns: parseIncomingSourceTurns(body.source_turns),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400, headers: cors });
  }

  let saved;
  try {
    saved = await saveProject(result.project, { engineWrite: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409, headers: cors });
  }

  const verdicts = saved.engine_data?.verdicts ?? [];
  const artefacts = saved.engine_data?.artefacts ?? [];
  return Response.json(
    {
      rescoped: true,
      verdict_version: verdicts[verdicts.length - 1]?.version,
      artefact_version: artefacts[artefacts.length - 1]?.version,
      replaced_edits: documentEdited(project),
      open_gaps: openSecurityGaps(saved).length,
      verdict: result.verdict,
      project_path: `/project/${saved.id}`,
    },
    { headers: cors },
  );
}
