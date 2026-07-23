/**
 * LinkedIn sign-in (OpenID Connect), built 23 July 2026 on Robert's ask.
 * The funnel read that ordered it: the verified-work-email wall is the
 * publish path's cliff, and LinkedIn is the professional identity most
 * buyers already hold. This lane mints the SAME session the magic link
 * mints (createSession → netify_session cookie); nothing downstream knows
 * or cares which door the person used, and the publish-first law — a
 * human signature publishes, download follows publish — is untouched.
 *
 * Buyer lane only. Suppliers stay on the work-email magic link, because a
 * supplier session is minted against a domain-verified vendor mapping and
 * a LinkedIn identity carries no such mapping.
 *
 * Identity policy (stated so nobody rediscovers it the hard way): the
 * LinkedIn-verified email is accepted for buyers even when it is a
 * personal domain. On the magic-link lane the mailbox is the verification,
 * so webmail is blocked; on this lane the LinkedIn account is the
 * verification, so the email is only an address. The sign-up alert names
 * the lane, so the team can always see which wall a buyer came through.
 *
 * Config: LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET, server-side env
 * only (never NEXT_PUBLIC). Absent → linkedinConfigured() is false, the
 * button never renders (the session endpoint carries the flag) and the
 * routes bounce politely to the account page. The secret is Robert's to
 * hold in Vercel; this code reads process.env at runtime and nothing else.
 *
 * Endpoints are LinkedIn's "Sign In with LinkedIn using OpenID Connect"
 * product: authorization + accessToken on www.linkedin.com/oauth/v2, and
 * the standard OIDC userinfo on api.linkedin.com/v2/userinfo (sub, name,
 * email, email_verified). We use the code flow with a server-side
 * exchange and read userinfo over TLS, so the id_token is not parsed.
 */

import { SITE_URL } from "@/lib/structured-data";

export const LINKEDIN_STATE_COOKIE = "netify_li_state";

/** Where callback failures land: the nav's sign-in destination, which
 *  always renders the sign-in box (with the email lane as the fallback)
 *  and reads ?li_error= to say what happened. */
export const LINKEDIN_ERROR_PATH = "/sase/account/";

export function linkedinConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

/** The exact redirect URI registered on the LinkedIn app. Overridable for
 *  previews via LINKEDIN_REDIRECT_URI; defaults to the production path. */
export function linkedinRedirectUri(): string {
  return process.env.LINKEDIN_REDIRECT_URI ?? `${SITE_URL}/api/auth/linkedin/callback`;
}

export function linkedinAuthUrl(state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: linkedinRedirectUri(),
    scope: "openid profile email",
    state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p.toString()}`;
}

/** Same-app return paths only, same law as the magic link's return_to:
 *  the apex root (the homepage desk, with or without a ?q= handoff) or an
 *  absolute /sase/ path. Anything else — including protocol-relative
 *  "//host" shapes — collapses to empty and the caller uses its default. */
export function safeReturnPath(raw: string): string {
  if (typeof raw !== "string" || raw.length > 400) return "";
  if (raw === "/") return "/";
  if (/^\/\?[\w\-.~%=&+]*$/.test(raw)) return raw;
  if (/^\/sase\/[\w\-/.~%?=&+]*$/.test(raw)) return raw;
  return "";
}

/** CSRF state + return path, packed into one short-lived HttpOnly cookie
 *  that rides the round trip to LinkedIn and back. */
export function packState(state: string, returnTo: string): string {
  return Buffer.from(JSON.stringify({ s: state, r: returnTo }), "utf8").toString("base64url");
}

export function unpackState(packed: string | null): { state: string; returnTo: string } | null {
  if (!packed) return null;
  try {
    const data = JSON.parse(Buffer.from(packed, "base64url").toString("utf8")) as { s?: unknown; r?: unknown };
    if (typeof data.s !== "string" || !data.s) return null;
    return { state: data.s, returnTo: safeReturnPath(typeof data.r === "string" ? data.r : "") };
  } catch {
    return null;
  }
}

export function stateCookieHeader(packed: string): string {
  // SameSite=Lax survives the top-level redirect back from LinkedIn; ten
  // minutes is generous for an OAuth round trip and short enough to rot.
  return `${LINKEDIN_STATE_COOKIE}=${packed}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`;
}

export function clearStateCookieHeader(): string {
  return `${LINKEDIN_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

/** Exchange the authorization code for an access token. Null on any
 *  failure; the caller bounces with a reason rather than guessing. */
export async function exchangeLinkedinCode(code: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
        redirect_uri: linkedinRedirectUri(),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { access_token?: string } | null;
    return data?.access_token ?? null;
  } catch {
    return null;
  }
}

export type LinkedinUser = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
};

/** The OIDC userinfo read: who LinkedIn says this is. Null on failure or
 *  on a shape without sub + email. */
export async function fetchLinkedinUserinfo(accessToken: string): Promise<LinkedinUser | null> {
  try {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { sub?: unknown; email?: unknown; email_verified?: unknown; name?: unknown }
      | null;
    if (!data || typeof data.sub !== "string" || typeof data.email !== "string" || !data.email.includes("@")) return null;
    return {
      sub: data.sub,
      email: data.email,
      ...(typeof data.email_verified === "boolean" ? { email_verified: data.email_verified } : {}),
      ...(typeof data.name === "string" && data.name ? { name: data.name } : {}),
    };
  } catch {
    return null;
  }
}
