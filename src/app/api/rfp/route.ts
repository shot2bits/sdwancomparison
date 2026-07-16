import { corsHeaders, preflight } from "@/lib/cors";
import { saveProject, newId, kvConfigured, KvNotConfiguredError, kvSetJson } from "@/lib/rfp-store";
import { BuyerContextSchema, ProjectDetailsSchema } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";
import { sessionFromRequest } from "@/lib/auth";
import { indexRfpForBuyer } from "@/lib/rfp-store";
import { isBlockedDomainLive, emailDomain } from "@/lib/access-control";
import { SITE_URL } from "@/lib/structured-data";

/**
 * Early-capture contact email (the wizard's optional "get a link to this RFP
 * by email" field, 16 July 2026). Best effort and never blocks creation:
 * stores the address against the draft (rfp:{id}:contact_email, the same key
 * the builder's email-link endpoint uses), records the capture on the
 * existing draft-link leads list, and sends the private manage link
 * immediately so the address receives value the moment it is given. The
 * business-only email policy applies; webmail addresses are simply ignored.
 */
async function attachContactEmail(p: { id: string; title: string; manage_token: string }, raw: string) {
  const email = raw.trim().toLowerCase();
  const domain = emailDomain(email);
  if (!domain || (await isBlockedDomainLive(domain))) return;
  try { await kvSetJson(`rfp:${p.id}:contact_email`, email); } catch { /* best effort */ }
  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) {
      await fetch(`${url}/lpush/rfp_draftlink_leads`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify([JSON.stringify({ rfp_id: p.id, email, created: Date.now(), source: "wizard" })]),
      });
    }
  } catch { /* best effort */ }
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const link = `${SITE_URL}/rfp-builder/${p.id}/?manage=${p.manage_token}`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        reply_to: "support@netify.com",
        subject: "Your Netify RFP draft link",
        html: `<p>Here is the link back to your RFP draft "${p.title}".</p><p><a href="${link}">Reopen your draft</a> on any device. The link carries your private manage key, so keep it to yourself.</p><p>When you are ready, submit the RFP and your matched suppliers respond through the app. Pricing stays private to you.</p><p>If you did not request this, ignore this email.</p>`,
      }),
    });
  } catch { /* best effort */ }
}

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
    contact_email?: unknown;
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
  // Optional early-capture email from the wizard: never blocks creation.
  if (typeof body.contact_email === "string" && body.contact_email.includes("@")) {
    try { await attachContactEmail({ id: saved.id, title: saved.title, manage_token: saved.manage_token }, body.contact_email); } catch { /* best effort */ }
  }
  return Response.json(saved, { headers: cors });
}
