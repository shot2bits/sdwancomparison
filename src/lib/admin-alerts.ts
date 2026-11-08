import { createHash, randomUUID } from "node:crypto";
import { activityMailFetch, activityMailKey } from "./activity-mail";
import { kvGetJson, kvSetJson, kvRaw, getVendorClaim, getOpportunity } from "./rfp-store";
import { getLatestPublishedSnapshot } from "./published-snapshot";
import { getBounce, recordResendSend } from "./email-bounces";
import { SITE_URL } from "./structured-data";

export const ADMIN_ALERT_TO = "support@netify.com";
const PENDING = "admin-alerts:pending";
const RETRY_MS = 5 * 60 * 1000;
// Resend retains idempotency keys for 24h. Never blindly resend an ambiguous
// request after that window; leave it visible for an administrator to inspect.
const SAFE_RETRY_MS = 23 * 60 * 60 * 1000;
export type AdminAlertEvent =
  | { kind: "project"; reference: string; revision: string; format: "RFI" | "RFP" }
  | { kind: "supplier"; reference: string; requested: number }
  | { kind: "opportunity"; reference: string }
  | { kind: "test"; reference: string };
export type AdminAlert = {
  id: string; event: AdminAlertEvent; created: number;
  status: "pending" | "accepted" | "needs_review" | "cancelled";
  attempts: number; next_attempt: number; first_attempt?: number;
  payload?: { from: string; to: string; subject: string; text: string };
  email_id?: string; accepted_at?: number;
};
export const adminAlertId = (event: AdminAlertEvent) => createHash("sha256").update(JSON.stringify(event)).digest("hex");
const recordKey = (id: string) => `admin-alerts:record:${id}`;

/** Persist intent BEFORE committing the source event. No send until the matching
 * published snapshot / pending claim exists. A crash after commit is retried by cron. */
export async function queueAdminAlert(event: AdminAlertEvent): Promise<string> {
  const id = adminAlertId(event);
  const record: AdminAlert = { id, event, created: Date.now(), status: "pending", attempts: 0, next_attempt: 0 };
  await kvRaw(["SET", recordKey(id), JSON.stringify(record), "NX"]);
  await kvRaw(["SADD", PENDING, id]);
  return id;
}

