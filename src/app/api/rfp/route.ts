import { corsHeaders, preflight } from "@/lib/cors";
import { saveProject, newId, kvConfigured, KvNotConfiguredError, kvSetJson } from "@/lib/rfp-store";
import { getAllVendorSlugs } from "@/lib/vendors";
import { BuyerContextSchema, ProjectDetailsSchema } from "@/lib/rfp-types";
import { recordProjectEvent } from "@/lib/project-machine";
import { synthesiseSections } from "@/lib/rfp-methodology";
import { deriveRfiQuestionSet, bankRfpSections } from "@/lib/workspace/instrument";
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
 *
 * sendEmail is false on the wizard-submit path (Robert's concern, 16 July):
 * the "Confirm and submit" magic link must be the only email in the inbox at
 * that moment, so the courtesy draft link is stored but not sent. It goes
 * out only on the review-first path, where the buyer has already generated
 * and the risk is losing them entirely, not distracting them.
 */
async function attachContactEmail(p: { id: string; title: string; manage_token: string }, raw: string, sendEmail: boolean) {
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
  if (!key || !sendEmail) return;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const link = `${SITE_URL}/rfp-builder/${p.id}/?manage=${p.manage_token}#publish`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        reply_to: "support@netify.com",
        subject: "Your Netify RFP is ready",
        html: `<p>Your RFP "${p.title}" is generated and ready to review. The link below works on any device and carries your private manage key, so keep it to yourself.</p><p><a href="${link}" style="display:inline-block;background:#f59e0b;color:#111;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;">Review and submit your RFP</a></p><p>Submitting sends it to your matched suppliers, who respond through the app. Pricing stays private to you and there are no sales calls until you choose.</p><p>If you did not request this, ignore this email.</p>`,
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
  // Pins must be real marketplace vendors; anything else is dropped, cap 5.
  if (buyer.pinned_vendors.length) {
    const valid = new Set(getAllVendorSlugs());
    buyer.pinned_vendors = buyer.pinned_vendors.filter((s) => valid.has(s)).slice(0, 5);
  }
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
  // The desk sends its position's covered sections at creation (Robert's
  // bank-set ruling, 28 Jul 2026). The server RE-DERIVES the earned bank
  // set through the same pure rulebook the desk's chip used, so the
  // published document carries exactly the questions the desk promised:
  // 142 means 142. Absent or empty, the wizard's synthesised sections
  // stand as before. The client is never trusted for question content;
  // it only names which of its sections hold standing claims.
  const rawPosition = body.position as { covered_sections?: unknown; sector?: unknown } | undefined;
  const position =
    rawPosition && typeof rawPosition === "object" && Array.isArray(rawPosition.covered_sections)
      ? {
          covered_sections: rawPosition.covered_sections.map(String).slice(0, 24),
          sector: typeof rawPosition.sector === "string" ? rawPosition.sector : null,
        }
      : null;
  const bankSet = position
    ? deriveRfiQuestionSet({ coveredSections: position.covered_sections, sector: position.sector ?? buyer.sector })
    : null;

  const id = newId("rfp");
  const session = await sessionFromRequest(req);
  const ownerEmail = session && (session.role === "buyer" || session.role === "netify") ? session.email : "";
  let project = ProjectDetailsSchema.parse({
    id,
    created: Date.now(),
    updated: Date.now(),
    status: "draft",
    title: body.title || "Untitled SASE / SD-WAN RFP",
    buyer,
    rfp_sections: bankSet ? bankRfpSections(bankSet) : synthesiseSections(buyer),
    invited_vendors: [],
    share_token: newId("tok"),
    manage_token: newId("mtok"),
    source: "wizard",
    owner_email: ownerEmail,
    methodology_version: "2026.1",
    consent,
    pending_submit: pendingSubmit,
  });
  // The record starts at creation (Harry's Section 1 finding, 28 Jul 2026:
  // "Shows no recorded events despite it being created?". The 24 Jul fix
  // recorded publish events only, and the engine lane records its own
  // creation, so wizard and desk projects were born with empty histories).
  // The record must never block the create; failures fall through.
  try {
    project = recordProjectEvent(project, {
      at: Date.now(),
      actor: "buyer",
      actor_ref: ownerEmail || "unauthenticated",
      via: "web",
      event: "project.created",
      detail: bankSet ? { source: "desk", bank_questions: bankSet.total } : { source: "wizard" },
    });
  } catch { /* the history is a record, never a gate */ }
  const saved = await saveProject(project);
  if (ownerEmail) {
    try { await indexRfpForBuyer(ownerEmail, saved.id); } catch { /* best effort */ }
  }
  // Optional early-capture email from the wizard: never blocks creation.
  // The courtesy email is skipped when a submit is pending, so the confirm
  // magic link is the only email in the inbox at that moment.
  if (typeof body.contact_email === "string" && body.contact_email.includes("@")) {
    try { await attachContactEmail({ id: saved.id, title: saved.title, manage_token: saved.manage_token }, body.contact_email, !pendingSubmit); } catch { /* best effort */ }
  }
  return Response.json(saved, { headers: cors });
}
