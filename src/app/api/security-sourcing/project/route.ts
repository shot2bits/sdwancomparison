/**
 * Netify Security Sourcing: Project creation endpoint (Phase B step 2).
 * Used by the /security-sourcing page; the create_security_project MCP tool
 * calls the same createSecurityProject core directly, so page and agent
 * cannot diverge. Sends no emails; anonymous creation follows the existing
 * draft conventions and is claimable through the standard magic-link flow.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured, saveProject } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";
import { createSecurityProject } from "@/lib/security/persist-project";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { publicProject } from "@/lib/rfp-store";
import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import { parseIncomingSourceTurns } from "@/lib/workspace/source-ledger";
import { parseIncomingDecisionTurns } from "@/lib/workspace/decision-ledger";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) {
    return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  }
  let body: {
    custom_title?: string;
    requirement?: SecurityRequirementInput;
    consent?: boolean;
    publish_intent?: boolean;
    test?: boolean;
    preferred_vendors?: string[];
    /** Reliability gate, fourth amendment (13 Aug 2026): the buyer's own
     *  verbatim source turns as structured ledger entries (see
     *  workspace/source-ledger.ts), parsed defensively below — a malformed
     *  or missing field is simply an empty ledger for this create, never a
     *  400 for the whole request. */
    source_turns?: unknown;
    /** Defects 3/4 (correction pass, 15 Aug 2026): the buyer's structured
     *  NextQuestion actions, parsed defensively below like source_turns --
     *  a malformed/missing field is simply an empty ledger for this
     *  create. */
    decision_turns?: unknown;
    /** Full-unification CLOSURE pass (17 Aug 2026): the canonical
     *  envelope's own fields -- see envelope.ts's `buildEnvelopeUpdate`.
     *  Absent `facts` (every caller that hasn't adopted this yet) means
     *  this create is completely unaffected, exactly as before this pass. */
    facts?: unknown;
    receipts?: unknown;
    instrument?: unknown;
    compiled_document?: unknown;
    base_revision?: unknown;
    position?: { covered_sections?: unknown; sector?: unknown };
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }
  if (!body.requirement || typeof body.requirement !== "object") {
    return Response.json({ error: "requirement is required." }, { status: 400, headers: cors });
  }
  if (body.consent !== true) {
    return Response.json(
      { error: "Consent is required to create a project.", consent_text: CREATE_CONSENT_TEXT },
      { status: 400, headers: cors },
    );
  }

  const session = await sessionFromRequest(req);
  const ownerEmail = session && (session.role === "buyer" || session.role === "netify") ? session.email : "";

  let created;
  try {
    created = await createSecurityProject(
      {
        requirement: body.requirement,
        ...(typeof body.custom_title === "string" ? { customTitle: body.custom_title } : {}),
        ownerEmail,
        via: "web",
        test: body.test === true,
        ...(Array.isArray(body.preferred_vendors)
          ? { preferredVendors: body.preferred_vendors.filter((s): s is string => typeof s === "string") }
          : {}),
        sourceTurns: parseIncomingSourceTurns(body.source_turns),
        decisionTurns: parseIncomingDecisionTurns(body.decision_turns),
      },
      // Full-unification CLOSURE pass (17 Aug 2026): the raw envelope
      // fields, verified inside createSecurityProject() itself (see that
      // function's own comment) -- absent `facts` leaves this create
      // exactly as it was before this pass.
      { facts: body.facts, receipts: body.receipts, instrument: body.instrument, compiled_document: body.compiled_document, base_revision: body.base_revision },
      Array.isArray(body.position?.covered_sections) ? body.position.covered_sections.map(String) : [],
    );
  } catch (e) {
    // Core refusals (low confidence with the gap questions) return as a
    // clear 400, identical in substance to the tool's structured error.
    return Response.json({ error: (e as Error).message }, { status: 400, headers: cors });
  }
  if ("rejected" in created) {
    return Response.json({ error: created.rejected.error }, { status: created.rejected.status, headers: cors });
  }
  let { project } = created;
  const { verdict, builderPath } = created;
  if (body.publish_intent === true && !project.test) {
    project = await saveProject({
      ...project,
      pending_submit: { shortlist_size: 5, list_on_board: true, marketing_opt_in: false, requested_at: Date.now() },
    }, { engineWrite: true });
  }

  // manage_token is returned at creation only (existing convention): the
  // creator holds the push credential; public reads never see it.
  return Response.json(
    {
      project: { ...publicProject(project), manage_token: project.manage_token },
      verdict,
      builder_path: builderPath,
    },
    { headers: cors },
  );
}
