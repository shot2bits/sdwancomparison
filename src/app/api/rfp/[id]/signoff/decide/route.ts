/**
 * Approval decisions (D5). The approval token is the ONLY credential:
 * purpose-scoped to read-and-decide. Approve records publish.approved
 * with the approver as actor plus a verbatim consent entry; decline
 * records approval.declined with the optional note in detail. One
 * decision per request; decisions are immutable (the record, not the
 * row, is the truth).
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, listSignoffs, saveSignoffs, kvConfigured } from "@/lib/rfp-store";
import { recordProjectEvent } from "@/lib/project-machine";
import { approveConsentText } from "@/lib/project-approvals";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;

  let body: { token?: string; decision?: string; note?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }
  const token = String(body.token ?? "");
  const decision = String(body.decision ?? "");
  const note = String(body.note ?? "").trim().slice(0, 600);
  if (!token) return Response.json({ error: "The approval link token is required." }, { status: 400, headers: cors });
  if (decision !== "approved" && decision !== "declined") {
    return Response.json({ error: "decision must be approved or declined." }, { status: 400, headers: cors });
  }

  const project = await getProject(id);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404, headers: cors });
  const signoffs = await listSignoffs(id);
  const idx = signoffs.findIndex((a) => a.token === token);
  if (idx === -1) return Response.json({ error: "This approval link is not recognised." }, { status: 401, headers: cors });
  if (signoffs[idx].decision) {
    return Response.json({ error: `Already decided: ${signoffs[idx].decision}. Decisions are recorded once.`, decided: signoffs[idx].decision }, { status: 409, headers: cors });
  }

  const now = Date.now();
  const a = signoffs[idx];
  const decided = { ...a, decided_at: now, decision: decision as "approved" | "declined", ...(note ? { note } : {}) };
  const nextSignoffs = [...signoffs];
  nextSignoffs[idx] = decided;

  let updated = project;
  try {
    if (decision === "approved") {
      updated = {
        ...updated,
        consents: [
          ...(updated.consents ?? []),
          { at: now, action: `approve_publish:${a.role}`, granted_by: a.email, via: "web" as const, text: approveConsentText(a.role, a.name) },
        ],
      };
      updated = recordProjectEvent(updated, {
        at: now,
        actor: "buyer", // the approver acts for the buying organisation
        actor_ref: a.email,
        via: "web",
        event: "publish.approved",
        detail: { role: a.role, name: a.name },
        consent: true,
      });
    } else {
      updated = recordProjectEvent(updated, {
        at: now,
        actor: "buyer",
        actor_ref: a.email,
        via: "web",
        event: "approval.declined",
        detail: { role: a.role, name: a.name, ...(note ? { note } : {}) },
      });
    }
    await saveSignoffs(id, nextSignoffs, { test: project.test === true });
    await saveProject(updated);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 409, headers: cors });
  }

  return Response.json({ decided: decision, role: a.role }, { headers: cors });
}
