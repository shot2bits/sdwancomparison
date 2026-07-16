import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";
import { getEstate, saveEstate } from "@/lib/estate-store";
import { BidSchema } from "@/lib/estate-types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Record a bid against an estate. Two identities may write:
 * - a Netify session (the team brokers pricing in, matching how RFP
 *   responses are relayed today), for any vendor;
 * - a verified supplier session, only for its own vendor_slug.
 * Bid values are private: they render only to the manage-key holder.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const estate = await getEstate(id);
  if (!estate) return Response.json({ error: "Estate not found." }, { status: 404, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session) return Response.json({ error: "Sign-in required to bid." }, { status: 401, headers: cors });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const slug = String(body.vendor_slug ?? "");
  const isNetify = session.role === "netify";
  const isOwnSupplier = session.role === "supplier" && session.vendor_slug === slug;
  if (!isNetify && !isOwnSupplier) return Response.json({ error: "Not authorised for this vendor." }, { status: 403, headers: cors });

  const idx = estate.bids.findIndex((b) => b.vendor_slug === slug);
  if (idx === -1) return Response.json({ error: "This vendor was not invited to bid on this estate." }, { status: 404, headers: cors });

  const status = body.status === "declined" ? "declined" : "received";
  const parsed = BidSchema.safeParse({
    ...estate.bids[idx],
    status,
    value: status === "received" && typeof body.value === "number" ? body.value : null,
    currency: typeof body.currency === "string" ? body.currency : "GBP",
    unit: body.unit === "per_site_month" || body.unit === "total_month" ? body.unit : "per_user_month",
    term_months: typeof body.term_months === "number" ? body.term_months : 36,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
    reason: status === "declined" && typeof body.reason === "string" ? body.reason.slice(0, 200) : "",
    at: Date.now(),
  });
  if (!parsed.success) return Response.json({ error: "Invalid bid payload." }, { status: 422, headers: cors });

  const bids = [...estate.bids];
  bids[idx] = parsed.data;
  const saved = await saveEstate({ ...estate, bids });

  // The portal's promise: the buyer hears the moment pricing lands. Best
  // effort, never blocks the bid write. Sent only when the buyer left an
  // alert address at submission; the link carries their private manage key.
  try {
    const to = saved.contact_email;
    const key = process.env.RESEND_API_KEY;
    if (to && key) {
      const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
      const room = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://netify.co.uk/sase"}/pricing/?estate=${saved.id}&manage=${saved.manage_token}`;
      const vendor = parsed.data.vendor_name || slug;
      const receivedCount = saved.bids.filter((b) => b.status === "received").length;
      const subject = parsed.data.status === "received"
        ? `${vendor} has priced your estate`
        : `${vendor} has declined to bid`;
      const line = parsed.data.status === "received"
        ? `<p><strong>${vendor}</strong> has just priced your estate directly in your Netify pricing room. That is ${receivedCount} of ${saved.bids.length} providers priced so far.</p>`
        : `<p><strong>${vendor}</strong> has declined to bid${parsed.data.reason ? ` (${parsed.data.reason})` : ""}. The rest of your providers are still in play.</p>`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          reply_to: "support@netify.com",
          subject,
          html: `${line}<p><a href="${room}" style="display:inline-block;background:#f59e0b;color:#111;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;">Open your pricing room</a></p><p>Every price is private to you. Providers never see each other's numbers or your site contacts, and there are no sales calls until you choose.</p><p style="font-size:12px;color:#666;">You receive these alerts because you asked to be told when pricing lands on this estate. The link carries your private manage key, so keep it to yourself.</p>`,
        }),
      });
    }
  } catch { /* best effort */ }

  return Response.json({ ok: true, bid: { vendor_slug: slug, status: parsed.data.status } , bids_total: saved.bids.length }, { headers: cors });
}
