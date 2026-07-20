import { corsHeaders, preflight } from "@/lib/cors";
import { buildMarketReport } from "@/lib/market-report";
import { getProject, kvConfigured, kvGetJson, kvSetJson, isBuyerAllowedDomain, recordRejectedAttempt } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { isBlockedDomainLive, isAcademicDomain, isAdminEmail, emailDomain } from "@/lib/access-control";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/** LPUSH a draft-link capture record (same write shape as /api/lead's kvStore). */
async function recordCapture(record: Record<string, unknown>) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/lpush/rfp_draftlink_leads`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify([JSON.stringify(record)]),
  });
}

/** Send the draft link via Resend (best effort) — same transport as sendMagicLink. */
async function sendDraftLink(email: string, p: { id: string; title: string; manage_token: string }, reportLine?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const link = `${SITE_URL}/rfp-builder/${p.id}/?manage=${p.manage_token}`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from, to: email,
        subject: "Your Netify RFP draft link",
        html: `<p>Here is the link back to your RFP draft "${p.title}".</p>${reportLine ? `<p>${reportLine}</p>` : ""}<p><a href="${link}">Reopen your draft</a> on any device — the link carries your private manage key, so keep it to yourself.</p><p>When you are ready to send the RFP to suppliers, sign in with this address and press Publish. Publishing is free and returns your full Netify Market Report with the complete supplier list and your document as Word and PDF.</p><p>If you did not request this, ignore this email.</p>`,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Email the buyer their own draft link ("come back later"). Owner-only
 * (manage_token or owning account), same business-email policy as sign-in,
 * one email per RFP per hour. Also stores the address as the RFP's
 * contact-capture field so the team can follow up on parked drafts.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { email?: string; manage_token?: string; company_url?: string } = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  // Honeypot: silently accept and drop (same as /api/lead).
  if (body.company_url) return Response.json({ ok: true }, { headers: cors });

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Emailing this RFP's draft link", cors);

  const email = (body.email ?? "").trim().toLowerCase();
  const domain = emailDomain(email);
  if (!domain) return Response.json({ error: "Enter a valid email." }, { status: 422, headers: cors });

  // Same business-only identity policy as sign-in (admins exempt). Academic
  // domains an admin has approved on the buyer allowlist pass; the rest are
  // pointed at sign-in, where the review queue explains itself.
  if (!isAdminEmail(email)) {
    if (isAcademicDomain(domain) && !(await isBuyerAllowedDomain(domain))) {
      return Response.json(
        { error: "Academic and research addresses are reviewed before access. Request a sign-in link instead and the Netify team will approve your domain, usually within one working day." },
        { status: 422, headers: cors },
      );
    }
    if (await isBlockedDomainLive(domain)) {
      try { await recordRejectedAttempt(domain, "webmail"); } catch { /* best effort */ }
      return Response.json(
        { error: "Please use your organisation email. Free and personal email addresses are not accepted." },
        { status: 422, headers: cors },
      );
    }
  }

  // One draft-link email per RFP per hour (the notify.ts last-notify pattern).
  const limitKey = `rfp:${project.id}:draftlink_last`;
  const last = await kvGetJson<number>(limitKey);
  if (last && Date.now() - last < 60 * 60 * 1000) {
    return Response.json({ error: "A draft link was emailed recently. Try again in an hour." }, { status: 429, headers: cors });
  }

  // Capture the address on the RFP (contact field + lead list), best effort.
  try { await kvSetJson(`rfp:${project.id}:contact_email`, email); } catch { /* best effort */ }
  try { await recordCapture({ rfp_id: project.id, email, ts: Date.now() }); } catch { /* best effort */ }

  // The claim email leads with the value: the report numbers for this draft.
  let reportLine: string | undefined;
  try {
    const rep = buildMarketReport(project);
    const band = rep.estimate ? `an indicative market band of £${rep.estimate.monthly_band_gbp[0].toLocaleString("en-GB")} to £${rep.estimate.monthly_band_gbp[1].toLocaleString("en-GB")} per month` : "an indicative market band";
    reportLine = `Your Market Report preview: ${rep.matched.count} matched supplier${rep.matched.count === 1 ? "" : "s"} on the Netify marketplace and ${band} for a project like yours.`;
  } catch { /* the email still sends without the numbers */ }
  const sent = await sendDraftLink(email, project, reportLine);
  if (sent) { try { await kvSetJson(limitKey, Date.now()); } catch { /* best effort */ } }

  return Response.json({ ok: true, emailed: sent }, { headers: cors });
}
