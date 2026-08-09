/**
 * Piece 3B-2 credential exchange (Robert's ruling, 9 Aug 2026, replacing
 * query-string `vt` delivery). The invitation's bearer credential is
 * validated exactly once, server-side, at
 * /api/rfp/[id]/supplier-credential (route.ts alongside this file), which
 * then hands off to resolveSupplierPrincipal (supplier-capability-access.ts)
 * for the identity DECISION exactly as every other capability already does —
 * this module is not a second identity check, only the plumbing around
 * turning a URL-borne credential into a cookie-borne one and back.
 *
 * Split into a pure core (this file) and a thin async route handler, the
 * same discipline supplier-capability-access.ts already established: the
 * part worth testing exhaustively — does THIS credential, for THIS RFP,
 * deserve a cookie? — takes already-resolved facts and has no I/O, so it is
 * testable with fixed fake facts instead of live KV/dataset state. The
 * route handler's only job is gathering that one fact (a KV lookup) and
 * building the actual HTTP redirect.
 */

export type CredentialExchangeFact = { rfpId: string; vendorSlug: string } | null;

export type CredentialExchangeDecision =
  | { redeem: true; vendorSlug: string }
  | { redeem: false };

/**
 * Pure decision: does this resolved token fact authorise a cookie for the
 * REQUESTED rfp? A token that resolves to nothing, or that resolves to a
 * DIFFERENT rfp than the one this endpoint was reached under, must not
 * establish a credential — mirroring resolveSupplierPrincipalFromFacts'
 * identical cross-RFP rule (test cases B/D/H there), now applied at the
 * point of issuance rather than only at the point of use.
 */
export function resolveCredentialExchangeFromFacts(
  requestedRfpId: string,
  tokenFact: CredentialExchangeFact,
): CredentialExchangeDecision {
  if (tokenFact && tokenFact.rfpId === requestedRfpId) {
    return { redeem: true, vendorSlug: tokenFact.vendorSlug };
  }
  return { redeem: false };
}

/**
 * The clean respond URL this endpoint always redirects to, whether or not
 * the credential was valid — a caller with an invalid/missing/wrong-RFP
 * token lands on exactly the same URL as a successful redemption, just
 * without a cookie, so the response itself never reveals which case
 * occurred (a caller cannot probe validity by watching the Location
 * header). Deliberately NEVER includes `vt`, under any input — this is the
 * one piece of the architecture responsible for guaranteeing that.
 */
export function cleanRespondUrl(siteUrl: string, rfpId: string, shareToken: string): string {
  const qs = shareToken ? `?token=${encodeURIComponent(shareToken)}` : "";
  return `${siteUrl}/rfp-builder/${rfpId}/respond${qs}`;
}
