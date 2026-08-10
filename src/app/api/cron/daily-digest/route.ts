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
 * Redesigned 10 Aug 2026 around Robert's principle: there is no draft or
 * value until a buyer publishes to the board. Published counts are now the
 * headline, combined across both live intake paths (the Project/RFP engine
 * and the Opportunity wizard, which previously wasn't represented in the
 * 24h section at all — only in the lagging board total, and it never sent
 * its own alert either, see notify.ts). Drafts, consent and sign-ins moved
 * under an explicitly-labelled "funnel activity" section so they read as
 * leading indicators, not results. The old "consented" line checked the
 * legacy singular `consent` boolean, which Milestone 3's conversational
 * engine never sets (it writes to the `consents` ledger array instead) —
 * fixed, so this line is no longer silently blind to every conversational
 * draft.
 *
 * Guard rails: CRON_SECRET required; response carries counts only; the
 * email goes to the admin inbox and nowhere else; ?dry=1 skips the send.
 */

const DIGEST_TO = "support@netify.com";
const WINDOW_MS = 24 * 60 * 60 * 1000;

type Snapshot = { at: number; accounts: number; published: number; responses: number; opportunities: number };

/** "engine · channel" counts for a set of Project records, e.g. for
 *  breaking drafts or publishes down by which engine and which door the
 *  buyer came through. Both fields pre-date Milestone 3 as schema but
 *  were never surfaced in the digest until now. */
function engineChannelCounts(projects: { engine?: string; source?: string }[]) {
  return {
    network: projects.filter((p) => p.engine !== "security_sourcing").length,
    security_sourcing: projects.filter((p) => p.engine === "security_sourcing").length,
    mcp: projects.filter((p) => p.source === "mcp").length,
    wizard: projects.filter((p) => p.source === "wizard").length,
    unknown: projects.filter((p) => p.source !== "mcp" && p.source !== "wizard").length,
  };
}

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

  // Funnel movement in the window. Drafts and consent are leading
  // indicators only — see the file header. `consents` (plural, the
  // engine-layer ledger) is what Milestone 3's conversational path
  // actually writes to; the legacy singular `consent` boolean is checked
  // too, purely so a pre-engine wizard draft (which only ever set that
  // field) still counts.
  const draftsNew = projects.filter((p) => (p.created ?? 0) >= since);
  const consentedNew = draftsNew.filter((p) => Boolean(p.consent) || (p.consents?.length ?? 0) > 0);
  const stuckSubmits = projects.filter((p) => Boolean(p.pending_submit) && (p.status === "draft" || p.status === "review"));
  const publishedAll = projects.filter((p) => p.status !== "draft" && p.status !== "review");
  const publishedNew = publishedAll.filter((p) => (p.updated ?? p.created ?? 0) >= since);
  const draftsBreakdown = engineChannelCounts(draftsNew);
  const publishedBreakdown = engineChannelCounts(publishedNew);

  // The Opportunity wizard has no draft state at all (POST /api/opportunity
  // only ever runs at the moment of publish), so "created in the window" IS
  // "published in the window" for this path — nothing to filter out.
  const opportunitiesNew = opportunities.filter((o) => (o.created ?? 0) >= since);
  const combinedPublishedNew = publishedNew.length + opportunitiesNew.length;

  // Sessions created in the window, split by role; netify/admin excluded
  // from the headline count but reported.
  const sessionsNew = sessions.filter((s) => (s.created ?? 0) >= since);
  const buyerSessionsNew = sessionsNew.filter((s) => s.role === "buyer");
  const supplierSessionsNew = sessionsNew.filter((s) => s.role === "supplier");
  const buyerDomains = Array.from(new Set(buyerSessionsNew.map((s) => (s.email.split("@")[1] ?? "").toLowerCase()))).filter(Boolean);

  // Running totals with day-on-day deltas. Combined-published is derived
  // from the two existing snapshot fields rather than a new one, so the
  // first digest after this change still has a same-day delta to compare
  // against instead of showing no history.
  const accountsTotal = signups.filter((s) => s.roles.includes("buyer")).length;
  const responseLists = await kvMgetJson<unknown[]>(publishedAll.map((p) => `rfp:${p.id}:responses`));
  const responsesTotal = responseLists.reduce<number>((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0);
  const opportunitiesTotal = opportunities.length;
  const publishedTotal = publishedAll.length;
  const combinedPublishedTotal = publishedTotal + opportunitiesTotal;
  const prevCombinedPublished =
    snapshot?.published !== undefined && snapshot?.opportunities !== undefined ? snapshot.published + snapshot.opportunities : undefined;

  const quiet = draftsNew.length === 0 && buyerSessionsNew.length === 0 && combinedPublishedNew === 0;
  const subject = quiet
    ? "Netify 07:30 digest: quiet 24h (0 published, 0 drafts)"
    : `Netify 07:30 digest: ${combinedPublishedNew} published, ${draftsNew.length} draft${draftsNew.length === 1 ? "" : "s"}, ${buyerSessionsNew.length} buyer sign-in${buyerSessionsNew.length === 1 ? "" : "s"}`;

  const lines = [
    "Published in the last 24 hours (the number that matters):",
    `- Total: ${combinedPublishedNew}`,
    `    - via Project/RFP engine: ${publishedNew.length} (network/SD-WAN: ${publishedBreakdown.network}, security sourcing: ${publishedBreakdown.security_sourcing})`,
    `    - via Opportunity wizard: ${opportunitiesNew.length}`,
    "",
    "Funnel activity (leading indicators only — nothing below is on the board yet):",
    `- New drafts started: ${draftsNew.length} (AI agent/MCP: ${draftsBreakdown.mcp}, web wizard: ${draftsBreakdown.wizard}, unknown: ${draftsBreakdown.unknown})`,
    `- Of those, consent recorded: ${consentedNew.length}`,
    `- Buyer sign-ins: ${buyerSessionsNew.length}${buyerDomains.length ? ` (${buyerDomains.join(", ")})` : ""}`,
    `- Vendor sign-ins: ${supplierSessionsNew.length}`,
    "",
    "Watch items:",
    `- Buyers stuck at the email step (pending submit, link never clicked): ${stuckSubmits.length}`,
    `- Vendor access requests waiting in the queue: ${pending.length}`,
    "",
    "Running totals:",
    `- Published (all paths): ${combinedPublishedTotal}${delta(combinedPublishedTotal, prevCombinedPublished)}`,
    `    - Project/RFP engine: ${publishedTotal}${delta(publishedTotal, snapshot?.published)}`,
    `    - Opportunity wizard: ${opportunitiesTotal}${delta(opportunitiesTotal, snapshot?.opportunities)}`,
    `- Buyer accounts: ${accountsTotal}${delta(accountsTotal, snapshot?.accounts)}`,
    `- Vendor responses: ${responsesTotal}${delta(responsesTotal, snapshot?.responses)}`,
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
      published_24h: combinedPublishedNew,
      published_24h_rfp_engine: publishedNew.length,
      published_24h_rfp_engine_breakdown: publishedBreakdown,
      published_24h_opportunity_wizard: opportunitiesNew.length,
      drafts_24h: draftsNew.length,
      drafts_24h_breakdown: draftsBreakdown,
      consented_24h: consentedNew.length,
      buyer_signins_24h: buyerSessionsNew.length,
      supplier_signins_24h: supplierSessionsNew.length,
      stuck_submits: stuckSubmits.length,
      pending_requests: pending.length,
    },
  });
}
