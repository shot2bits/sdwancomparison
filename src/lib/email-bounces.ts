import { kvGetJson, kvSetJson, kvRaw, kvMgetJson } from "@/lib/rfp-store";

/**
 * Resend delivery-bounce tracking, fed by /api/webhooks/resend (11 Aug 2026).
 *
 * The problem this closes: Resend accepts a send synchronously (the API call
 * returns 200 the moment the email is queued) and only discovers a bounce
 * later, when it actually attempts delivery. Nothing that checks the send
 * call's own response can ever see that later failure, confirmed live by
 * sending to a domain with no mail server and watching the app report
 * success anyway. Only Resend's own webhook, fired after the fact, carries
 * the truth. This module is the correlation layer between the two: every
 * send worth tracking is recorded here keyed by Resend's own email id, so
 * when the bounce webhook arrives (which only carries that id, never the
 * app's own context) it can be traced back to who the send was for and what
 * it was trying to do.
 *
 * Two independent things live here, both keyed off the same bounce record:
 *  - a per-address flag (email:bounce:{address}) other code checks BEFORE
 *    sending, so a known-bad address stops being sent to silently again;
 *  - a capped recent list (email:bounce:recent) for the admin console and
 *    the daily digest, so "buyers stuck at the email step" stops being a
 *    number nobody can act on.
 */

const SEND_TTL_MS = 3 * 24 * 60 * 60 * 1000; // Resend bounces are almost always reported within minutes to a couple of days; no point correlating past that.
const BOUNCE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // long enough that a genuinely broken address stays flagged well past any follow-up window, short enough that a company which fixes its mail server eventually falls out of suppression rather than being blackballed forever on one bad day.
const RECENT_BOUNCES_KEY = "email:bounce:recent";
const RECENT_BOUNCES_CAP = 199;

export type SendKind = "magic_link" | "draft_link" | "publish_nudge";

export type SendRecord = {
  to: string;
  kind: SendKind;
  ts: number;
  /** The RFP this send concerned, when there is one — carried through so a
   *  bounce can be cross-referenced against the funnel row it stalled. */
  rfp_id?: string | null;
};

export type BounceRecord = {
  email: string;
  kind: SendKind;
  /** Resend's own bounce classification, e.g. "Permanent" / "Suppressed". */
  type: string;
  reason: string;
  rfp_id?: string | null;
  ts: number;
};

function sendKey(emailId: string): string {
  return `resend:send:${emailId}`;
}
function bounceKey(email: string): string {
  return `email:bounce:${email.toLowerCase().trim()}`;
}

/** Called at send time by anything that wants its bounces traceable. Best
 *  effort: a failure here must never block the send itself, it only means
 *  a later bounce for this one send goes untraced. */
export async function recordResendSend(emailId: string | undefined | null, record: SendRecord): Promise<void> {
  if (!emailId) return;
  try {
    await kvSetJson(sendKey(emailId), record);
    await kvRaw(["PEXPIRE", sendKey(emailId), SEND_TTL_MS]);
  } catch {
    /* correlation is an enhancement, not required for the send to work */
  }
}

export async function getResendSend(emailId: string): Promise<SendRecord | null> {
  return kvGetJson<SendRecord>(sendKey(emailId));
}

/** Called by the webhook handler once it has resolved which send bounced. */
export async function recordBounce(record: BounceRecord): Promise<void> {
  const key = bounceKey(record.email);
  await kvSetJson(key, record);
  await kvRaw(["PEXPIRE", key, BOUNCE_TTL_MS]);
  try {
    await kvRaw(["LPUSH", RECENT_BOUNCES_KEY, JSON.stringify(record)]);
    await kvRaw(["LTRIM", RECENT_BOUNCES_KEY, 0, RECENT_BOUNCES_CAP]);
  } catch {
    /* the per-address flag above is the important write; the recent list is a nicety for admin/digest */
  }
}

/** The check every sender should make before mailing an address again. */
export async function getBounce(email: string): Promise<BounceRecord | null> {
  if (!email) return null;
  return kvGetJson<BounceRecord>(bounceKey(email));
}

/** Bulk version for funnel/admin rows — one MGET instead of N round trips. */
export async function getBounces(emails: string[]): Promise<Map<string, BounceRecord>> {
  const addrs = emails.map((e) => e.toLowerCase().trim()).filter(Boolean);
  if (addrs.length === 0) return new Map();
  const rows = await kvMgetJson<BounceRecord>(addrs.map(bounceKey));
  const out = new Map<string, BounceRecord>();
  addrs.forEach((addr, i) => { if (rows[i]) out.set(addr, rows[i]!); });
  return out;
}

export async function listRecentBounces(limit = 50): Promise<BounceRecord[]> {
  const raw = ((await kvRaw(["LRANGE", RECENT_BOUNCES_KEY, 0, Math.max(0, limit - 1)])) as string[]) ?? [];
  const out: BounceRecord[] = [];
  for (const r of raw) {
    try { out.push(JSON.parse(r) as BounceRecord); } catch { /* skip a corrupt entry rather than fail the whole list */ }
  }
  return out;
}

/** Admin escape hatch: a support conversation confirms the address now
 *  works (mailbox fixed, typo corrected and re-verified) and clears the
 *  suppression manually rather than waiting out the 180-day TTL. */
export async function clearBounce(email: string): Promise<void> {
  await kvRaw(["DEL", bounceKey(email)]);
}
