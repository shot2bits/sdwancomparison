import {activityMailFetch} from "@/lib/activity-mail";
import { getProjectsBulk, kvConfigured, kvGetJson, kvMgetJson, kvSetJson, listAllRfpIds } from "@/lib/rfp-store";
import { getOptouts, signUnsubscribe } from "@/lib/email-optout";
import { latestPublicationOutcomes, recoveryReminder, type PublicationOutcome } from "@/lib/buyer-recovery";
import { activityClassification } from "@/lib/activity-provenance";
import { isAdminEmail } from "@/lib/access-control";
import { SITE_URL } from "@/lib/structured-data";
import { getBounces, recordResendSend } from "@/lib/email-bounces";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 48-hour publish nudge (Vercel Cron, daily). One email, once ever, to the
 * owner of an RFP that was generated but never published. The buyers this
 * can reach are exactly the ones the on-page publish panel cannot: people
 * who built a document and left.
 *
 * Guard rails:
 *  - CRON_SECRET required (Vercel sends Authorization: Bearer <secret>).
 *  - Owner email required (anonymous drafts are unreachable by design).
 *  - netify.com owners skipped (internal test data).
 *  - One nudge per RFP ever (rfp:nudge:{id} flag), 48h quiet period after
 *    the last edit, opt-out list honoured, hard cap per run.
 *  - Response carries counts only, never addresses.
 */

const QUIET_MS = 48 * 60 * 60 * 1000;
const MAX_SENDS_PER_RUN = 40;

function cronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!cronAuthorised(req)) {
    return Response.json({ error: process.env.CRON_SECRET ? "Unauthorised." : "CRON_SECRET not configured." }, { status: 401 });
  }
  if (!kvConfigured()) return Response.json({ error: "KV not configured." }, { status: 503 });
  const resendKey = process.env.RESEND_API_KEY;
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  if (!resendKey && !dry) return Response.json({ error: "RESEND_API_KEY not configured." }, { status: 503 });

  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const optoutSet = await getOptouts();
  const now = Date.now();

  const ids = await listAllRfpIds();
  const projects = await getProjectsBulk(ids);
  const outcomes = latestPublicationOutcomes(await kvGetJson<PublicationOutcome[]>("publish:leads") ?? []);
  // Early-capture contact emails (the wizard's optional field): drafts with
  // no owner become reachable through the address the buyer volunteered for
  // exactly this purpose ("your RFP link and one reminder if you do not
  // finish"). Fetched in one MGET so the loop stays cheap.
  const contacts = await kvMgetJson<string>(projects.map((p) => `rfp:${p.id}:contact_email`));
  const contactByIndex = new Map<number, string>();
  projects.forEach((_, i) => { const c = (contacts[i] ?? "").toLowerCase().trim(); if (c) contactByIndex.set(i, c); });
  // Known-bad addresses (11 Aug 2026, fed by /api/webhooks/resend): this is
  // an automated, unattended send, exactly the case a known bounce should
  // hard-skip rather than merely warn on — nobody is present to read a
  // failure message the way a live sign-in attempt has one. One bulk lookup
  // against every candidate owner/contact address up front.
  const bounces = await getBounces([...new Set([...projects.map((p) => (p.owner_email ?? "").toLowerCase().trim()), ...Array.from(contactByIndex.values())])].filter(Boolean));

  let considered = 0;
  let sent = 0;
  const skipped = { published: 0, anonymous: 0, internal: 0, recent: 0, already_nudged: 0, opted_out: 0, send_failed: 0, known_bounced: 0 };

  for (const [idx, p] of projects.entries()) {
    if (sent >= MAX_SENDS_PER_RUN) break;
    considered += 1;
    if (p.status !== "draft" && p.status !== "review") { skipped.published += 1; continue; }
    const owner = ((p.owner_email ?? "").toLowerCase().trim()) || (contactByIndex.get(idx) ?? "");
    if (!owner) { skipped.anonymous += 1; continue; }
    if (isAdminEmail(owner) || /@(netify\.(com|co\.uk)|networkunion\.co\.uk)$/.test(owner) || activityClassification(p) === "test") { skipped.internal += 1; continue; }
    if (optoutSet.has(owner)) { skipped.opted_out += 1; continue; }
    if (bounces.has(owner)) { skipped.known_bounced += 1; continue; }
    const lastTouch = Math.max(p.updated ?? 0, p.created ?? 0);
    if (now - lastTouch < QUIET_MS) { skipped.recent += 1; continue; }
    const flagKey = `rfp:nudge:${p.id}`;
    if (await kvGetJson<number>(flagKey)) { skipped.already_nudged += 1; continue; }

    const title = p.title?.trim() || "Untitled RFP";
    const link = `${SITE_URL}/rfp-builder/${p.id}?manage=${encodeURIComponent(p.manage_token ?? "")}#publish`;

    if (dry) { sent += 1; continue; }

    const unsubUrl = `${SITE_URL}/api/email/unsubscribe?e=${encodeURIComponent(owner)}&t=${signUnsubscribe(owner)}`;
    const { subject, text, html } = recoveryReminder(title, link, unsubUrl, outcomes.get(p.id));
    try {
      const res = await activityMailFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to: owner,
          reply_to: "support@netify.com",
          subject,
          text,
          html,
          headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
      });
      if (!res.ok) { skipped.send_failed += 1; continue; }
      const data = (await res.json().catch(() => null)) as { id?: string } | null;
      await recordResendSend(data?.id, { to: owner, kind: "publish_nudge", ts: now, rfp_id: p.id });
      await kvSetJson(flagKey, now);
      sent += 1;
    } catch {
      skipped.send_failed += 1;
    }
  }

  return Response.json({ ok: true, dry, considered, sent, skipped });
}
