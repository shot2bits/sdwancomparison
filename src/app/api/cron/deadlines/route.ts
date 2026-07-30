import { getProjectsBulk, kvConfigured, kvGetJson, kvSetJson, listAllRfpIds, listConnections } from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Response-window clock (deal room slice 1, 15 July 2026). Daily pass over
 * published RFPs with a response_deadline:
 *  - 48 hours before close: one reminder email to the buyer with viewed and
 *    response progress (flag rfp:dl48:{id}).
 *  - After close: one closing summary email to the buyer (flag rfp:dlclose:{id}).
 * Suppliers have no accounts yet, so their reminders arrive when the
 * notification spine switches on; the respond API already enforces the
 * deadline server-side either way. CRON_SECRET protected; counts-only response.
 */

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function sendBuyerEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, reply_to: "support@netify.com", subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!authorised(req)) {
    return Response.json({ error: process.env.CRON_SECRET ? "Unauthorised." : "CRON_SECRET not configured." }, { status: 401 });
  }
  if (!kvConfigured()) return Response.json({ error: "KV not configured." }, { status: 503 });

  const now = Date.now();
  const ids = await listAllRfpIds();
  const projects = await getProjectsBulk(ids);
  let reminders = 0;
  let closes = 0;

  for (const p of projects) {
    if (p.status !== "published" || !p.response_deadline) continue;
    const owner = (p.owner_email ?? "").toLowerCase();
    if (!owner || owner.endsWith("@netify.com")) continue;

    const msLeft = p.response_deadline - now;
    const url = `${SITE_URL}/rfp-builder/${p.id}/`;

    if (msLeft > 0 && msLeft <= 48 * 3600000) {
      const flag = `rfp:dl48:${p.id}`;
      if (!(await kvGetJson<number>(flag))) {
        const conns = await listConnections(p.id);
        const viewed = conns.filter((c) => c.viewed_at).length;
        const closeDate = new Date(p.response_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
        const ok = await sendBuyerEmail(
          owner,
          `Your RFP response window closes ${closeDate}`,
          `<p>The response window for "${p.title}" closes on ${closeDate}.</p><p>${viewed} of ${conns.length} invited vendors and service providers have viewed your RFP so far. Responses received are scored and waiting in your workspace.</p><p><a href="${url}">Open your RFP workspace</a></p><p>Netify</p>`,
        );
        if (ok) { await kvSetJson(flag, now); reminders += 1; }
      }
    }

    if (msLeft <= 0 && msLeft > -7 * 86400000) {
      const flag = `rfp:dlclose:${p.id}`;
      if (!(await kvGetJson<number>(flag))) {
        const conns = await listConnections(p.id);
        const viewed = conns.filter((c) => c.viewed_at).length;
        const ok = await sendBuyerEmail(
          owner,
          "Your RFP response window has closed",
          `<p>The response window for "${p.title}" has closed. ${viewed} of ${conns.length} invited vendors and service providers viewed your RFP.</p><p>Responses are scored under Evaluate vendor responses in your workspace. Want more responses? Re-send to your matched vendors or invite more from the marketplace and a new window opens.</p><p><a href="${url}">Review your responses</a></p><p>Netify</p>`,
        );
        if (ok) { await kvSetJson(flag, now); closes += 1; }
      }
    }
  }

  return Response.json({ ok: true, reminders, closes });
}
