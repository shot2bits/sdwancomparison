/**
 * Project Foundation Piece 3A — the transport-neutral policy for "may this
 * caller submit a supplier response to this RFP, right now." Both the web
 * response route (api/rfp/[id]/respond/route.ts) and the MCP respond_to_rfp
 * tool (mcp-rfp-tools.ts) call resolveSupplierResponseAccess() below instead
 * of deciding independently, so the same real-world action enforces the same
 * rules regardless of which door it came through.
 *
 * Root cause this closes: the web route required (in order) an open RFP
 * phase, an unexpired response deadline, a claimed+admin-approved supplier
 * session matching the vendor being represented (or a Netify relay session,
 * see NETIFY RELAY below), and NDA acceptance where required. The MCP tool
 * checked only phase, and trusted a caller-supplied `vendor` string with no
 * identity binding at all — a materially weaker capability for the identical
 * real-world action (Robert's Piece 3A ruling, 8 Aug 2026).
 *
 * Design (per the architectural rule this piece must point toward): the
 * actor is never "MCP" or "web" — transport is metadata, not identity. This
 * module knows about exactly two actors that may ever submit a response:
 * `supplier` (a session, however it is one day obtained, established as the
 * exact claimed vendor being represented) and `netify` (a Netify relay
 * session, which may submit on behalf of any vendor by existing, intentional
 * design). Every other case is `supplier_identity_required` — no third
 * "MCP caller" actor is introduced, and no identity is ever synthesised from
 * a caller-supplied string.
 *
 * Two layers, deliberately:
 *  - evaluateSupplierResponseAccess(): PURE, synchronous, takes
 *    already-resolved domain facts. No KV, no cookies, no Request object.
 *    This is what the Piece 3A fixtures exercise directly, and it is what
 *    makes the parity test matrix (A-J) runnable without live storage.
 *  - resolveSupplierResponseAccess(): the thin async orchestrator that
 *    gathers those facts from the real Project, the caller's session (or
 *    lack of one), the vendor-claim store, and the NDA-acceptance store,
 *    then calls the pure evaluator. This is the one function both
 *    transports call.
 *
 * MCP today has no mechanism to produce a session at all (confirmed by
 * reading api/mcp/route.ts: tool handlers receive only the JSON-RPC
 * `arguments`, never the request's cookies) — so resolveSupplierResponseAccess
 * is always called with `session: null` from mcp-rfp-tools.ts today, which
 * deterministically denies with `supplier_identity_required`. That is the
 * intended, safe Piece 3A outcome per the critical safety rule: MCP is
 * temporarily unable to submit a response rather than submitting with
 * weaker identity proof than the browser. Piece 3B's job is to supply a real
 * principal into `session` for MCP — this module does not change again when
 * that happens, only its caller does.
 */

import { getVendorClaim, hasAcceptedNda, type AuthSession } from "@/lib/rfp-store";
import type { ProjectDetails } from "@/lib/rfp-types";
import { matchVendorSlug } from "@/lib/rfp-evaluation";

export type ResponseDenialReason =
  | "rfp_not_open"
  | "deadline_passed"
  | "supplier_identity_required"
  | "vendor_mismatch"
  | "claim_not_approved"
  | "nda_required";

export type ClaimStatus = "pending" | "approved" | "rejected" | null;

export type ResponseAccessDecision =
  | { allowed: true; actor: "supplier" | "netify"; vendor_slug: string | null; reason: null; claim_status: null }
  | { allowed: false; actor: "supplier" | "netify" | null; vendor_slug: string | null; reason: ResponseDenialReason; claim_status: ClaimStatus };

/** Already-resolved domain facts. Deliberately has no Request, no cookies,
 *  no KV calls inside evaluateSupplierResponseAccess — everything here is a
 *  plain value so the function is trivially unit-testable and transport-agnostic. */
export type SupplierResponseFacts = {
  /** project.status */
  projectStatus: string;
  /** project.response_deadline, or null/undefined if the RFP has none */
  responseDeadline: number | null | undefined;
  now: number;
  /** The resolved session, exactly as sessionFromRequest() returns it today.
   *  Always null under the current MCP transport. */
  session: AuthSession | null;
  /** matchVendorSlug(vendor) for the caller-supplied vendor text. */
  vendorSlug: string | null;
  /** getVendorClaim(session.vendor_slug)?.status, already resolved (null =
   *  no claim record at all, i.e. "unclaimed"). Irrelevant/unused for a
   *  netify-relay session. */
  claimStatus: ClaimStatus;
  ndaRequired: boolean;
  ndaAccepted: boolean;
};

const OPEN_STATUSES = new Set(["published", "qa"]);

/**
 * Pure decision core — no I/O. Mirrors, precisely, the web route's previous
 * inline order (phase, deadline, identity via requireClaimedSupplierFor's
 * logic, NDA), so this is a genuine extraction of the existing policy, not a
 * new one, with MCP's missing deadline/claim/NDA checks folded in.
 */
