import { corsHeaders, preflight } from "@/lib/cors";
import { createMagicToken, kvConfigured, kvGetJson, kvSetJson, kvRaw, recordPendingRequest, isBuyerAllowedDomain, recordRejectedAttempt } from "@/lib/rfp-store";
import { sendMagicLink } from "@/lib/auth";
import {
  isBlockedDomainLive,
  isAcademicDomain,
  vendorForEmailDomainLive,
  isNetifyDomainLive,
  isAdminEmail,
  emailDomain,
} from "@/lib/access-control";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Request a magic sign-in link.
 * Policy: free webmail and disposable domains are rejected for every role.
 * Admin allowlist emails are exempt so the console stays reachable. Supplier
 * sign-in resolves a vendor by domain; an unrecognised business domain is
 * queued as a pending access request for an admin to approve.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  let body: { email?: string; role?: string; return_to?: string; marketing_opt_in?: boolean; attribution?: { ref?: unknown; landing?: unknown } | null };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role === "supplier" ? "supplier" : "buyer";
  const domain = emailDomain(email);
  if (!domain) return Response.json({ error: "Enter a valid email." }, { status: 422, headers: cors });

  // Where the sign-in was requested from, carried through the magic link so
  // the verify page can send the person straight back afterwards. Same-app
  // absolute paths only (basePath /sase), so the link can never point off-site.
  const rawReturn = typeof body.return_to === "string" ? body.return_to : "";
  const returnTo = rawReturn.length <= 400 && /^\/sase\/[\w\-/.~%?=&]*$/.test(rawReturn) ? rawReturn : "";

  const admin = isAdminEmail(email);

  // Business-only identity policy, enforced for every role. Admins are exempt.
  //
  // Academic and research domains queue for admin approval instead of hard
  // blocking (Harry's UEA point, decided 14 July 2026): a university IT team
  // is a legitimate SASE buyer, while student sign-ups get filtered by the
  // review. Approved domains land on the buyer allowlist and sign in freely.
  if (!admin && isAcademicDomain(domain) && !(await isBuyerAllowedDomain(domain))) {
    try { await recordPendingRequest(email, domain, role); } catch { /* best effort */ }
    return Response.json(
      { ok: true, message: "Thanks. Academic and research addresses are reviewed before access, because the marketplace supports commercial procurement. The Netify team will check your request (usually within one working day) and email your sign-in link once approved. The question bank, methodology and sample RFP pages are open to read meanwhile." },
      { headers: cors },
    );
  }
  if (!admin && (await isBlockedDomainLive(domain))) {
    try { await recordRejectedAttempt(domain, "webmail"); } catch { /* best effort */ }
    return Response.json(
      { error: "Please use your organisation email. Free and personal email addresses are not accepted." },
      { status: 422, headers: cors },
    );
  }

  let resolvedRole: "supplier" | "buyer" | "netify" = role;
  let vendor_slug: string | null = null;

  if (role === "supplier") {
    if (isNetifyDomainLive(domain)) {
      resolvedRole = "netify";
      vendor_slug = null;
    } else {
      vendor_slug = await vendorForEmailDomainLive(domain);
      if (!vendor_slug) {
        // Business domain not yet approved for any vendor: queue it for admin
        // review rather than silently blocking. Respond success-shaped so we
        // never confirm which domains map to vendors.
        if (!admin) {
          try { await recordPendingRequest(email, domain); } catch { /* best effort */ }
          return Response.json(
            { ok: true, message: "Thanks. Your registration request is queued. Your email domain isn't yet linked to a supplier profile, so the Netify team will review it (usually within one working day) and email your sign-in link once approved. No need to do anything else." },
            { headers: cors },
          );
        }
        // An admin on the supplier tab with no vendor match: treat as Netify relay.
        resolvedRole = "netify";
      }
    }
  }

  // If the sign-in was requested from a specific draft (the wizard's submit
  // step or a builder page), carry the RFP id inside the magic token so the
  // verify endpoint can claim the draft server-side. This makes ownership
  // survive the common cross-device pattern: build on the desktop, open the
  // sign-in email on the phone, where localStorage-based claiming cannot see
  // the draft.
  const rfpIdMatch = returnTo.match(/\/rfp-builder\/(rfp_[a-z0-9]+)/i);
  // Sign-up attribution, carried through the magic link so the new-sign-up
  // alert can say where the person came from: client-captured first touch
  // (original referrer + landing path, sessionStorage), the page hosting the
  // sign-in form (Referer header) and the country Vercel resolved. Strings
  // capped; everything optional and best effort.
  const cap = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  const attr = {
    ref: cap(body.attribution?.ref, 300),
    landing: cap(body.attribution?.landing, 300),
    page: cap(req.headers.get("referer"), 300),
    country: cap(req.headers.get("x-vercel-ip-country"), 8),
  };
  const token = await createMagicToken({ role: resolvedRole, email, vendor_slug, rfp_id: rfpIdMatch ? rfpIdMatch[1] : null, attr });
  // Optional marketing consent from the wizard agreement step: explicit,
  // unticked by default, recorded only when the sign-in link actually goes
  // out to a domain that passed the business-only policy.
  if (body.marketing_opt_in === true) {
    try {
      const key = "email:marketing_optin";
      const list = (await kvGetJson<string[]>(key)) ?? [];
      if (!list.includes(email)) { list.push(email); await kvSetJson(key, list); }
    } catch { /* best effort */ }
  }

  // Same-screen 6-digit code (18 July 2026): corporate link scanners and
  // cross-device email opening break magic links for real buyers (observed in
  // the stuck-at-email cohort). The code maps to the SAME magic token, so
  // consuming it inherits everything the link does — draft claim, pending
  // submit, session. 15 minute expiry, 5 attempts, one code per email.
  let code: string | undefined;
  try {
    code = String(Math.floor(100000 + Math.random() * 900000));
    const codeKey = `auth:code:${email}`;
    await kvSetJson(codeKey, { token, code, attempts: 0, expires: Date.now() + 15 * 60 * 1000 });
    await kvRaw(["PEXPIRE", codeKey, 15 * 60 * 1000]);
  } catch { code = undefined; /* code is an enhancement; the link still works */ }

  const sent = await sendMagicLink(email, token, resolvedRole, returnTo, code);
  // In preview without Resend configured, return the link so it is testable.
  const devLink = sent ? undefined : `${SITE_URL}/auth/verify?token=${token}${returnTo ? `&return=${encodeURIComponent(returnTo)}` : ""}`;
  return Response.json({ ok: true, emailed: sent, dev_link: devLink, role: resolvedRole, vendor_slug, code_available: Boolean(code) }, { headers: cors });
}
