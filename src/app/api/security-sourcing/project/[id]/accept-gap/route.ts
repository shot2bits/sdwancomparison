/**
 * Gap acceptance (Phase D1): the buyer individually accepts an open scoping
 * gap instead of answering it. Records a consent entry with the wording
 * shown verbatim (Article 13) plus a requirement.updated history event, all
 * through the single write gate. The publish guard reads the same
 * openSecurityGaps() helper, so acceptance here and the gate can never
 * disagree (Article 17).
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { recordProjectEvent, openSecurityGaps } from "@/lib/project-machine";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

function acceptGapConsentText(question: string): string {
  return `I accept proceeding without answering: "${question}" This gap stays recorded on the project and is shown to vendors and service providers as a stated assumption.`;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;

  let body: { manage_token?: string; gap_field?: string; consent?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404, headers: cors });

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Accepting a scoping gap", cors);

  if (body.consent !== true) {
    return Response.json({ error: "Consent is required: accepting a gap is recorded on the project." }, { status: 400, headers: cors });
  }
  const field = String(body.gap_field ?? "").trim();
  const open = openSecurityGaps(project);
  const gap = open.find((g) => g.field === field);
  if (!gap) {
    return Response.json(
      { error: field ? `No open gap named "${field}" on this project.` : "gap_field is required.", open_gaps: open.map((g) => g.field) },
      { status: 400, headers: cors },
    );
  }

  const now = Date.now();
  const actorRef = access.session?.email ?? "";
  let updated = {
    ...project,
    consents: [
      ...(project.consents ?? []),
      {
        at: now,
        action: `accept_gap:${gap.field}`,
        granted_by: actorRef || "anonymous",
        via: "web" as const,
        text: acceptGapConsentText(gap.question),
      },
    ],
  };
  try {
    updated = recordProjectEvent(updated, {
      at: now,
      actor: "buyer",
      actor_ref: actorRef,
      via: "web",
      event: "requirement.updated",
      detail: { gap_field: gap.field, accepted: true },
      consent: true,
    });
    updated = await saveProject(updated);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409, headers: cors });
  }

  return Response.json(
    { accepted: true, gap_field: gap.field, open_gaps: openSecurityGaps(updated).length },
    { headers: cors },
  );
}
