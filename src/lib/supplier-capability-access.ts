/**
 * Project Foundation Piece 3B-2 — the shared identity question for every
 * supplier-private capability that is NOT submitting a response. That one
 * (respond_to_rfp) already asks this question correctly and once, via
 * resolveSupplierResponseAccess() (Piece 3A, live and verified since 9 Aug
 * 2026). Three other capabilities — the clarification thread, NDA
 * acceptance, and the evidence draft — asked no such question at all: each
 * accepted the RFP-wide share_token plus a caller-supplied free-text vendor
 * name as if that were proof of identity. It never was.
 *
 * HYBRID MODEL (Robert's ruling, 9 Aug 2026, replacing this module's first,
 * halted "mandatory session" design). The first version of this module made
 * a real supplier sign-in a hard prerequisite for all three capabilities.
 * That crossed a decision boundary the governing brief had put in place: it
 * confirmed the current product intentionally supports anonymous, link-only
 * supplier participation, and required a STOP before silently ending it.
 * Robert's ruling: keep that low-friction journey. Netify already runs
 * exactly this shape in two live, unmodified flows — opportunity_token
 * (rfp-store.ts) and SupplierConnection.token (rfp-connect.ts) — where a
 * per-vendor bearer credential alone authorises reads and low-stakes writes,
 * and a claimed, approved supplier session is required only for the
 * consequential ones. auth.ts's own header comment already names this
 * intent: "Reading and building stay open; only identity-asserting writes
 * consult requireSupplier." This module now asks the SAME two-tier question
 * for the three capabilities in this piece's scope, using a NEW, dedicated
 * per-(RFP, vendor) credential (getOrCreateSupplierVendorToken,
 * rfp-store.ts) rather than overloading SupplierConnection.token, which
 * belongs to a different feature (the connect/messaging thread) with its
 * own lifecycle.
 *
 * TWO TIERS:
 *  - "credential": the bearer token for this (RFP, vendor) pair, OR any
 *    supplier session for that vendor (claimed or not), OR the Netify relay.
 *    Sufficient for: reading/posting to the clarification thread, reading
 *    NDA status, reading the evidence draft.
 *  - "claimed": a supplier session for that vendor with an
 *    ADMIN-APPROVED profile claim (or the Netify relay). Required
 *    additionally for: accepting the NDA — a legally significant act,
 *    deliberately held to the same bar as respond_to_rfp
 *    (requireClaimedSupplierFor), not the lower bar the rest of this module
 *    grants. Routes needing this tier call requireClaimedSupplierFor
 *    directly after establishing the principal here, rather than
 *    duplicating that check inside this module.
 *
 * Deliberately a NEW module rather than an extension of
 * rfp-response-access.ts: that file is already shipped, live and verified
 * (Piece 3A). Touching it here would add regression risk to already-correct
 * code for no benefit this bounded piece needs. A true single primitive
 * shared across every supplier capability, including respond, is Piece
 * 3B-1's job (actor-identity unification), not this one's.
 *
 * LAZY ISSUANCE (Robert's ruling #5): RFPs published before this piece
 * shipped only ever handed out the RFP-wide share_token — no per-vendor
 * credential exists for them yet. This module does not, and cannot, invent
 * one from an old link alone (that would just reintroduce the
 * shared-token/vendor-text vulnerability under a new name). Instead: once a
 * claimed supplier session genuinely establishes a vendor for an RFP —
 * proven by the session, never by a bearer token or free text — this module
 * mints (or confirms) that vendor's credential as a side effect, so it
 * exists for every subsequent request and for any future resend of the
 * invitation. A caller who has neither a credential nor a session for an old
 * RFP is, correctly, asked to sign in once; that is the one, honest,
 * necessary cost of a link minted before a per-vendor credential existed.
 */

import {
  type AuthSession,
  getVendorClaim,
  getOrCreateSupplierVendorToken,
  resolveSupplierVendorToken,
} from "@/lib/rfp-store";
import { matchVendorSlug } from "@/lib/rfp-evaluation";

export type SupplierPrincipalTier = "credential" | "claimed";
export type SupplierPrincipalReason = "supplier_identity_required" | "vendor_mismatch";

export type SupplierPrincipal =
  | { established: true; actor: "supplier" | "netify"; vendorSlug: string; tier: SupplierPrincipalTier }
  | { established: false; actor: null; vendorSlug: null; tier: null; reason: SupplierPrincipalReason };

export type SupplierVendorTokenFact = { rfpId: string; vendorSlug: string } | null;

/**
 * PURE, synchronous, no I/O — mirrors evaluateSupplierResponseAccess()
 * deliberately (Piece 3A's pure decision core): every fact this needs
 * (the resolved bearer-token reference, whether the session's claim is
 * approved, the Netify relay's matched vendor) is gathered by the async
 * wrapper below and handed in already-resolved, so the DECISION itself is
 * testable with fixed, fake facts instead of live KV/dataset state.
 */
