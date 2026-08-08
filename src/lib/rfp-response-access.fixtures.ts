/**
 * Project Foundation Piece 3A test suite. Exercises evaluateSupplierResponseAccess
 * directly — the pure, synchronous decision core — so it runs with no KV, no
 * cookies, no live storage, following the estate's fixtures pattern (pure
 * vectors plus an exported runner). This is the required parity test matrix
 * (A-J) from the Piece 3A implementation prompt.
 */

import { evaluateSupplierResponseAccess, type SupplierResponseFacts } from "./rfp-response-access";
import type { AuthSession } from "./rfp-store";

export interface ResponseAccessTestResult { pass: number; fail: number; failures: string[] }

const NOW = 1_700_000_000_000;
const OPEN_DEADLINE = NOW + 1_000_000; // still open
const PASSED_DEADLINE = NOW - 1_000_000; // already closed

const supplierSession = (vendor_slug: string): AuthSession => ({
  token: "tok_sess",
  role: "supplier",
  email: "sales@acme.example",
  vendor_slug,
  created: NOW - 1000,
  expires: NOW + 1000,
});

const netifySession = (vendor_slug: string | null = null): AuthSession => ({
  token: "tok_netify",
  role: "netify",
  email: "ops@netify.com",
  vendor_slug,
  created: NOW - 1000,
  expires: NOW + 1000,
});

const buyerSession = (): AuthSession => ({
  token: "tok_buyer",
  role: "buyer",
  email: "buyer@example.com",
  vendor_slug: null,
  created: NOW - 1000,
  expires: NOW + 1000,
});

/** A fully-eligible baseline: published RFP, open deadline, claimed +
 *  approved supplier for the exact vendor named, no NDA required. Each test
 *  case overrides exactly the one dimension it's testing. */
const BASE: SupplierResponseFacts = {
  projectStatus: "published",
  responseDeadline: OPEN_DEADLINE,
  now: NOW,
  session: supplierSession("acme-networks"),
  vendorSlug: "acme-networks",
  claimStatus: "approved",
  ndaRequired: false,
  ndaAccepted: false,
};

