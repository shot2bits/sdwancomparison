import { createSession, getProject, kvConfigured, markSignupSeen, saveProject } from "@/lib/rfp-store";
import { executePublish } from "@/lib/rfp-publish";
import { notifyNewSignup, parseCookie, sessionCookieHeader } from "@/lib/auth";
import { type BuyerProfile, getBuyerProfile, saveBuyerProfile } from "@/lib/buyer-profile";
import {
  LINKEDIN_ERROR_PATH,
  LINKEDIN_STATE_COOKIE,
  clearStateCookieHeader,
  exchangeLinkedinCode,
  fetchLinkedinUserinfo,
  linkedinConfigured,
  unpackState,
} from "@/lib/linkedin";

export const runtime = "nodejs";

/**
 * Complete LinkedIn sign-in: verify the CSRF state, exchange the code,
 * read the OIDC userinfo, and mint the same buyer session the magic link
 * mints. The draft-claim and pending-submit behaviour mirrors the verify
 * route exactly — a person who pressed publish, chose LinkedIn and came
 * back gets their draft claimed and their pending submission completed —
 * so the two sign-in doors are indistinguishable from inside the app.
 * Every failure bounces to the account page's sign-in box with a reason;
 * the email lane is always the fallback.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const st = unpackState(parseCookie(req, LINKEDIN_STATE_COOKIE));
  const fail = (reason: string) => {
    const headers = new Headers({
      location: `${LINKEDIN_ERROR_PATH}?li_error=${reason}`,
      "cache-control": "no-store",
    });
    headers.append("set-cookie", clearStateCookieHeader());
    return new Response(null, { status: 302, headers });
  };

  if (!linkedinConfigured() || !kvConfigured()) return fail("config");
  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !st || st.state !== state) return fail("state");

  const accessToken = await exchangeLinkedinCode(code);
  if (!accessToken) return fail("exchange");
  const user = await fetchLinkedinUserinfo(accessToken);
  const email = user?.email.trim().toLowerCase() ?? "";
  if (!user || !email || user.email_verified === false) return fail("email");

  // Buyer session, same mint as the magic link. vendor_slug stays null:
  // supplier identity is domain-verified and never enters through this door.
  const session = await createSession({ role: "buyer", email, vendor_slug: null });

  // Server-side draft claim and submit, the verify route's contract: if the
  // sign-in started from a specific draft, attach it to this email now, and
  // when the draft carries a wizard-submit intent, complete the submission.
  // Never claims over an existing owner, never blocks sign-in.
  const rfpId = st.returnTo.match(/\/rfp-builder\/(rfp_[a-z0-9]+)/i)?.[1] ?? null;
  try {
    if (rfpId) {
      let project = await getProject(rfpId);
      if (project && !project.owner_email) {
        project.owner_email = email;
        project = await saveProject(project);
      }
      if (project && project.pending_submit && project.status !== "published" && project.owner_email === email) {
        await executePublish(project, email, project.pending_submit);
      }
    }
  } catch { /* non-fatal */ }

  // The buyer profile (24 July, Robert: the team needs the person's name
  // and company). LinkedIn's sign-in gives us the name; store it now, and
  // keep the FIRST sign-in's acquisition context so the completion alert
  // can still say how this buyer originally arrived. Internal only, never
  // shown to suppliers, never on the board.
  let profile: BuyerProfile | null = null;
  try {
    profile = await getBuyerProfile(email);
    profile = (await saveBuyerProfile(email, {
      name: user.name,
      via: "linkedin",
      linkedin_sub: user.sub,
      ...(profile?.signup_attr
        ? {}
        : {
            signup_attr: {
              ref: "LinkedIn sign-in (OpenID Connect)",
              landing: st.returnTo || "/",
              country: req.headers.get("x-vercel-ip-country") ?? "",
            },
          }),
    })) ?? profile;
  } catch { /* non-fatal */ }

  // The alert (Robert's ruling, 24 July, third of the evening): ONE email
  // per buyer, sent when the signup is complete, which on this lane means
  // when the company lands on the welcome step. The profile API sends it,
  // so nothing is announced here. The one exception, ruled with it: a
  // sign-in carrying an RFP alerts immediately whatever the company
  // state, because a live publish must never go silent.
  try {
    if (rfpId && (await markSignupSeen(email, "buyer"))) {
      await notifyNewSignup(email, "buyer", {
        attr: {
          ref: "LinkedIn sign-in (OpenID Connect)",
          landing: st.returnTo || "/",
          page: "",
          country: req.headers.get("x-vercel-ip-country") ?? "",
        },
        rfp_attached: true,
        profile: { name: user.name, company: profile?.company },
      });
    }
  } catch { /* non-fatal */ }

  // Destination (Robert's ruling, 24 July evening): the company is
  // mandatory on this lane, so route on the missing fact rather than on
  // first sign-in. Any LinkedIn session without a stored company meets
  // the welcome question, every time, until the buyer answers it. If the
  // profile read fails the welcome page's own passthrough lets them on:
  // the requirement is that they state it, never that our storage is up.
  const destination = profile?.company
    ? st.returnTo || "/"
    : `/sase/auth/welcome?return=${encodeURIComponent(st.returnTo || "/")}`;
  const headers = new Headers({ location: destination, "cache-control": "no-store" });
  headers.append("set-cookie", sessionCookieHeader(session.token));
  headers.append("set-cookie", clearStateCookieHeader());
  return new Response(null, { status: 302, headers });
}