export function resolveSupplierPrincipalFromFacts(
  requestRfpId: string,
  tokenFact: SupplierVendorTokenFact,
  session: AuthSession | null,
  claimApproved: boolean,
  relayVendorSlug: string | null,
): SupplierPrincipal {
  const tokenVendor = tokenFact && tokenFact.rfpId === requestRfpId ? tokenFact.vendorSlug : null;

  // NETIFY RELAY (intentional, pre-existing behaviour — mirrors
  // requireSupplierFor / requireClaimedSupplierFor in auth.ts and the
  // identical branch in resolveSupplierResponseAccess): a Netify session may
  // act on behalf of any vendor it can name or whose credential it holds.
  // Relay has no vendor of its own, so nothing here means it always reaches
  // the "claimed" tier — Netify staff are treated as already-verified.
  if (session?.role === "netify") {
    const vendorSlug = relayVendorSlug ?? tokenVendor;
    return vendorSlug
      ? { established: true, actor: "netify", vendorSlug, tier: "claimed" }
      : { established: false, actor: null, vendorSlug: null, tier: null, reason: "vendor_mismatch" };
  }

  const sessionVendor = session?.role === "supplier" ? (session.vendor_slug ?? null) : null;

  if (sessionVendor) {
    // The session is the stronger proof. A bearer token for a DIFFERENT
    // vendor presented alongside it is a real conflict, not noise — deny
    // rather than silently prefer one over the other.
    if (tokenVendor && tokenVendor !== sessionVendor) {
      return { established: false, actor: null, vendorSlug: null, tier: null, reason: "vendor_mismatch" };
    }
    return { established: true, actor: "supplier", vendorSlug: sessionVendor, tier: claimApproved ? "claimed" : "credential" };
  }

  // No session, or a session that asserts no vendor of its own (a buyer
  // session, or a malformed supplier session with no vendor_slug) — that
  // must never block a valid bearer credential, since the credential proves
  // identity entirely on its own, independent of whoever else may also be
  // signed in.
  if (tokenVendor) {
    return { established: true, actor: "supplier", vendorSlug: tokenVendor, tier: "credential" };
  }
  return { established: false, actor: null, vendorSlug: null, tier: null, reason: "supplier_identity_required" };
}

/**
 * The async orchestrator every route calls: resolves the raw bearer token
 * (if any) via KV, resolves the session's claim-approval status (if any),
 * resolves the Netify relay's free-text vendor claim via matchVendorSlug
 * (the same fuzzy match every other capability in this codebase already
 * uses — reserved for the relay case only; a non-relay, non-session caller's
 * free text is never trusted as identity), hands off to the pure core above,
 * and — only when a claimed session genuinely established the principal —
 * lazily ensures that vendor's bearer credential exists for next time
 * (Robert's ruling #5).
 */
export async function resolveSupplierPrincipal(
  session: AuthSession | null,
  requestRfpId: string,
  vendorTokenRaw: string | null,
  relayVendorText: string,
): Promise<SupplierPrincipal> {
  const tokenRef = vendorTokenRaw ? await resolveSupplierVendorToken(vendorTokenRaw) : null;
  const tokenFact: SupplierVendorTokenFact = tokenRef ? { rfpId: tokenRef.rfp_id, vendorSlug: tokenRef.vendor_slug } : null;
  const claimApproved =
    session?.role === "supplier" && session.vendor_slug
      ? (await getVendorClaim(session.vendor_slug))?.status === "approved"
      : false;
  const relayVendorSlug = session?.role === "netify" && relayVendorText.trim() ? matchVendorSlug(relayVendorText) : null;

  const principal = resolveSupplierPrincipalFromFacts(requestRfpId, tokenFact, session, claimApproved, relayVendorSlug);

  if (principal.established && principal.actor === "supplier" && principal.tier === "claimed") {
    try {
      await getOrCreateSupplierVendorToken(requestRfpId, principal.vendorSlug);
    } catch {
      /* best effort — a credential-issuance hiccup must never fail an
         otherwise-successful, session-proven request. */
    }
  }

  return principal;
}

/** Human-readable denial messages, shared so every route that uses this
 *  resolver says the same thing for the same reason. */
export const SUPPLIER_PRINCIPAL_DENIAL_MESSAGES: Record<SupplierPrincipalReason, string> = {
  supplier_identity_required:
    "This response link doesn't include a valid supplier credential for this RFP. Use the full link from your invitation, or sign in as this vendor.",
  vendor_mismatch: "Your sign-in does not match this vendor.",
};
