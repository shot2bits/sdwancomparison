import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail, isFreeEmailDomainStatic, emailDomain } from "@/lib/access-control";
import { companyNameFromDomain } from "@/lib/verify-business";

export const runtime = "nodejs";

/** Current session (or null). Used by the UI to show signed-in state.
 *
 *  The identity read (29 Jul 2026, Robert's mockup review: the buyer sees
 *  their verification state where they work, not at the moment of
 *  refusal): `work_address` says whether the session email can publish,
 *  and `company_hint` is the company as Netify derives it from the
 *  domain, the same derivation the publish chain records. Static list
 *  check only, so this endpoint stays one KV read; the publish chain in
 *  lib/rfp-publish remains the authority and runs the live checks.
 *
 *  The `linkedin` flag is gone with the lane it described (removed 29
 *  Jul 2026: business email only, no other sign-in door).
 */
export async function GET(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s) return Response.json({ authenticated: false });
  const domain = emailDomain(s.email) ?? "";
  const work_address = Boolean(domain) && !isFreeEmailDomainStatic(domain);
  return Response.json({
    authenticated: true,
    role: s.role,
    email: s.email,
    vendor_slug: s.vendor_slug,
    admin: isAdminEmail(s.email),
    work_address,
    company_hint: work_address ? companyNameFromDomain(domain) : null,
  });
}