export function evaluateSupplierResponseAccess(facts: SupplierResponseFacts): ResponseAccessDecision {
  if (!OPEN_STATUSES.has(facts.projectStatus)) {
    return { allowed: false, actor: null, vendor_slug: null, reason: "rfp_not_open", claim_status: null };
  }
  if (facts.responseDeadline && facts.now > facts.responseDeadline) {
    return { allowed: false, actor: null, vendor_slug: null, reason: "deadline_passed", claim_status: null };
  }

  const session = facts.session;
  if (!session) {
    return { allowed: false, actor: null, vendor_slug: null, reason: "supplier_identity_required", claim_status: null };
  }

  // NETIFY RELAY (intentional, pre-existing behaviour — mirrors
  // requireClaimedSupplierFor in auth.ts): a Netify session may submit a
  // response on behalf of any vendor, with no claim-approval check. This is
  // an internal, session-authenticated capability, not caller-text spoofing
  // (see the module doc) — preserved deliberately per Robert's ruling #10.
  if (session.role === "netify") {
    if (!(facts.ndaRequired ? facts.ndaAccepted : true)) {
      return { allowed: false, actor: "netify", vendor_slug: facts.vendorSlug, reason: "nda_required", claim_status: null };
    }
    return { allowed: true, actor: "netify", vendor_slug: facts.vendorSlug, reason: null, claim_status: null };
  }

  // Everything else — no session role match, a buyer session, a supplier
  // session for a DIFFERENT vendor than the one named in `vendor` — is the
  // same outcome: this session does not establish the identity being
  // claimed. (Matches requireClaimedSupplierFor's single fallthrough 403.)
  if (session.role !== "supplier" || !session.vendor_slug || session.vendor_slug !== facts.vendorSlug) {
    return { allowed: false, actor: null, vendor_slug: null, reason: "vendor_mismatch", claim_status: null };
  }

  if (facts.claimStatus !== "approved") {
    return { allowed: false, actor: "supplier", vendor_slug: facts.vendorSlug, reason: "claim_not_approved", claim_status: facts.claimStatus };
  }

  if (facts.ndaRequired && !facts.ndaAccepted) {
    return { allowed: false, actor: "supplier", vendor_slug: facts.vendorSlug, reason: "nda_required", claim_status: null };
  }

  return { allowed: true, actor: "supplier", vendor_slug: facts.vendorSlug, reason: null, claim_status: null };
}

/**
 * The shared orchestrator. Gathers real facts (KV-backed claim/NDA lookups,
 * exactly the same helpers the web route already used) and calls the pure
 * policy above. Both api/rfp/[id]/respond/route.ts (POST) and
 * mcp-rfp-tools.ts's respond_to_rfp call THIS function — not their own
 * inline checks — so the two transports cannot diverge on this question
 * again without editing the same file.
 */
export async function resolveSupplierResponseAccess(params: {
  project: ProjectDetails;
  vendor: string;
  session: AuthSession | null;
  now?: number;
}): Promise<ResponseAccessDecision> {
  const { project, vendor, session } = params;
  const now = params.now ?? Date.now();
  const vendorSlug = matchVendorSlug(vendor);
  const baseFacts = {
    projectStatus: project.status,
    responseDeadline: project.response_deadline,
    now,
    session,
    vendorSlug,
  };

  // Stage 1 — everything decidable with no I/O: phase, deadline, whether a
  // session exists at all, and whether it matches the vendor being
  // represented. Evaluated with optimistic claim/NDA placeholders (which can
  // only make the result MORE permissive, never less), so if it still
  // denies here, fetching the real claim/NDA records cannot change the
  // answer — this is what keeps MCP's always-null-session respond_to_rfp
  // calls from doing a live KV round-trip on every call just to be told
  // supplier_identity_required regardless. See the module doc.
  const preliminary = evaluateSupplierResponseAccess({
    ...baseFacts,
    claimStatus: "approved",
    ndaRequired: false,
    ndaAccepted: true,
  });
  if (!preliminary.allowed && preliminary.reason !== "claim_not_approved" && preliminary.reason !== "nda_required") {
    return preliminary;
  }

  // Stage 2 — the real, KV-backed facts. Claim status is only meaningful
  // for a supplier session (a netify relay bypasses claim entirely, per the
  // pure evaluator); NDA acceptance is only fetched when the RFP actually
  // requires one.
  let claimStatus: ClaimStatus = null;
  if (session?.role === "supplier" && session.vendor_slug) {
    const claim = await getVendorClaim(session.vendor_slug);
    claimStatus = claim?.status ?? null;
  }
  const ndaRequired = Boolean(project.nda?.required);
  const ndaAccepted = ndaRequired ? await hasAcceptedNda(project, vendor) : true;

  return evaluateSupplierResponseAccess({ ...baseFacts, claimStatus, ndaRequired, ndaAccepted });
}

/** Human-readable denial messages, shared so the web route and the MCP tool
 *  say the same thing for the same reason (transport adapters may still wrap
 *  these in their own response envelope — status code for HTTP, structured
 *  { error, allowed:false } for MCP). */
export const RESPONSE_DENIAL_MESSAGES: Record<ResponseDenialReason, string> = {
  rfp_not_open: "This RFP is not open for responses.",
  deadline_passed: "The response window for this RFP has closed.",
  supplier_identity_required:
    "A verified supplier identity is required to submit a response. Sign in as this vendor to respond.",
  vendor_mismatch: "Your sign-in does not match this vendor.",
  claim_not_approved: "Claim your company profile and wait for Netify to approve it before acting as this vendor.",
  nda_required: "This RFP requires you to accept the buyer's NDA before responding.",
};
