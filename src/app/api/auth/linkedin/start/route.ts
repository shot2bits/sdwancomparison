import { kvConfigured } from "@/lib/rfp-store";
import {
  LINKEDIN_ERROR_PATH,
  linkedinAuthUrl,
  linkedinConfigured,
  packState,
  safeReturnPath,
  stateCookieHeader,
} from "@/lib/linkedin";

export const runtime = "nodejs";

/**
 * Begin LinkedIn sign-in (buyer lane): set the CSRF state cookie and hand
 * the browser to LinkedIn's authorization page. ?return= carries where
 * the person was (same-app paths only) so the callback can put them back.
 * Unconfigured or storageless deployments bounce to the account page's
 * sign-in box with a reason instead of erroring.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const bounce = (reason: string) =>
    new Response(null, {
      status: 302,
      headers: { location: `${LINKEDIN_ERROR_PATH}?li_error=${reason}`, "cache-control": "no-store" },
    });
  if (!linkedinConfigured()) return bounce("config");
  if (!kvConfigured()) return bounce("storage");
  const returnTo = safeReturnPath(url.searchParams.get("return") ?? "");
  const state = crypto.randomUUID().replace(/-/g, "");
  return new Response(null, {
    status: 302,
    headers: {
      location: linkedinAuthUrl(state),
      "set-cookie": stateCookieHeader(packState(state, returnTo)),
      "cache-control": "no-store",
    },
  });
}
