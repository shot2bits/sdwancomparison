import { Webhook } from "svix";
import { kvConfigured } from "@/lib/rfp-store";
import { getResendSend, recordBounce } from "@/lib/email-bounces";

export const runtime = "nodejs";

/**
 * Resend delivery-event webhook (11 Aug 2026). This is the fix for the gap
 * confirmed live that same day: Resend's send API returns 200 the moment an
 * email is queued, even to a domain with no mail server, and only reports
 * the actual failure later, asynchronously, here. Nothing that checks the
 * send call's own response can ever see that later failure — this endpoint
 * is the only place it can be caught.
 *
 * Registered in the Resend dashboard (Webhooks) against this exact URL for
 * the email.bounced and email.complained events. Resend signs every
 * delivery with Svix (svix-id / svix-timestamp / svix-signature headers);
 * RESEND_WEBHOOK_SECRET is the signing secret Resend generates when the
 * endpoint is added, required here to verify a delivery genuinely came from
 * Resend and not from anyone who found this URL.
 *
 * Always returns fast and always 200 once verified and parsed, even for
 * event types this app doesn't act on — Resend retries on non-2xx, and a
 * silently-dropped event type is fine, a retry storm is not.
 */

type ResendBouncePayload = {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    bounce?: { message?: string; type?: string; subType?: string };
    complaint?: { type?: string };
  };
};

function firstRecipient(to: string | string[] | undefined): string {
  if (!to) return "";
  return (Array.isArray(to) ? to[0] : to) ?? "";
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "RESEND_WEBHOOK_SECRET not configured." }, { status: 503 });
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503 });

  // Svix verification needs the exact raw bytes Resend signed — parsing to
  // JSON first and re-serialising would not reproduce the same signature.
  const raw = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ error: "Missing Svix headers." }, { status: 400 });
  }

  let payload: ResendBouncePayload;
  try {
    const verified = new Webhook(secret).verify(raw, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    payload = verified as ResendBouncePayload;
  } catch {
    // Signature didn't check out: reject rather than trust an unverified
    // body, but still 401, not a 5xx, so Resend doesn't treat this as a
    // transient failure and retry a request that will never verify.
    return Response.json({ error: "Signature verification failed." }, { status: 401 });
  }

  if (payload.type !== "email.bounced" && payload.type !== "email.complained") {
    // Ack anything else (email.sent, email.delivered, email.opened, ...) —
    // received and understood, nothing for this endpoint to do with it yet.
    return Response.json({ ok: true, ignored: payload.type });
  }

  const emailId = payload.data.email_id ?? "";
  const correlated = emailId ? await getResendSend(emailId).catch(() => null) : null;
  const email = (correlated?.to ?? firstRecipient(payload.data.to)).toLowerCase().trim();
  if (!email) return Response.json({ ok: true, skipped: "no recipient" });

  const isBounce = payload.type === "email.bounced";
  await recordBounce({
    email,
    kind: correlated?.kind ?? "magic_link",
    type: isBounce ? (payload.data.bounce?.type ?? "Bounced") : "Complained",
    reason: isBounce ? (payload.data.bounce?.message ?? payload.data.bounce?.subType ?? "Delivery failed") : "Recipient marked as spam",
    rfp_id: correlated?.rfp_id ?? null,
    ts: Date.now(),
  });

  return Response.json({ ok: true, recorded: email, correlated: Boolean(correlated) });
}
