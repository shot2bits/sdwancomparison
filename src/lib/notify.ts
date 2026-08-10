/**
 * Buyer notifications for supplier activity on an opportunity. Best effort
 * via Resend (same transport as magic links); failures never block the
 * marketplace action itself.
 *
 * Rate limiting: at most one email per opportunity per hour, tracked in KV
 * (`opp:{id}:lastnotify`). A burst of comments and bids produces one email
 * pointing at the room, not an inbox flood.
 *
 * Privacy: the email names the supplier and the activity type only. Pricing
 * amounts are never included — email is a weaker channel than the signed-in
 * room, and forwarding happens.
 */

import { kvGetJson, kvSetJson } from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";
import type { FeedType, Opportunity } from "@/lib/opportunity-types";

const NOTIFY_INTERVAL_MS = 60 * 60 * 1000;

const ACTIVITY_LABELS: Partial<Record<FeedType, string>> = {
  comment: "commented on",
  pricing: "submitted indicative pricing on",
  interest: "registered interest in",
  decline: "declined",
  response: "submitted a structured response to",
  question: "asked a clarification question on",
};

/**
 * Internal lead alert for an Opportunity publish (Robert's principle, 10 Aug
 * 2026: there is no draft or value in this record until it reaches the
 * board). An Opportunity has no draft state at all — POST /api/opportunity
 * only ever runs at the moment of publish (see that route's own gating
 * comment), so this is the single, correct notification point for the
 * whole intake path: nothing earlier would be alerting on real value, and
 * nothing later would be missed. Mirrors rfp-publish.ts's sendPublishEmails
 * internal alert for the Project/RFP engine, so the team gets one
 * consistent "something just went live" signal regardless of which intake
 * path a buyer used. Best effort: never blocks the publish response.
 */
export async function notifyOpportunityPublishedLead(opp: Opportunity): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? "support@netify.com";
  const domain = (opp.owner_email.split("@")[1] ?? "unknown").toLowerCase();
  const roomUrl = `${SITE_URL}/opportunities/${opp.id}/room`;
  const org = [
    opp.buyer_sector && `Sector: ${opp.buyer_sector}`,
    opp.buyer_size_band && `Size: ${opp.buyer_size_band}`,
    opp.sites != null && `Sites: ${opp.sites}`,
    opp.regions.length > 0 && `Regions: ${opp.regions.join(", ")}`,
  ].filter(Boolean).join("<br/>");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        reply_to: opp.owner_email || undefined,
        subject: `Opportunity Published | ${domain} | ${opp.scope.join(", ") || "unscoped"}`,
        html:
          `<p><strong>${opp.title}</strong> (${opp.id}) was published by <strong>${opp.owner_email || "an unattributed session"}</strong> via the Opportunity wizard.</p>` +
          (org ? `<p>${org}</p>` : "") +
          `<p>Engagement: ${opp.engagement_type} &middot; Response mode: ${opp.response_mode} &middot; Eligibility: ${opp.eligibility} &middot; Visibility: ${opp.visibility}</p>` +
          `<p><a href="${roomUrl}">Open the response room</a></p>`,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function notifyBuyerOfSupplierActivity(
  opp: Opportunity,
  supplierName: string,
  type: FeedType,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  if (!opp.owner_email) return false; // pre-rebuild opportunities have no owner
  const label = ACTIVITY_LABELS[type];
  if (!label) return false; // buyer's own posts, awards, closes: no email

  // One email per opportunity per hour.
  const rlKey = `opp:${opp.id}:lastnotify`;
  try {
    const last = await kvGetJson<number>(rlKey);
    if (last && Date.now() - last < NOTIFY_INTERVAL_MS) return false;
    await kvSetJson(rlKey, Date.now());
  } catch {
    return false; // if KV is unhappy, skip rather than risk a flood
  }

  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const roomUrl = `${SITE_URL}/opportunities/${opp.id}/room`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: opp.owner_email,
        subject: `Vendor activity on "${opp.title}"`,
        html:
          `<p><strong>${supplierName}</strong> ${label} your opportunity <strong>${opp.title}</strong>.</p>` +
          `<p><a href="${roomUrl}">Open your response room</a> to see the details. Pricing details are only visible in the room, never in email.</p>` +
          `<p style="color:#666;font-size:12px">You receive at most one of these per opportunity per hour, however busy the room gets. Sign in with this email address to manage the opportunity from any device.</p>`,
      }),
    });
    return true;
  } catch {
    return false;
  }
}
