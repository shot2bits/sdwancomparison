import {
  kvConfigured,
  kvGetJson,
  kvMgetJson,
  kvSetJson,
  listAllRfpIds,
  getProjectsBulk,
  listSessions,
  listSignups,
  listPendingRequests,
  listOpportunities,
} from "@/lib/rfp-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 07:30 daily digest (Vercel Cron, 06:30 UTC). One email to the admin inbox
 * answering the question Robert otherwise asks cold each morning: are leads
 * flowing? Last-24h funnel movement plus running totals with day-on-day
 * deltas (previous totals snapshotted in KV under digest:snapshot).
 *
 * Guard rails: CRON_SECRET required; response carries counts only; the
 * email goes to the admin inbox and nowhere else; ?dry=1 skips the send.
 */

const DIGEST_TO = "support@netify.com";
const WINDOW_MS = 24 * 60 * 60 * 1000;

type Snapshot = { at: number; accounts: number; published: number; responses: number; opportunities: number };

function cronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function delta(now: number, prev: number | undefined): string {
  if (prev === undefined) return "";
  const d = now - prev;
  return d === 0 ? " (no change)" : d > 0 ? ` (+${d} since yesterday)` : ` (${d} since yesterday)`;
}

export async function GET(req: Request) {
  if (!cronAuthorised(req)) {
    return Response.json({ error: process.env.CRON_SECRET ? "Unauthorised." : "CRON_SECRET not configured." }, { status: 401 });
  }
  if (!kvConfigured()) return Response.json({ error: "KV not configured." }, { status: 503 });
  const resendKey = process.env.RESEND_API_KEY;
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  if (!resendKey && !dry) return Response.json({ error: "RESEND_API_KEY not configured." }, { status: 503 });

  const now = Date.now();
  const since = now - WINDOW_MS;

  const [ids, sessions, signups, pending, opportunities, snapshot] = await Promise.all([
    listAllRfpIds(),
    listSessions(),
    listSignups(),
    listPendingRequests(),
    listOpportunities(),
    kvGetJson<Snapshot>("digest:snapshot"),
  ]);
  const projects = await getProjectsBulk(ids);

  // Funnel movement in the window.
  const draftsNew = projects.filter((p) => (p.created ?? 0) >= since);
  const consentedNew = draftsNew.filter((p) => Boolean(p.consent));
  const stuckSubmits = projects.filter((p) => Boolean(p.pending_submit) && (p.status === "draft" || p.status === "review"));
  const publishedAll = projects.filter((p) => p.status !== "draft" && p.status !== "review");
  const publishedNew = publishedAll.filter((p) => (p.updated ?? p.created ?? 0) >= since);

  // Sessions created in the window, split by role; netify/admin excluded
  // from the headline count but reported.
  const sessionsNew = sessions.filter((s) => (s.created ?? 0) >= since);
  const buyerSessionsNew = sessionsNew.filter((s) => s.role === "buyer");
  const supplierSessionsNew = sessionsNew.filter((s) => s.role === "supplier");
  const buyerDomains = Array.from(new Set(buyerSessionsNew.map((s) => (s.email.split("@")[1] ?? "").toLowerCase()))).filter(Boolean);

  // Running totals with day-on-day deltas.
  const accountsTotal = signups.filter((s) => s.roles.includes("buyer")).length;
  const responseLists = await kvMgetJson<unknown[]>(publishedAll.map((p) => `rfp:${p.id}:responses`));
  const responsesTotal = responseLists.reduce<number>((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0);
  const opportunitiesTotal = opportunities.length;
  const publishedTotal = publishedAll.length;

  const quiet = draftsNew.length === 0 && buyerSessionsNew.length === 0 && publishedNew.length === 0;
  const subject = quiet
    ? "Netify 07:30 digest: quiet 24h (0 drafts, 0 sign-ins)"
    : `Netify 07:30 digest: ${draftsNew.length} draft${draftsNew.length === 1 ? "" : "s"}, ${buyerSessionsNew.length} buyer sign-in${buyerSessionsNew.length === 1 ? "" : "s"}, ${publishedNew.length} published`;

  const lines = [
    "Last 24 hours:",
    `- RFP drafts created: ${draftsNew.length}`,
    `- Of those, wizard submissions agreed (consented): ${consentedNew.length}`,
    `- Buyer sign-ins: ${buyerSessionsNew.length}${buyerDomains.length ? ` (${buyerDomains.join(", ")})` : ""}`,
    `- Vendor sign-ins: ${supplierSessionsNew.length}`,
    `- RFPs published or updated post-publish: ${publishedNew.length}`,
    "",
    "Watch items:",
    `- Buyers stuck at the email step (pending submit, link never clicked): ${stuckSubmits.length}`,
    `- Vendor access requests waiting in the queue: ${pending.length}`,
    "",
    "Running totals:",
    `- Buyer accounts: ${accountsTotal}${delta(accountsTotal, snapshot?.accounts)}`,
    `- Published RFPs: ${publishedTotal}${delta(publishedTotal, snapshot?.published)}`,
    `- Vendor responses: ${responsesTotal}${delta(responsesTotal, snapshot?.responses)}`,
    `- Opportunities on the board: ${opportunitiesTotal}${delta(opportunitiesTotal, snapshot?.opportunities)}`,
    "",
    `Admin console: https://netify.co.uk/sase/account/`,
    "Netify daily digest. Reply to this address to reach the workspace.",
  ];
  const text = lines.join("\n");
  const html = `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.6;">${lines
    .join("\n")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;

  let sent = false;
  if (!dry) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk",
          to: DIGEST_TO,
          subject,
          text,
          html,
        }),
      });
      sent = res.ok;
    } catch {
      sent = false;
    }
  }

  // Snapshot totals for tomorrow's deltas (written even on dry runs so a
  // manual test primes the comparison).
  const nextSnapshot: Snapshot = { at: now, accounts: accountsTotal, published: publishedTotal, responses: responsesTotal, opportunities: opportunitiesTotal };
  await kvSetJson("digest:snapshot", nextSnapshot);

  return Response.json({
    ok: true,
    dry,
    sent,
    counts: {
      drafts_24h: draftsNew.length,
      consented_24h: consentedNew.length,
      buyer_signins_24h: buyerSessionsNew.length,
      supplier_signins_24h: supplierSessionsNew.length,
      published_24h: publishedNew.length,
      stuck_submits: stuckSubmits.length,
      pending_requests: pending.length,
    },
  });
}
