import { corsHeaders, preflight } from "@/lib/cors";
import { sessionFromRequest } from "@/lib/auth";
import { kvConfigured, getVendorClaim, requestVendorClaim } from "@/lib/rfp-store";
import { emailDomain } from "@/lib/access-control";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Claim status for the signed-in supplier's own vendor profile.
 * Netify relay sessions can act for any vendor, so they need no claim.
 */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session) return Response.json({ error: "Sign in required.", auth_required: true }, { status: 401, headers: cors });
  if (session.role === "netify") {
    return Response.json({ ok: true, role: "netify", vendor_slug: null, status: "netify_all" }, { headers: cors });
  }
  const slug = session.vendor_slug;
  if (session.role !== "supplier" || !slug) {
    return Response.json({ ok: true, role: session.role, vendor_slug: null, status: "no_vendor" }, { headers: cors });
  }
  const claim = await getVendorClaim(slug);
  return Response.json({ ok: true, role: "supplier", vendor_slug: slug, status: claim?.status ?? "unclaimed", claim: claim ?? null }, { headers: cors });
}

/**
 * Request to claim the signed-in supplier's vendor profile. The supplier must
 * already be domain-verified to that vendor (vendor_slug set at sign-in). The
 * claim is recorded as pending for a Netify admin to approve; supplier write
 * actions stay blocked until then.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session) return Response.json({ error: "Sign in required.", auth_required: true }, { status: 401, headers: cors });
  if (session.role === "netify") {
    return Response.json({ ok: true, status: "netify_all", message: "Netify staff act for any vendor; no claim needed." }, { headers: cors });
  }
  if (session.role !== "supplier" || !session.vendor_slug) {
    return Response.json({ error: "Sign in with your domain-verified vendor email to claim a profile." }, { status: 403, headers: cors });
  }
  const domain = emailDomain(session.email) ?? "";
  const claim = await requestVendorClaim(session.vendor_slug, session.email, domain);
  return Response.json({ ok: true, vendor_slug: session.vendor_slug, status: claim.status }, { headers: cors });
}
