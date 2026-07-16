/**
 * Auth helpers: cookie handling, magic-link email, session resolution.
 * Cookie is httpOnly; the session token lives in KV. Reading and building
 * stay open; only identity-asserting writes consult requireSupplier.
 */

import { getSession, getVendorClaim, type AuthSession } from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";
import { isAdminEmail, emailDomain } from "@/lib/access-control";
import { isNetifyDomain } from "@/lib/vendor-domains";

export const SESSION_COOKIE = "netify_session";

export function parseCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function sessionCookieHeader(token: string): string {
  const maxAge = 30 * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

export function clearCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export async function sessionFromRequest(req: Request): Promise<AuthSession | null> {
  return getSession(parseCookie(req, SESSION_COOKIE));
}

/** Send a magic sign-in link via Resend (best effort). Returns whether an email was sent. */
export async function sendMagicLink(email: string, token: string, role: string, returnTo = ""): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  // returnTo is validated by the caller (same-app absolute path only); it
  // rides the link so the verify page can send the person back where the
  // sign-in was requested instead of dead-ending.
  const link = `${SITE_URL}/auth/verify?token=${token}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ""}`;
  if (!key) return false;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  // Consent-at-generate flow: when the sign-in was requested from the
  // wizard's agreement step, the click IS the submission, so the email says
  // so plainly instead of reading as a generic sign-in (informed act rule,
  // 15 July 2026).
  const isSubmission = returnTo.includes("welcome=submitting");
  const subject = isSubmission
    ? "Confirm and submit your RFP to your matched suppliers"
    : "Your Netify marketplace sign-in link";
  const html = isSubmission
    ? `<p>You asked Netify to generate your RFP and submit it to your matched vendors and managed service providers.</p><p><a href="${link}">Confirm and submit</a> (valid for 60 minutes). Clicking confirms your agreement: your RFP goes to your matched suppliers, who review your requirements and make contact through the Netify app. Your contact details are never shown to suppliers, and you can edit the RFP afterwards; suppliers always see the latest version.</p><p>If you did not request this, ignore this email and nothing is sent to anyone.</p>`
    : `<p>Sign in to the Netify marketplace as a ${role}.</p><p><a href="${link}">Sign in</a>, then click <strong>Confirm sign-in</strong> on the page that opens (valid for 60 minutes).</p><p>If you did not request this, ignore this email.</p>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: email, subject, html }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Notify the Netify team when a buyer or supplier signs in for the first time.
 * Best effort via Resend (same transport as the magic link). The destination is
 * SIGNUP_NOTIFY_EMAIL, defaulting to support@netify.com. The email address and
 * status (Buyer or Supplier) are in the subject, as requested. Netify staff
 * sign-ins are internal and never reported. Returns whether an email was sent.
 */
export async function notifyNewSignup(
  email: string,
  role: "supplier" | "buyer" | "netify",
  context?: { attr?: { ref: string; landing: string; page: string; country: string } | null; rfp_attached?: boolean },
): Promise<boolean> {
  if (role !== "buyer" && role !== "supplier") return false;
  // Skip our own people: admins and anyone on a Netify domain are internal
  // (and the admin console signs them in as "buyer"), so they are not real
  // marketplace sign-ups and would only be noise.
  if (isAdminEmail(email) || isNetifyDomain(emailDomain(email) ?? "")) return false;
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? "support@netify.com";
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const status = role === "supplier" ? "Supplier" : "Buyer";
  // Attribution block (16 July 2026): every sign-up alert states where the
  // person came from and whether an RFP draft is attached, so a qualified
  // buyer and a wandering sign-in are distinguishable at a glance.
  const a = context?.attr;
  const lines = [
    `<strong>Email:</strong> ${email}`,
    `<strong>Status:</strong> ${status}`,
    role === "buyer" ? `<strong>RFP draft attached:</strong> ${context?.rfp_attached ? "Yes (claimed at sign-in)" : "No, signed in without a draft"}` : "",
    a?.country ? `<strong>Country:</strong> ${a.country}` : "",
    a?.ref ? `<strong>Arrived from:</strong> ${a.ref}` : `<strong>Arrived from:</strong> no referrer (direct, bookmark or an AI assistant link)`,
    a?.landing ? `<strong>Landing page:</strong> ${a.landing}` : "",
    a?.page ? `<strong>Signed in from:</strong> ${a.page}` : "",
  ].filter(Boolean).join("<br/>");
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `New ${status} sign-up: ${email}`,
        html: `<p>A new ${status.toLowerCase()} has signed in to the Netify marketplace for the first time.</p><p>${lines}</p>`,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gate an identity-asserting supplier write. The session must be a supplier
 * for that exact vendor, or a Netify relay session. Returns null when allowed,
 * or a Response (403/401) when blocked. Reads never call this.
 */
export function requireSupplierFor(session: AuthSession | null, vendorSlug: string, cors: Record<string, string>): Response | null {
  if (!session) {
    return Response.json({ error: "Sign in as this supplier to respond.", auth_required: true }, { status: 401, headers: cors });
  }
  if (session.role === "netify") return null; // Netify relay can act for any vendor
  if (session.role === "supplier" && session.vendor_slug === vendorSlug) return null;
  return Response.json({ error: "Your sign-in does not match this supplier.", auth_required: true }, { status: 403, headers: cors });
}

/**
 * Gate a supplier write, with the profile-claim requirement on top of identity.
 * A Netify relay session may act for any vendor (Netify staff/admin). A supplier
 * session may act only for its own domain-verified vendor AND only once that
 * vendor profile has an admin-approved claim. Until the claim is approved the
 * supplier can sign in and browse but cannot bid, quote or respond. Reads never
 * call this.
 */
export async function requireClaimedSupplierFor(
  session: AuthSession | null,
  vendorSlug: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  if (!session) {
    return Response.json({ error: "Sign in as this supplier to respond.", auth_required: true }, { status: 401, headers: cors });
  }
  if (session.role === "netify") return null; // Netify relay/admin acts for any vendor
  if (session.role === "supplier" && session.vendor_slug === vendorSlug) {
    const claim = await getVendorClaim(vendorSlug);
    if (claim && claim.status === "approved") return null;
    return Response.json(
      {
        error: "Claim your company profile and wait for Netify to approve it before acting as this supplier.",
        claim_required: true,
        claim_status: claim?.status ?? "unclaimed",
      },
      { status: 403, headers: cors },
    );
  }
  return Response.json({ error: "Your sign-in does not match this supplier.", auth_required: true }, { status: 403, headers: cors });
}
