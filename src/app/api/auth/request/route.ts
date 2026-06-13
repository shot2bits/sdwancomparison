import { corsHeaders, preflight } from "@/lib/cors";
import { createMagicToken, kvConfigured } from "@/lib/rfp-store";
import { sendMagicLink } from "@/lib/auth";
import { vendorForEmailDomain, isNetifyDomain, isBusinessDomain } from "@/lib/vendor-domains";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** Request a magic sign-in link. role: "supplier" requires a vendor or Netify domain. */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  let body: { email?: string; role?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role === "supplier" ? "supplier" : "buyer";
  const at = email.indexOf("@");
  if (at < 1 || !email.includes(".", at)) return Response.json({ error: "Enter a valid email." }, { status: 422, headers: cors });
  const domain = email.slice(at + 1);

  let resolvedRole: "supplier" | "buyer" | "netify" = role;
  let vendor_slug: string | null = null;

  if (role === "supplier") {
    if (isNetifyDomain(domain)) { resolvedRole = "netify"; vendor_slug = null; }
    else {
      vendor_slug = vendorForEmailDomain(domain);
      if (!vendor_slug) {
        // Do not leak which domains map to vendors; respond success-shaped.
        return Response.json({ ok: true, message: "If your organisation is a listed supplier, a sign-in link has been sent." }, { headers: cors });
      }
    }
  } else {
    if (!isBusinessDomain(domain)) return Response.json({ error: "Please use a business email address." }, { status: 422, headers: cors });
  }

  const token = await createMagicToken({ role: resolvedRole, email, vendor_slug });
  const sent = await sendMagicLink(email, token, resolvedRole);
  // In preview without Resend configured, return the link so it is testable.
  const devLink = sent ? undefined : `${SITE_URL}/auth/verify?token=${token}`;
  return Response.json({ ok: true, emailed: sent, dev_link: devLink, role: resolvedRole, vendor_slug }, { headers: cors });
}