export function runResponseAccessTests(): ResponseAccessTestResult {
  const r: ResponseAccessTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = (name: string, fn: () => void) => {
    try { fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const assert = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

  // A. VALID SUPPLIER — published/qa, deadline open, correct claimed +
  // approved supplier, NDA accepted where required -> allow.
  ok("A1. valid claimed+approved supplier, no NDA required -> allow", () => {
    const d = evaluateSupplierResponseAccess(BASE);
    assert(d.allowed === true, `expected allow, got ${JSON.stringify(d)}`);
    assert(d.allowed && d.actor === "supplier", "actor should be supplier");
    assert(d.allowed && d.vendor_slug === "acme-networks", "vendor_slug should be the matched vendor");
  });
  ok("A2. status 'qa' (not just 'published') is also open -> allow", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, projectStatus: "qa" });
    assert(d.allowed === true, `expected allow, got ${JSON.stringify(d)}`);
  });
  ok("A3. no deadline set at all -> allow (no deadline means no cutoff)", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, responseDeadline: null });
    assert(d.allowed === true, `expected allow, got ${JSON.stringify(d)}`);
  });

  // B. WRONG SUPPLIER — identity does not match the invited/represented vendor.
  ok("B. supplier session for a DIFFERENT vendor than the one named -> deny vendor_mismatch", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, session: supplierSession("some-other-vendor") });
    assert(!d.allowed, "expected deny");
    assert(!d.allowed && d.reason === "vendor_mismatch", `expected vendor_mismatch, got ${JSON.stringify(d)}`);
    assert(!d.allowed && d.vendor_slug === null, "no vendor_slug should be granted on a mismatch");
  });
  ok("B2. buyer session (wrong role entirely) -> deny vendor_mismatch (same fallthrough as a wrong-vendor supplier)", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, session: buyerSession() });
    assert(!d.allowed && d.reason === "vendor_mismatch", `expected vendor_mismatch, got ${JSON.stringify(d)}`);
  });

  // C. UNCLAIMED SUPPLIER — vendor exists but claim is not approved.
  ok("C1. supplier session matches vendor but claim is pending -> deny claim_not_approved", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, claimStatus: "pending" });
    assert(!d.allowed && d.reason === "claim_not_approved", `expected claim_not_approved, got ${JSON.stringify(d)}`);
    assert(!d.allowed && d.claim_status === "pending", "claim_status should be surfaced for the caller");
  });
  ok("C2. no claim record at all (unclaimed) -> deny claim_not_approved", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, claimStatus: null });
    assert(!d.allowed && d.reason === "claim_not_approved", `expected claim_not_approved, got ${JSON.stringify(d)}`);
  });
  ok("C3. claim explicitly rejected -> deny claim_not_approved", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, claimStatus: "rejected" });
    assert(!d.allowed && d.reason === "claim_not_approved", `expected claim_not_approved, got ${JSON.stringify(d)}`);
  });

  // D. NDA REQUIRED, NOT ACCEPTED -> deny with specific reason.
  ok("D. NDA required, not accepted -> deny nda_required", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, ndaRequired: true, ndaAccepted: false });
    assert(!d.allowed && d.reason === "nda_required", `expected nda_required, got ${JSON.stringify(d)}`);
  });

  // E. NDA ACCEPTED -> passes the NDA gate (allow, given everything else valid).
  ok("E. NDA required AND accepted -> allow", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, ndaRequired: true, ndaAccepted: true });
    assert(d.allowed === true, `expected allow, got ${JSON.stringify(d)}`);
  });

  // F. DEADLINE PASSED -> deny.
  ok("F. response deadline has passed -> deny deadline_passed", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, responseDeadline: PASSED_DEADLINE });
    assert(!d.allowed && d.reason === "deadline_passed", `expected deadline_passed, got ${JSON.stringify(d)}`);
  });

  // G. WRONG PROJECT PHASE — draft / closed / other non-response phase.
  for (const status of ["draft", "closed", "scoped", "awarded"]) {
    ok(`G. status '${status}' is not open for responses -> deny rfp_not_open`, () => {
      const d = evaluateSupplierResponseAccess({ ...BASE, projectStatus: status });
      assert(!d.allowed && d.reason === "rfp_not_open", `expected rfp_not_open, got ${JSON.stringify(d)}`);
    });
  }

  // H. CALLER-SUPPLIED VENDOR SPOOF — caller submits vendor = "Some Other
  // Vendor" but the established supplier identity is different. The facts
  // shape already separates `vendorSlug` (derived from the caller-supplied
  // vendor TEXT, matched against the catalogue) from `session.vendor_slug`
  // (the authenticated identity) precisely so this case is representable:
  // the caller's text resolves to a DIFFERENT slug than their session.
  ok("H. caller-supplied vendor text does not match the authenticated session's vendor -> deny, no identity granted", () => {
    const d = evaluateSupplierResponseAccess({
      ...BASE,
      session: supplierSession("acme-networks"), // real, authenticated identity
      vendorSlug: "some-other-vendor", // what the caller's `vendor` text resolved to
    });
    assert(!d.allowed, "spoofed vendor text must not grant identity");
    assert(!d.allowed && d.reason === "vendor_mismatch", `expected vendor_mismatch, got ${JSON.stringify(d)}`);
    assert(!d.allowed && d.vendor_slug === null, "no vendor_slug should be granted when the claimed vendor doesn't match the session");
  });

  // I. SHARE TOKEN ONLY — caller possesses the RFP share/invite token (i.e.
  // the project resolved at all) but has no established supplier principal.
  // This is the MCP-today case: session is always null.
  ok("I. no session at all (share token alone) -> deny supplier_identity_required, regardless of vendor text", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, session: null });
    assert(!d.allowed, "share token alone must not be sufficient to submit a response");
    assert(!d.allowed && d.reason === "supplier_identity_required", `expected supplier_identity_required, got ${JSON.stringify(d)}`);
    assert(!d.allowed && d.vendor_slug === null, "no vendor_slug should be granted with no session");
  });
  ok("I2. no session, even with an otherwise-fully-eligible NDA/claim state -> still denied", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, session: null, ndaRequired: true, ndaAccepted: true, claimStatus: "approved" });
    assert(!d.allowed && d.reason === "supplier_identity_required", `expected supplier_identity_required, got ${JSON.stringify(d)}`);
  });

  // J. NETIFY RELAY — the current production web policy intentionally
  // permits a Netify session to relay a response for ANY vendor (no
  // claim-approval check), preserved exactly.
  ok("J1. netify relay session may respond on behalf of any vendor -> allow, actor netify, claim never checked", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, session: netifySession(), claimStatus: null });
    assert(d.allowed === true, `expected allow, got ${JSON.stringify(d)}`);
    assert(d.allowed && d.actor === "netify", "actor should be netify");
  });
  ok("J2. netify relay is still subject to the NDA gate (matches the original route's unconditional NDA check)", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, session: netifySession(), ndaRequired: true, ndaAccepted: false });
    assert(!d.allowed && d.reason === "nda_required", `expected nda_required even for netify relay, got ${JSON.stringify(d)}`);
  });
  ok("J3. netify relay is NOT subject to the vendor-match/claim checks (bypasses both, unlike a supplier session)", () => {
    const d = evaluateSupplierResponseAccess({ ...BASE, session: netifySession("completely-unrelated-vendor"), vendorSlug: "acme-networks", claimStatus: "rejected" });
    assert(d.allowed === true, `netify relay should bypass vendor-match and claim entirely, got ${JSON.stringify(d)}`);
  });

  return r;
}
