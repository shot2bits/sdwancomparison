import { getProjectsBulk, kvConfigured, kvGetJson, kvMgetJson, kvSetJson, listAllRfpIds } from "@/lib/rfp-store";
import { getOptouts, signUnsubscribe } from "@/lib/email-optout";
import { matchSuppliers } from "@/lib/supplier-match";
import { SITE_URL } from "@/lib/structured-data";

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

function matchParamsFor(p: { buyer: { product_scope: string; operating_model: string; regions: string[] } }) {
  const scope = p.buyer.product_scope === "sdwan_only" ? "sdwan" : p.buyer.product_scope === "sse_only" ? "sse" : "sase";
  const model = p.buyer.operating_model === "managed" || p.buyer.operating_model === "diy" ? p.buyer.operating_model : "any";
  return { scope, regions: p.buyer.regions ?? [], model };
}

function emailBodies(title: string, count: number, link: string, unsubUrl: string) {
  const matchLine = count > 0
    ? `${count} vendors and managed service providers on the Netify marketplace currently match what you described.`
    : "Verified vendors and managed service providers on the Netify marketplace are matched to what you described.";
  const benefits = [
    "Indicative pricing, private to you",
    "Demo and proof of concept requests",
    "Evidence documents and PDF collateral",
    "Messaging with vendors and managed providers inside the app",
    "Sales and account contact only when you choose",
    "Independent scoring of every response",
  ];
  const text = [
    `You built the RFP "${title}" on the Netify marketplace but have not submitted it yet. Until you submit, no vendor can see it and nothing is shared.`,
    matchLine,
    "Submitting invites each matched vendor and service provider to respond through a structured form, so you receive comparable bids without speaking to a single salesperson. It is the fastest and simplest way to see whether your requirements match the market.",
    "What submitting gets you:",
    ...benefits.map((b) => `- ${b}`),
    `Submit your RFP: ${link}`,
    "The link is private to you. Vendors and service providers never see your email address or phone number.",
    "Netify",
    `You are receiving this one-off reminder because you created an RFP with this address on netify.co.uk. We only send email relating to your RFPs, opportunities and RFP Builder and Marketplace features and benefits.\nUnsubscribe: ${unsubUrl}`,
  ].join("\n\n");
  const html = [
    `<p>You built the RFP "<strong>${title}</strong>" on the Netify marketplace but have not submitted it yet. Until you submit, no vendor can see it and nothing is shared.</p>`,
    `<p>${matchLine}</p>`,
    `<p>Submitting invites each matched vendor and service provider to respond through a structured form, so you receive comparable bids <strong>without speaking to a single salesperson</strong>. It is the fastest and simplest way to see whether your requirements match the market.</p>`,
    `<p>What submitting gets you:</p><ul>${benefits.map((b) => `<li>${b}</li>`).join("")}</ul>`,
    `<p><a href="${link}" style="display:inline-block;background:#f59e0b;color:#111;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;">Submit your RFP</a></p>`,
    `<p>The link is private to you. Vendors and service providers never see your email address or phone number.</p>`,
    `<p>Netify</p>`,
    `<p style="font-size:12px;color:#666;">You are receiving this one-off reminder because you created an RFP with this address on netify.co.uk. We only send email relating to your RFPs, opportunities and RFP Builder and Marketplace features and benefits. <a href="${unsubUrl}" style="color:#666;">Unsubscribe</a></p>`,
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

  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const optoutSet = await getOptouts();
  const now = Date.now();

  const ids = await listAllRfpIds();
  const projects = await getProjectsBulk(ids);
  // Early-capture contact emails (the wizard's optional field): drafts with
  // no owner become reachable through the address the buyer volunteered for
  // exactly this purpose ("your RFP link and one reminder if you do not
  // finish"). Fetched in one MGET so the loop stays cheap.
  const contacts = await kvMgetJson<string>(projects.map((p) => `rfp:${p.id}:contact_email`));
  const contactByIndex = new Map<number, string>();
  projects.forEach((_, i) => { const c = (contacts[i] ?? "").toLowerCase().trim(); if (c) contactByIndex.set(i, c); });

  let considered = 0;
  let sent = 0;
  const skipped = { published: 0, anonymous: 0, internal: 0, recent: 0, already_nudged: 0, opted_out: 0, send_failed: 0 };

  for (const [idx, p] of projects.entries()) {
    if (sent >= MAX_SENDS_PER_RUN) break;
    considered += 1;
    if (p.status !== "draft" && p.status !== "review") { skipped.published += 1; continue; }
    const owner = ((p.owner_email ?? "").toLowerCase().trim()) || (contactByIndex.get(idx) ?? "");
    if (!owner) { skipped.anonymous += 1; continue; }
    if (owner.endsWith("@netify.com")) { skipped.internal += 1; continue; }
    if (optoutSet.has(owner)) { skipped.opted_out += 1; continue; }
    const lastTouch = Math.max(p.updated ?? 0, p.created ?? 0);
    if (now - lastTouch < QUIET_MS) { skipped.recent += 1; continue; }
    const flagKey = `rfp:nudge:${p.id}`;
    if (await kvGetJson<number>(flagKey)) { skipped.already_nudged += 1; continue; }

    const match = matchSuppliers(matchParamsFor(p));
    const title = p.title?.trim() || "Untitled RFP";
    const link = `${SITE_URL}/rfp-builder/${p.id}?manage=${encodeURIComponent(p.manage_token ?? "")}#publish`;
    const subject = match.count > 0
      ? `${match.count} vendors match your RFP. Submit to invite them`
      : "Your Netify RFP is one step from vendor bids";

    if (dry) { sent += 1; continue; }

    const unsubUrl = `${SITE_URL}/api/email/unsubscribe?e=${encodeURIComponent(owner)}&t=${signUnsubscribe(owner)}`;
    const { text, html } = emailBodies(title, match.count, link, unsubUrl);
    try {
      const res = await fetch("https://api.resend.com/emails", {
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
      await kvSetJson(flagKey, now);
      sent += 1;
    } catch {
      skipped.send_failed += 1;
    }
  }

  return Response.json({ ok: true, dry, considered, sent, skipped });
}
