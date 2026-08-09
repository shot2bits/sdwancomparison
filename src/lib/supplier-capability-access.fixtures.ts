/**
 * Project Foundation Piece 3B-2 test suite (hybrid model, Robert's ruling of
 * 9 Aug 2026). Exercises resolveSupplierPrincipalFromFacts directly — the
 * pure, synchronous, two-tier identity decision shared by the clarification
 * thread, NDA acceptance and evidence-draft capabilities — following the
 * same fixtures pattern Piece 3A established (rfp-response-access.fixtures.ts):
 * pure vectors plus an exported runner, no KV, no cookies, no live storage.
 *
 * KV is not configured in this sandbox (KV_REST_API_URL/TOKEN unset), so
 * every test here either calls the pure core directly, or calls the async
 * wrapper (resolveSupplierPrincipal) in a way that provably never reaches a
 * kv() call: a null vendorTokenRaw and a non-supplier session skip both the
 * token-resolution and claim-approval KV reads. This is not a workaround —
 * it is the correct shape for these tests either way, since the identity
 * DECISION (the part worth testing exhaustively) lives entirely in the pure
 * core; the wrapper's only untested-here responsibility is gathering KV
 * facts, which is exactly what the routes exercise for real against a
 * configured KV in production/preview.
 *
 * This is the identity layer only. Each capability (thread visibility, NDA
 * version currency, evidence-draft content) applies its own downstream rule
 * on top of what this resolver decides — those rules are exercised by the
 * routes themselves, not re-tested here.
 */

import { resolveSupplierPrincipalFromFacts, resolveSupplierPrincipal, type SupplierVendorTokenFact } from "./supplier-capability-access";
import type { AuthSession } from "./rfp-store";

export interface SupplierPrincipalTestResult { pass: number; fail: number; failures: string[] }

const NOW = 1_700_000_000_000;
const RFP_1 = "rfp-1";
const RFP_2 = "rfp-2";

const supplierSession = (vendor_slug: string | null): AuthSession => ({
  token: "tok_sess",
  role: "supplier",
  email: "sales@acme.example",
  vendor_slug,
  created: NOW - 1000,
  expires: NOW + 1000,
});

