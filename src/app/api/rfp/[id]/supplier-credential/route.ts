import { resolveSupplierVendorToken, kvConfigured } from "@/lib/rfp-store";
import { supplierCredentialCookieHeader } from "@/lib/auth";
import { resolveCredentialExchangeFromFacts, cleanRespondUrl, type CredentialExchangeFact } from "@/lib/supplier-credential-exchange";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Credential-exchange endpoint (Robert's ruling, 9 Aug 2026, replacing
 * query-string `vt` delivery). Every new supplier invitation link now points
 * HERE first, not directly at the respond page: rfp-publish.ts's
 * supplier_url is `${SITE_URL}/api/rfp/{id}/supplier-credential?token=...&vt=...`.
 *
 * This validates the per-(RFP, vendor) bearer credential server-side EXACTLY
 * once (via resolveCredentialExchangeFromFacts, the pure decision this route
 * only gathers the fact for), establishes it as an HttpOnly/Secure/
 * SameSite=Lax cookie scoped to this RFP (supplierCredentialCookieHeader,
 * auth.ts), and redirects to the plain respond URL — which never carries
 * the credential again. The browser's address bar, its history, any copy of
 * that URL, SignIn.tsx's return_to capture and GA4's automatic
 * page-location beacon all see only the clean destination; the secret
 * itself never reaches client JS.
 *
 * A missing, invalid, or wrong-RFP `vt` is not an error worth surfacing:
 * this redirects to the SAME clean URL with no cookie set, and the respond
 * page's existing SignIn widget covers that caller exactly as it always has
 * for anyone arriving with no credential at all (an old pre-3B-2 link, or a
 * tampered one). This endpoint deliberately never renders anything and
 * never itself decides supplier identity — resolveSupplierPrincipal (called
 * downstream, from the cookie this sets) remains the single place that
 * decision is made, unchanged by this piece.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const vt = (url.searchParams.get("vt") ?? "").trim();
  const token = (url.searchParams.get("token") ?? "").trim();
  const dest = cleanRespondUrl(SITE_URL, id, token);

  const headers = new Headers({ Location: dest });
  if (kvConfigured() && vt) {
    const ref = await resolveSupplierVendorToken(vt);
    const tokenFact: CredentialExchangeFact = ref ? { rfpId: ref.rfp_id, vendorSlug: ref.vendor_slug } : null;
    const decision = resolveCredentialExchangeFromFacts(id, tokenFact);
    if (decision.redeem) {
      headers.append("Set-Cookie", supplierCredentialCookieHeader(id, vt));
    }
    // A token that resolves to nothing, or to a DIFFERENT rfp_id, is treated
    // identically to no token at all — redirected to the same clean URL,
    // no cookie set, no error surfaced. Do not report which case it was:
    // that would let a caller probe whether a given vt is valid for a given
    // RFP without ever needing to reach a route that checks it properly.
  }
  return new Response(null, { status: 302, headers });
}
