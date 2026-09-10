/**
 * Approval requests (D5): the buyer asks a colleague to approve before
 * publishing. Owner-gated. Typing the approver's email and confirming is
 * the explicit consent to send ONE email (Article 13); the request is
 * recorded as an approval.requested event plus a verbatim consent entry
 * BEFORE the send (Article 9: the record precedes the side effect).
 * Test-mode projects send no email and their signoffs expire with them.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, listSignoffs, saveSignoffs, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { recordProjectEvent } from "@/lib/project-machine";
import { requestApprovalConsentText } from "@/lib/project-approvals";
import { SITE_URL } from "@/lib/structured-data";
import type { ProjectSignoff } from "@/lib/rfp-types";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

function newToken(): string {
  const bytes = new Uint8Array(new ArrayBuffer(18));
  crypto.getRandomValues(bytes);
  return "aptok_" + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

/** Owner view of approval state: tokens are the approver's credential and
 *  are never returned here. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project);
  if (!access.ok) return ownerRequired("Reading approval requests", cors);
  const signoffs = await listSignoffs(id);
  return Response.json(
    { approvals: signoffs.map(({ token: _token, ...rest }) => {
      void _token;
      return rest;
    }) },
    { headers: cors },
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;

  let body: { manage_token?: string; name?: string; role?: string; email?: string; consent?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Requesting an approval", cors);

  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!name || !role) return Response.json({ error: "The approver's name and role are required." }, { status: 400, headers: cors });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "A valid approver email is required." }, { status: 400, headers: cors });
  if (body.consent !== true) {
    return Response.json(
      { error: "Consent is required: requesting approval sends one email and records the request.", consent_text: requestApprovalConsentText(role, email) },
      { status: 400, headers: cors },
    );
  }

  const now = Date.now();
  const signoff: ProjectSignoff = { token: newToken(), name, role, email, requested_at: now };
  const signoffs = [...(await listSignoffs(id)), signoff];

  let updated = {
    ...project,
    consents: [
      ...(project.consents ?? []),
      { at: now, action: `request_approval:${role}`, granted_by: access.session?.email || "anonymous", via: "web" as const, text: requestApprovalConsentText(role, email) },
    ],
  };
  try {
    updated = recordProjectEvent(updated, {
      at: now,
      actor: "buyer",
      actor_ref: access.session?.email ?? "",
      via: "web",
      event: "approval.requested",
      detail: { role, name },
      consent: true,
    });
    await saveSignoffs(id, signoffs, { test: project.test === true });
    await saveProject(updated);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409, headers: cors });
  }

  // One email, consented above. Test mode sends nothing (review target 4).
  let emailed = false;
  if (project.test !== true) {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
      const link = `${SITE_URL}/project/${id}/approve?token=${encodeURIComponent(signoff.token)}`;
      const safeTitle = (project.title || "Untitled project").replace(/</g, "&lt;");
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({
            from,
            to: email,
            subject: `Approval requested: ${project.title || "a Netify RFP"}`,
            html: `<p>${name.replace(/</g, "&lt;")},</p><p>You have been asked, as ${role.replace(/</g, "&lt;")}, to review an RFP before it is published to the Netify marketplace: <strong>${safeTitle}</strong>.</p><p>The link below is private to you. It shows the full document, read only, with an approve or decline action. Your decision is recorded on the project.</p><p><a href="${link}">Review and decide</a></p><p>Netify</p>`,
          }),
        });
        emailed = true;
      } catch { /* the record above already tells the truth */ }
    }
  }

  return Response.json({ requested: true, emailed, role, name }, { headers: cors });
}
