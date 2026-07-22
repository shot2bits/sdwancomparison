/**
 * Netify Security Sourcing: Project creation endpoint (Phase B step 2).
 * Used by the /security-sourcing page; the create_security_project MCP tool
 * calls the same createSecurityProject core directly, so page and agent
 * cannot diverge. Sends no emails; anonymous creation follows the existing
 * draft conventions and is claimable through the standard magic-link flow.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";
import { createSecurityProject } from "@/lib/security/persist-project";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { publicProject } from "@/lib/rfp-store";
import type { SecurityRequirementInput } from "@/lib/security/rulebook";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) {
    return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  }
  let body: { custom_title?: string; requirement?: SecurityRequirementInput; consent?: boolean; test?: boolean; preferred_vendors?: string[] } = {};
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
    created = await createSecurityProject({
      requirement: body.requirement,
      ...(typeof body.custom_title === "string" ? { customTitle: body.custom_title } : {}),
      ownerEmail,
      via: "web",
      test: body.test === true,
      ...(Array.isArray(body.preferred_vendors)
        ? { preferredVendors: body.preferred_vendors.filter((s): s is string => typeof s === "string") }
        : {}),
    });
  } catch (e) {
    // Core refusals (low confidence with the gap questions) return as a
    // clear 400, identical in substance to the tool's structured error.
    return Response.json({ error: (e as Error).message }, { status: 400, headers: cors });
  }
  const { project, verdict, builderPath } = created;

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