const netifySession = (): AuthSession => ({
  token: "tok_netify",
  role: "netify",
  email: "ops@netify.com",
  vendor_slug: null,
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

const tokenFor = (rfpId: string, vendorSlug: string): SupplierVendorTokenFact => ({ rfpId, vendorSlug });

export async function runSupplierPrincipalTests(): Promise<SupplierPrincipalTestResult> {
  const r: SupplierPrincipalTestResult = { pass: 0, fail: 0, failures: [] };
  // Async-aware: most cases here are the pure, synchronous core and finish
  // immediately; the two wrapper checks at the bottom return a Promise, and
  // this awaits it either way so a rejected/failing async case is actually
  // caught, not silently counted as a pass.
  const ok = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const assert = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

  // --- Bearer credential alone (the new, low-friction path: no session at
  // all — this is the anonymous-participation journey Robert's ruling
  // restores). A / C / G — reading/posting one's own thread, NDA status,
  // evidence draft, using ONLY the vendor-specific token from the invite
  // link, exactly the "person with only the link, no sign-in" case the
  // original brief confirmed is today's real, intentional journey.
  await ok("A/C/G (credential tier). valid bearer token for this RFP, no session -> allow at 'credential' tier", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, tokenFor(RFP_1, "vendor-a"), null, false, null);
    assert(d.established === true, `expected established, got ${JSON.stringify(d)}`);
    assert(d.established && d.actor === "supplier", "actor should be supplier");
    assert(d.established && d.vendorSlug === "vendor-a", "vendorSlug should be the token's vendor");
    assert(d.established && d.tier === "credential", `expected credential tier, got ${JSON.stringify(d)}`);
  });
  await ok("B/D/H (credential tier, cross-RFP). a valid token for a DIFFERENT RFP -> deny, not silently scoped to the wrong RFP", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, tokenFor(RFP_2, "vendor-a"), null, false, null);
    assert(!d.established && d.reason === "supplier_identity_required", `a token minted for another RFP must not authorise this one, got ${JSON.stringify(d)}`);
  });

  // --- Claimed session (the higher tier: a real, signed-in, approved
  // supplier). E / I / L variants — own vendor, with and without an
  // approved claim, with and without a token also present.
  await ok("E/I/L (claimed tier). signed-in supplier, claim approved, no token -> allow at 'claimed' tier", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, null, supplierSession("vendor-a"), true, null);
    assert(d.established === true, `expected established, got ${JSON.stringify(d)}`);
    assert(d.established && d.tier === "claimed", `expected claimed tier, got ${JSON.stringify(d)}`);
    assert(d.established && d.vendorSlug === "vendor-a", "vendorSlug should be the session's vendor");
  });
  await ok("E/I/L variant. signed-in supplier, claim NOT yet approved, no token -> allow, but only at 'credential' tier", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, null, supplierSession("vendor-a"), false, null);
    assert(d.established === true, `an identified but unclaimed supplier should still reach the low tier, got ${JSON.stringify(d)}`);
    assert(d.established && d.tier === "credential", `expected credential tier (not claimed) while claim is unapproved, got ${JSON.stringify(d)}`);
  });
  await ok("Session + matching token together -> allow at whatever tier the session earns, no conflict", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, tokenFor(RFP_1, "vendor-a"), supplierSession("vendor-a"), true, null);
    assert(d.established === true && d.tier === "claimed", `matching session+token should still reach claimed tier, got ${JSON.stringify(d)}`);
  });

  // --- B/D/H/K — real conflicts: a supplier session for one vendor
  // presenting (or being checked against) a different vendor's credential or
  // claim. This is the exact shape of the original flagged bug: one
  // supplier reaching for another's private capability.
  await ok("B/D/H/K. signed-in supplier (vendor A) presenting vendor B's bearer token -> deny vendor_mismatch, not 'prefer the session'", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, tokenFor(RFP_1, "vendor-b"), supplierSession("vendor-a"), true, null);
    assert(!d.established, "a session/token conflict must not grant identity");
    assert(!d.established && d.reason === "vendor_mismatch", `expected vendor_mismatch, got ${JSON.stringify(d)}`);
    assert(!d.established && d.vendorSlug === null, "no vendorSlug should be granted on a conflict");
  });
  await ok("B/D/H/K variant. buyer session (wrong role) with no token -> deny supplier_identity_required, not treated as any vendor", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, null, buyerSession(), false, null);
    assert(!d.established && d.reason === "supplier_identity_required", `a buyer session asserts no vendor of its own, got ${JSON.stringify(d)}`);
  });
  await ok("Buyer session must not block a VALID token though — an unrelated session never overrides a real credential", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, tokenFor(RFP_1, "vendor-a"), buyerSession(), false, null);
    assert(d.established === true && d.tier === "credential", `a buyer session has no vendor to conflict with; the token should still work, got ${JSON.stringify(d)}`);
  });
  await ok("B/D/H/K variant. supplier session with no vendor_slug at all, no token -> deny supplier_identity_required", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, null, supplierSession(null), false, null);
    assert(!d.established && d.reason === "supplier_identity_required", `a malformed supplier session asserts no vendor, got ${JSON.stringify(d)}`);
  });

  // --- E/I/L — nothing at all (the MCP Safety Rule shape, and the
  // anonymous-caller-with-an-old-link shape): no session, no token -> deny.
  await ok("E/I/L. no session, no token -> deny supplier_identity_required (the MCP-with-nothing and old-link-with-nothing shape)", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, null, null, false, null);
    assert(!d.established && d.reason === "supplier_identity_required", `expected supplier_identity_required, got ${JSON.stringify(d)}`);
    assert(!d.established && d.vendorSlug === null, "no vendorSlug should be granted with nothing to prove identity");
  });

  // --- F — Netify relay: preserved, intentional, matches requireSupplierFor
  // / requireClaimedSupplierFor / resolveSupplierResponseAccess's identical
  // rule, now also usable via a resolvable bearer token (e.g. staff opening
  // a supplier's own link while signed in as netify).
  await ok("F. netify relay with a resolvable named vendor -> allow, actor netify, tier claimed, for ANY vendor named", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, null, netifySession(), false, "vendor-a");
    assert(d.established === true, `expected established, got ${JSON.stringify(d)}`);
    assert(d.established && d.actor === "netify", "actor should be netify");
    assert(d.established && d.vendorSlug === "vendor-a", "vendorSlug should be the named vendor");
    assert(d.established && d.tier === "claimed", "netify relay should always reach the claimed tier");
  });
  await ok("F variant. netify relay resolving via a bearer token instead of named text -> still allow", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, tokenFor(RFP_1, "vendor-b"), netifySession(), false, null);
    assert(d.established === true && d.vendorSlug === "vendor-b", `relay should be able to use a token too, got ${JSON.stringify(d)}`);
  });
  await ok("F variant. netify relay, no named vendor and no token -> deny vendor_mismatch (relay still needs to be told who)", () => {
    const d = resolveSupplierPrincipalFromFacts(RFP_1, null, netifySession(), false, null);
    assert(!d.established && d.reason === "vendor_mismatch", `expected vendor_mismatch, got ${JSON.stringify(d)}`);
  });

  // --- Integration checks of the async wrapper (glue only — the decision
  // itself is already covered above). Both are deliberately KV-free: a null
  // vendorTokenRaw skips the token-resolution KV read, and a non-supplier
  // (or absent) session skips the claim-approval KV read, so these are safe
  // to run without a configured KV backend.
  await ok("Wrapper. no session, no token, irrelevant relay text -> deny supplier_identity_required without touching KV", async () => {
    const d = await resolveSupplierPrincipal(null, RFP_1, null, "Definitely Not A Real Vendor Name Zzz123");
    assert(!d.established && d.reason === "supplier_identity_required", `expected supplier_identity_required, got ${JSON.stringify(d)}`);
  });
  await ok("Wrapper. netify relay, unresolvable free-text vendor, no token -> deny vendor_mismatch (matchVendorSlug found nothing real)", async () => {
    const d = await resolveSupplierPrincipal(netifySession(), RFP_1, null, "Definitely Not A Real Vendor Name Zzz123");
    assert(!d.established && d.reason === "vendor_mismatch", `expected vendor_mismatch, got ${JSON.stringify(d)}`);
  });

  return r;
}
