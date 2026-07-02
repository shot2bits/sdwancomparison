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
};

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
        subject: `Supplier activity on "${opp.title}"`,
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
