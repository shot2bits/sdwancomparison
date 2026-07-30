import { kvConfigured, kvGetJson, kvSetJson, listAllRfpIds, getProjectsBulk, listSessions } from "@/lib/rfp-store";
import { getOptouts, signUnsubscribe } from "@/lib/email-optout";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One-hour activation email (Vercel Cron, hourly). Robert, 17 July 2026:
 * buyers who sign in and then do nothing are unreachable by every other
 * mechanism (the publish nudge only writes to drafts). One email, once
 * ever, to buyer accounts whose FIRST session is one to two hours old
 * with zero owned RFPs: publish an RFP, why, and that it is the simplest
 * way to compare the market. Copy per the approved mockup.
 *
 * Guard rails (the publish-nudge pattern):
 *  - CRON_SECRET required (Vercel sends Authorization: Bearer <secret>).
 *  - The 1-2h window plus a once-ever KV flag (account:welcome:{email}),
 *    so re-sign-ins months later can never re-trigger it.
 *  - Anyone who owns ANY RFP is skipped, so nobody is told to start
 *    something they have already started.
 *  - netify.com internal accounts and the opt-out list skipped.
 *  - Signed unsubscribe link plus List-Unsubscribe headers.
 *  - Counts-only response, hard cap per run, ?dry=1 preview.
 */

const WINDOW_START_MS = 2 * 60 * 60 * 1000;
const WINDOW_END_MS = 1 * 60 * 60 * 1000;
const MAX_SENDS_PER_RUN = 20;

function cronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function emailBodies(unsubUrl: string) {
  const startUrl = `${SITE_URL}/rfp-builder/new/`;
  const shortlistUrl = `${SITE_URL}/shortlist/`;
  const benefits = [
    "Answer five quick questions and Netify assembles a complete RFP from its question bank. No document writing.",
    "Up to five matched vendors and managed service providers respond in the app, structured and side by side against your questions.",
    "Pricing stays private to you. No sales calls until you reply, and no obligation to award.",
  ];
  const text = [
    "Your account is ready. Your first project takes about two minutes.",
    "You signed in to the Netify marketplace earlier but have not started a project yet. Publishing an RFP is the simplest way to compare the market: one submission replaces five separate sales conversations, and the vendors and service providers do the hard work for you.",
    ...benefits.map((b) => `- ${b}`),
    `Start your project: ${startUrl}`,
    "Free for buyers. Takes about two minutes.",
    `Prefer to research first? Compare 30+ providers with the shortlist builder, scored across 40 evidence-graded capabilities, then turn your shortlist into an RFP when you are ready: ${shortlistUrl}`,
    "Netify",
    `You are receiving this one-off note because you created a buyer account on netify.co.uk. We only email you about your RFPs, opportunities and RFP Builder and Marketplace features.\nUnsubscribe: ${unsubUrl}`,
  ].join("\n\n");
  const html = [
    `<p style="font-size:18px;font-weight:600;color:#13294b;">Your account is ready. Your first project takes about two minutes.</p>`,
    `<p>You signed in to the Netify marketplace earlier but have not started a project yet. Publishing an RFP is the simplest way to compare the market: one submission replaces five separate sales conversations, and the vendors and service providers do the hard work for you.</p>`,
    `<ul>${benefits.map((b) => `<li style="margin-bottom:6px;">${b}</li>`).join("")}</ul>`,
    `<p style="text-align:center;"><a href="${startUrl}" style="display:inline-block;background:#f59e0b;color:#111;padding:12px 30px;border-radius:999px;text-decoration:none;font-weight:600;">Start your project</a></p>`,
    `<p style="text-align:center;font-size:12px;color:#78716c;">Free for buyers. Takes about two minutes.</p>`,
    `<p style="border-top:1px solid #eee;padding-top:12px;">Prefer to research first? <a href="${shortlistUrl}">Compare 30+ providers with the shortlist builder</a>, scored across 40 evidence-graded capabilities, then turn your shortlist into an RFP when you are ready.</p>`,
    `<p>Netify</p>`,
    `<p style="font-size:12px;color:#666;">You are receiving this one-off note because you created a buyer account on netify.co.uk. We only email you about your RFPs, opportunities and RFP Builder and Marketplace features. <a href="${unsubUrl}" style="color:#666;">Unsubscribe</a></p>`,
  ].join("");
  return { text, html };
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
  const [sessions, optoutSet, ids] = await Promise.all([listSessions(), getOptouts(), listAllRfpIds()]);
  const projects = await getProjectsBulk(ids);
  const owners = new Set(projects.map((p) => (p.owner_email ?? "").toLowerCase().trim()).filter(Boolean));

  // Earliest surviving session per buyer email = account age proxy.
  const earliest = new Map<string, number>();
  for (const s of sessions) {
    if (s.role !== "buyer") continue;
    const email = (s.email ?? "").toLowerCase().trim();
    if (!email) continue;
    const prev = earliest.get(email);
    if (prev === undefined || s.created < prev) earliest.set(email, s.created);
  }

  let considered = 0;
  let sent = 0;
  const skipped = { outside_window: 0, internal: 0, has_rfp: 0, opted_out: 0, already_sent: 0, send_failed: 0 };

  for (const [email, created] of earliest) {
    if (sent >= MAX_SENDS_PER_RUN) break;
    considered += 1;
    const age = now - created;
    if (age < WINDOW_END_MS || age >= WINDOW_START_MS) { skipped.outside_window += 1; continue; }
    if (email.endsWith("@netify.com")) { skipped.internal += 1; continue; }
    if (owners.has(email)) { skipped.has_rfp += 1; continue; }
    if (optoutSet.has(email)) { skipped.opted_out += 1; continue; }
    const flagKey = `account:welcome:${email}`;
    if (await kvGetJson<number>(flagKey)) { skipped.already_sent += 1; continue; }

    if (dry) { sent += 1; continue; }

    const unsubUrl = `${SITE_URL}/api/email/unsubscribe?e=${encodeURIComponent(email)}&t=${signUnsubscribe(email)}`;
    const { text, html } = emailBodies(unsubUrl);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk",
          to: email,
          reply_to: "support@netify.com",
          subject: "The simplest way to compare the SASE & SD-WAN market",
          text,
          html,
          headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
      });
      if (!res.ok) { skipped.send_failed += 1; continue; }
      await kvSetJson(flagKey, now);
      sent += 1;
    } catch {
      skipped.send_failed += 1;
    }
  }

  return Response.json({ ok: true, dry, considered, sent, skipped });
}
