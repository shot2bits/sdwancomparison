/**
 * Inline scope control (Robert's approved mockup, 21 July 2026): the buyer
 * keeps or excludes a CONDITIONAL capability directly on the requirement
 * page, without entering the RFP Builder. This is an ordinary document
 * edit through the single write gate: it toggles section inclusion only,
 * never touches verdicts, artefacts or the protected transparency items
 * (the engine attach guard is unaffected), and records an rfp.edited event
 * so the change appears in the activity and Timeline.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { recordProjectEvent } from "@/lib/project-machine";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;

  let body: { manage_token?: string; category?: string; included?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404, headers: cors });
  if (project.engine !== "security_sourcing") {
    return Response.json({ error: "Scope toggles apply to Security Sourcing projects; use the RFP Builder for this project." }, { status: 400, headers: cors });
  }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Changing this requirement's scope", cors);

  const category = String(body.category ?? "").trim();
  const included = body.included === true;
  const match = project.rfp_sections.filter((s) => s.category === category);
  if (match.length === 0) {
    return Response.json({ error: `No section named "${category}" on this requirement.` }, { status: 404, headers: cors });
  }

  let updated = {
    ...project,
    rfp_sections: project.rfp_sections.map((s) => (s.category === category ? { ...s, included } : s)),
    updated: Date.now(),
  };
  updated = recordProjectEvent(updated, {
    at: Date.now(),
    actor: "buyer",
    actor_ref: project.owner_email || "",
    via: "web",
    event: "rfp.edited",
    detail: { scope_toggle: category, included },
    consent: false,
  });

  try {
    await saveProject(updated);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not save the change." }, { status: 409, headers: cors });
  }
  return Response.json({ ok: true, category, included }, { headers: cors });
}
