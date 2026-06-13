/**
 * Auth helpers: cookie handling, magic-link email, session resolution.
 * Cookie is httpOnly; the session token lives in KV. Reading and building
 * stay open; only identity-asserting writes consult requireSupplier.
 */

import { getSession, type AuthSession } from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";

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
export async function sendMagicLink(email: string, token: string, role: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const link = `${SITE_URL}/auth/verify?token=${token}`;
  if (!key) return false;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from, to: email,
        subject: "Your Netify marketplace sign-in link",
        html: `<p>Sign in to the Netify marketplace as a ${role}.</p><p><a href="${link}">Sign in</a> (valid for 20 minutes).</p><p>If you did not request this, ignore this email.</p>`,
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
