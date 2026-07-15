import { corsHeaders, preflight } from "@/lib/cors";
import { saveProject, newId, kvConfigured, KvNotConfiguredError } from "@/lib/rfp-store";
import { BuyerContextSchema, ProjectDetailsSchema } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";
import { sessionFromRequest } from "@/lib/auth";
import { indexRfpForBuyer } from "@/lib/rfp-store";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Create a new RFP from optional buyer context. */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) {
    return Response.json({ error: new KvNotConfiguredError().message }, { status: 503, headers: cors });
  }
  let body: {
    title?: string;
    buyer?: unknown;
    consent?: { version?: unknown; agreed_at?: unknown; flow?: unknown };
    pending_submit?: { shortlist_size?: unknown; list_on_board?: unknown; marketing_opt_in?: unknown };
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine: starts a blank draft
  }
  const buyer = BuyerContextSchema.parse(body.buyer ?? {});
  // Consent record from the wizard's agreement step: stored verbatim-shaped
  // (version, timestamp, flow) so there is always an answer to "what did
  // this buyer agree to and when". Only accepted in the expected shape.
  const consent =
    body.consent && typeof body.consent.version === "string" && typeof body.consent.agreed_at === "number" && typeof body.consent.flow === "string"
      ? { version: body.consent.version, agreed_at: body.consent.agreed_at, flow: body.consent.flow }
      : undefined;
  // Submit intent from the wizard's agreement step, stored on the draft so
  // the magic-link verify can complete the submission on any device. Only
  // accepted alongside a consent record: the intent is meaningless without
  // the agreement that authorised it.
  const pendingSubmit =
    consent && body.pending_submit && typeof body.pending_submit === "object"
      ? {
          shortlist_size: typeof body.pending_submit.shortlist_size === "number" ? body.pending_submit.shortlist_size : undefined,
          list_on_board: typeof body.pending_submit.list_on_board === "boolean" ? body.pending_submit.list_on_board : undefined,
          marketing_opt_in: typeof body.pending_submit.marketing_opt_in === "boolean" ? body.pending_submit.marketing_opt_in : undefined,
          requested_at: Date.now(),
        }
      : undefined;
  const id = newId("rfp");
  const session = await sessionFromRequest(req);
  const ownerEmail = session && (session.role === "buyer" || session.role === "netify") ? session.email : "";
  const project = ProjectDetailsSchema.parse({
    id,
    created: Date.now(),
    updated: Date.now(),
    status: "draft",
    title: body.title || "Untitled SASE / SD-WAN RFP",
    buyer,
    rfp_sections: synthesiseSections(buyer),
    invited_vendors: [],
    share_token: newId("tok"),
    manage_token: newId("mtok"),
    owner_email: ownerEmail,
    methodology_version: "2026.1",
    consent,
    pending_submit: pendingSubmit,
  });
  const saved = await saveProject(project);
  if (ownerEmail) {
    try { await indexRfpForBuyer(ownerEmail, saved.id); } catch { /* best effort */ }
  }
  return Response.json(saved, { headers: cors });
}
