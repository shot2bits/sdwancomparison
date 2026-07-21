/**
 * Live Sourcing Workspace: the extraction cycle endpoint (W0 slice 1).
 * POST free buyer text (plus the draft requirement so far) and receive the
 * validated field updates, provenance per field, and the merged requirement
 * in the exact shape assess_security_requirement takes. This is the same
 * cycle the page will call per pause and the MCP contract will expose:
 * one loop, every client (Mandate).
 *
 * Open by design (no identity: it reads and computes, writes nothing);
 * text capped, no secrets in, no secrets out.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { extractRequirement } from "@/lib/workspace/extract";
import { RULEBOOK_VERSION, type SecurityRequirementInput } from "@/lib/security/rulebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  let body: { text?: string; requirement?: SecurityRequirementInput } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }
  const text = String(body.text ?? "").slice(0, 4000);
  if (text.trim().length < 3) {
    return Response.json({ error: "Describe your requirement in a sentence or two." }, { status: 400, headers: cors });
  }
  const result = await extractRequirement(text, body.requirement ?? {});
  return Response.json({ ...result, rulebook_version: RULEBOOK_VERSION }, { headers: cors });
}