async function alertPayload(record: AdminAlert): Promise<AdminAlert["payload"] | "cancelled" | null> {
  const e = record.event;
  let subject: string, text: string;
  if (e.kind === "project") {
    const snapshot = await getLatestPublishedSnapshot(e.reference);
    if (!snapshot) return null;
    // A later revision supersedes an uncommitted older publication attempt.
    if (snapshot.id !== e.revision) return "cancelled";
    if (!snapshot.public_projection.opportunity_id) return null;
    subject = `New ${e.format} published — Netify | ${e.reference}`;
    text = `A buyer has published an ${e.format} project on the opportunity board.\n\nOpen project details and supplier activity (admin sign-in required):\n${SITE_URL}/admin/projects/${encodeURIComponent(e.reference)}/\n\nThe public listing hides buyer contact details. This email does not invite or approve any supplier.`;
  } else if (e.kind === "supplier") {
    const claim = await getVendorClaim(e.reference);
    if (!claim) return null;
    if (claim.requested !== e.requested || claim.status !== "pending") return "cancelled";
    subject = `Supplier approval needed — Netify | ${e.reference}`;
    text = `A verified supplier has requested access to the ${e.reference} profile.\nRequested by: ${claim.email}\n\nReview and approve or reject the request (admin sign-in required):\n${SITE_URL}/admin/#supplier-approvals\n\nThe supplier is still pending. Receiving this email does not approve access.`;
  } else if (e.kind === "test") {
    subject = "Netify admin email test — no action needed";
    text = `This is a test of Netify's Resend alerts to support@netify.com.\n\nNew project publications and supplier approval requests send an email with an admin link. This test has not published a project, invited a supplier or approved access.\n\nOpen admin:\n${SITE_URL}/admin/`;
  } else {
    const opportunity = await getOpportunity(e.reference);
    if (!opportunity) return null;
    subject = `New opportunity published — Netify | ${e.reference}`;
    text = `A buyer has published an opportunity on the board.\nReference: ${e.reference}\n\nReview the opportunity board in admin:\n${SITE_URL}/admin/#opportunity-board\n\nAdmin sign-in is required. No supplier has been approved by this email.`;
  }
  return { from: process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk", to: ADMIN_ALERT_TO, subject, text };
}

/** Explicit acceptance only: non-2xx, timeouts, missing credentials and KV errors
 * leave durable work pending. Provider idempotency also covers send/receipt crashes. */
export async function deliverAdminAlert(id: string): Promise<void> {
  const lock = `admin-alerts:lock:${id}`, owner = randomUUID();
  if ((await kvRaw(["SET", lock, owner, "NX", "EX", 30])) !== "OK") return;
  try {
    const record = await kvGetJson<AdminAlert>(recordKey(id));
    if (!record) return;
    if (record.status === "accepted" || record.status === "cancelled") {
      await kvRaw(["SREM", PENDING, id]); return;
    }
    if (record.status === "needs_review" || record.next_attempt > Date.now()) return;
    if (record.first_attempt && Date.now() - record.first_attempt >= SAFE_RETRY_MS) {
      record.status = "needs_review";
      await kvSetJson(recordKey(id), record);
      console.error("Admin alert requires delivery review", { alert_id: id });
      return;
    }
    const payload = await alertPayload(record);
    if (payload === "cancelled") {
      record.status = "cancelled"; await kvSetJson(recordKey(id), record);
      await kvRaw(["SREM", PENDING, id]); return;
    }
    if (!payload) return;
    record.payload ??= payload; // immutable across retries, including sender
    record.next_attempt = Date.now() + RETRY_MS;
    const key = activityMailKey();
    if (!key) { await kvSetJson(recordKey(id), record); return; }
    record.first_attempt ??= Date.now();
    record.attempts++;
    await kvSetJson(recordKey(id), record);
    const response = await activityMailFetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(8000),
      headers: { authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `netify-admin-${id}` },
      body: JSON.stringify(record.payload),
    });
    if (!response.ok) throw new Error("Resend did not accept admin alert");
    const receipt = await response.json() as { id?: string };
    if (!receipt.id) throw new Error("Resend returned no email receipt");
    record.status = "accepted"; record.email_id = receipt.id; record.accepted_at = Date.now();
    await kvSetJson(recordKey(id), record);
    await kvRaw(["SREM", PENDING, id]);
    await recordResendSend(receipt.id, {to: ADMIN_ALERT_TO, kind: "admin_alert", ts: record.accepted_at, rfp_id: record.event.kind === "project" ? record.event.reference : null});
  } finally {
    await kvRaw(["EVAL", "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, lock, owner]);
  }
}

export async function tryAdminAlert(id: string): Promise<void> {
  try { await deliverAdminAlert(id); }
  catch { console.error("Admin alert pending retry", { alert_id: id }); }
}
export async function retryAdminAlerts() {
  const ids = (await kvRaw(["SMEMBERS", PENDING])) as string[];
  // Bounded concurrency and work: comfortably inside the function duration.
  const due = [];
  for (const id of ids) {
    const record = await kvGetJson<AdminAlert>(recordKey(id));
    if (record && record.status === "pending" && record.next_attempt <= Date.now()) due.push(id);
    if (due.length >= 15) break;
  }
  for (let i = 0; i < due.length; i += 3) await Promise.all(due.slice(i, i + 3).map(tryAdminAlert));
  return adminAlertSummary();
}
export async function adminAlertSummary() {
  const ids = (await kvRaw(["SMEMBERS", PENDING])) as string[];
  const records = await Promise.all(ids.map(id => kvGetJson<AdminAlert>(recordKey(id))));
  const bounce = await getBounce(ADMIN_ALERT_TO);
  return { recipient: ADMIN_ALERT_TO, last_delivery_failure_at: bounce?.ts ?? null, pending: records.filter(r => r?.status === "pending").length, needs_review: records.filter(r => r?.status === "needs_review").length };
}

/** Admin-only caller. One test per five-minute bucket, always to the fixed inbox. */
export async function sendAdminTestAlert() {
  const id = await queueAdminAlert({kind:"test",reference:String(Math.floor(Date.now() / RETRY_MS))});
  await tryAdminAlert(id);
  return (await kvGetJson<AdminAlert>(recordKey(id)))?.status ?? "pending";
}
