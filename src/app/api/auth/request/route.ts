import { corsHeaders, preflight } from "@/lib/cors";
import { createMagicToken, kvConfigured, recordPendingRequest } from "@/lib/rfp-store";
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
  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role === "supplier" ? "supplier" : "buyer";
  const domain = emailDomain(email);
  if (!domain) return Response.json({ error: "Enter a valid email." }, { status: 422, headers: cors });

  const admin = isAdminEmail(email);

  // Business-only identity policy, enforced for every role. Admins are exempt.
  if (!admin && isAcademicDomain(domain)) {
    return Response.json(
      { error: "The Netify marketplace supports commercial procurement, so academic and research email addresses are not accepted. The question bank, methodology and sample RFP pages are open to read without an account." },
      { status: 422, headers: cors },
    );
  }
  if (!admin && (await isBlockedDomainLive(domain))) {
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
            { ok: true, message: "Thanks — your registration request is queued. Your email domain isn't yet linked to a supplier profile, so the Netify team will review it (usually within one working day) and email your sign-in link once approved. No need to do anything else." },
            { headers: cors },
          );
        }
        // An admin on the supplier tab with no vendor match: treat as Netify relay.
        resolvedRole = "netify";
      }
    }
  }

  const token = await createMagicToken({ role: resolvedRole, email, vendor_slug });
  const sent = await sendMagicLink(email, token, resolvedRole);
  // In preview without Resend configured, return the link so it is testable.
  const devLink = sent ? undefined : `${SITE_URL}/auth/verify?token=${token}`;
  return Response.json({ ok: true, emailed: sent, dev_link: devLink, role: resolvedRole, vendor_slug }, { headers: cors });
}
