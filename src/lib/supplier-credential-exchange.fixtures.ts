/**
 * Piece 3B-2 credential-exchange test suite (Robert's ruling, 9 Aug 2026:
 * replace query-string `vt` delivery with a redeem-once-then-cookie flow).
 * Same pattern as supplier-capability-access.fixtures.ts: pure vectors
 * against resolveCredentialExchangeFromFacts and the cookie/URL builders in
 * auth.ts and supplier-credential-exchange.ts, plus KV-free checks of the
 * redemption route's HTTP shape (Location header, cookie presence). No KV,
 * no live storage — this environment has neither configured.
 *
 * Maps directly to Robert's 11-point required test list:
 *   1. valid supplier invitation credential establishes the correct supplier
 *   2. wrong-RFP credential is rejected
 *   3. supplier A credential cannot establish supplier B
 *   4. successful redemption redirects to a URL containing no credential
 *   5. subsequent requests work without vt in the URL (cookie fallback)
 *   6. copying the resulting browser URL conveys no supplier authority
 *   7. signing in from the clean responder page cannot embed vt in return_to
 *   8. MCP vendor_token still works for the allowed low-stakes capability
 *   9. invalid/missing MCP credential still fails closed
 *  10. NDA acceptance still requires the claimed tier
 *  11. Piece 3A 21/21 regression remains clean
 * — each test below cites which point(s) it covers; points already covered
 *   by the EXISTING, unmodified supplier-capability-access.fixtures.ts /
 *   rfp-response-access.fixtures.ts suites (8, 9, 10, 11 — none of that
 *   logic changed in this pass) are cross-referenced, not duplicated.
 */

import { readFileSync } from "node:fs";
import { resolveCredentialExchangeFromFacts, cleanRespondUrl, type CredentialExchangeFact } from "./supplier-credential-exchange";
import { supplierCredentialCookieName, supplierCredentialCookieHeader, supplierCredentialFromRequest } from "./auth";
import { GET as redeemCredential } from "../app/api/rfp/[id]/supplier-credential/route";

export interface CredentialExchangeTestResult { pass: number; fail: number; failures: string[] }

const fact = (rfpId: string, vendorSlug: string): CredentialExchangeFact => ({ rfpId, vendorSlug });

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

export async function runCredentialExchangeTests(): Promise<CredentialExchangeTestResult> {
  const r: CredentialExchangeTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const assert = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

  // --- Point 1: valid credential establishes the correct supplier. ---
  await ok("[1] resolveCredentialExchangeFromFacts: token minted for THIS rfp -> redeem, correct vendorSlug", () => {
    const d = resolveCredentialExchangeFromFacts("rfp-1", fact("rfp-1", "vendor-a"));
    assert(d.redeem === true, `expected redeem, got ${JSON.stringify(d)}`);
    assert(d.redeem && d.vendorSlug === "vendor-a", `expected vendor-a, got ${JSON.stringify(d)}`);
  });

  // --- Point 2: wrong-RFP credential is rejected. ---
  await ok("[2] resolveCredentialExchangeFromFacts: token minted for a DIFFERENT rfp -> deny, not silently redeemed here", () => {
    const d = resolveCredentialExchangeFromFacts("rfp-1", fact("rfp-2", "vendor-a"));
    assert(d.redeem === false, `a token for another RFP must not redeem here, got ${JSON.stringify(d)}`);
  });
  await ok("[2] variant. no resolvable token fact at all (invalid/expired/unknown vt) -> deny", () => {
    const d = resolveCredentialExchangeFromFacts("rfp-1", null);
    assert(d.redeem === false, `an unresolvable token must not redeem, got ${JSON.stringify(d)}`);
  });

  // --- Point 3: supplier A's credential cannot establish supplier B. This
  // is a composition guarantee, not new logic: the cookie stores the SAME
  // raw vendor-token string a query-string vt always carried, resolved
  // through the SAME resolveSupplierVendorToken() -> resolveSupplierPrincipal
  // path already exhaustively tested in supplier-capability-access.fixtures.ts
  // (cases "A/C/G", "B/D/H (credential tier, cross-RFP)" and the
  // vendor_mismatch cases) — a per-vendor token was never, and is still
  // never, interchangeable with another vendor's, regardless of transport.
  // What IS new here is that the token now also flows through
  // resolveCredentialExchangeFromFacts at issuance; confirm it carries the
  // MINTED vendor through untouched, never substituting or widening it.
  await ok("[3] resolveCredentialExchangeFromFacts never substitutes a different vendorSlug than the one the token actually resolved to", () => {
    const a = resolveCredentialExchangeFromFacts("rfp-1", fact("rfp-1", "vendor-a"));
    const b = resolveCredentialExchangeFromFacts("rfp-1", fact("rfp-1", "vendor-b"));
    if (!a.redeem || !b.redeem) throw new Error(`expected both to redeem, got ${JSON.stringify(a)} / ${JSON.stringify(b)}`);
    assert(a.vendorSlug === "vendor-a", `expected exactly vendor-a, got ${JSON.stringify(a)}`);
    assert(b.vendorSlug === "vendor-b", `expected exactly vendor-b, got ${JSON.stringify(b)}`);
    assert(a.vendorSlug !== b.vendorSlug, "two different vendors' tokens must never resolve to the same vendorSlug");
  });

  // --- Point 4 & 6: successful (and unsuccessful) redemption both redirect
  // to a URL containing no credential — so the URL alone, copied from the
  // address bar at any point, conveys no supplier authority either way. ---
  await ok("[4,6] cleanRespondUrl never contains vt, with a token present", () => {
    const u = cleanRespondUrl("https://netify.co.uk/sase", "rfp-1", "share-tok-123");
    assert(!u.includes("vt"), `clean URL must never contain a vt fragment, got ${u}`);
    assert(u.includes("token=share-tok-123"), `expected the share token preserved, got ${u}`);
    assert(u === "https://netify.co.uk/sase/rfp-builder/rfp-1/respond?token=share-tok-123", `unexpected shape: ${u}`);
  });
  await ok("[4,6] cleanRespondUrl with no share token omits the query entirely, still no vt", () => {
    const u = cleanRespondUrl("https://netify.co.uk/sase", "rfp-1", "");
    assert(!u.includes("vt") && !u.includes("?"), `expected a bare clean path, got ${u}`);
  });
  await ok("[4,6] redemption route: Location header never contains vt, for a VALID-shaped request", async () => {
    const req = new Request("https://netify.co.uk/sase/api/rfp/rfp-1/supplier-credential?token=share-tok-123&vt=secret-vendor-token");
    const res = await redeemCredential(req, makeCtx("rfp-1"));
    const loc = res.headers.get("Location") ?? "";
    assert(res.status === 302, `expected a 302 redirect, got ${res.status}`);
    assert(!loc.includes("vt"), `Location must never carry the credential, got ${loc}`);
    assert(loc.includes("token=share-tok-123"), `expected the share token preserved in the Location, got ${loc}`);
  });
  await ok("[4,6] redemption route: Location header never contains vt, for an INVALID/missing vt either", async () => {
    const req = new Request("https://netify.co.uk/sase/api/rfp/rfp-1/supplier-credential?token=share-tok-123");
    const res = await redeemCredential(req, makeCtx("rfp-1"));
    const loc = res.headers.get("Location") ?? "";
    assert(res.status === 302 && !loc.includes("vt"), `expected a clean 302 either way, got ${res.status} ${loc}`);
  });
  await ok("[4,6] redemption route with no KV configured (this sandbox): degrades to a clean redirect, sets no cookie, never throws", async () => {
    // Documents THIS environment's behaviour (KV_REST_API_URL/TOKEN unset):
    // kvConfigured() is false, so the token is never looked up and no
    // cookie is ever set here. That is the correct, safe degradation — not
    // a stand-in for the KV-backed "valid token -> cookie set" path, which
    // needs a real KV and is covered in the live preview acceptance pass
    // (see the piece's review report), the same way the rest of this
    // piece's KV-dependent behaviour already is.
    const req = new Request("https://netify.co.uk/sase/api/rfp/rfp-1/supplier-credential?token=share-tok-123&vt=secret-vendor-token");
    const res = await redeemCredential(req, makeCtx("rfp-1"));
    assert(res.headers.get("Set-Cookie") === null, "no KV configured means no credential can be validated, so no cookie should be set");
  });

  // --- Point 5: subsequent requests work without vt in the URL — the
  // cookie fallback each of the three capability routes now reads. Pure:
  // constructs a fake Request carrying the cookie header directly, the same
  // way a browser would resend it automatically, and confirms extraction. ---
  await ok("[5] supplierCredentialFromRequest reads the per-RFP cookie back out, with no vt anywhere in the URL", () => {
    const name = supplierCredentialCookieName("rfp-1");
    const req = new Request("https://netify.co.uk/sase/api/rfp/rfp-1/thread?token=share-tok-123", {
      headers: { cookie: `${name}=secret-vendor-token` },
    });
    const v = supplierCredentialFromRequest(req, "rfp-1");
    assert(v === "secret-vendor-token", `expected the cookie value back, got ${JSON.stringify(v)}`);
  });
  await ok("[5] variant. no cookie at all -> null, same as an absent vt (falls back to session/deny, not a crash)", () => {
    const req = new Request("https://netify.co.uk/sase/api/rfp/rfp-1/thread?token=share-tok-123");
    const v = supplierCredentialFromRequest(req, "rfp-1");
    assert(v === null, `expected null with no cookie present, got ${JSON.stringify(v)}`);
  });
  await ok("[5] variant. a DIFFERENT rfp's cookie present, this rfp's absent -> null, not cross-applied", () => {
    const otherName = supplierCredentialCookieName("rfp-2");
    const req = new Request("https://netify.co.uk/sase/api/rfp/rfp-1/thread?token=share-tok-123", {
      headers: { cookie: `${otherName}=secret-for-rfp-2` },
    });
    const v = supplierCredentialFromRequest(req, "rfp-1");
    assert(v === null, `an rfp-2 cookie must not be read as an rfp-1 credential, got ${JSON.stringify(v)}`);
  });

  // --- Cookie shape: HttpOnly/Secure/SameSite=Lax, so it is never readable
  // by client JS and never rides along a cross-site request. ---
  await ok("supplierCredentialCookieHeader sets HttpOnly, Secure, SameSite=Lax and a per-rfp name", () => {
    const h = supplierCredentialCookieHeader("rfp-1", "secret-vendor-token");
    assert(h.includes("HttpOnly"), `expected HttpOnly, got ${h}`);
    assert(h.includes("Secure"), `expected Secure, got ${h}`);
    assert(h.includes("SameSite=Lax"), `expected SameSite=Lax, got ${h}`);
    assert(h.startsWith(`${supplierCredentialCookieName("rfp-1")}=`), `expected the per-rfp cookie name, got ${h}`);
  });

  // --- Point 7: signing in from the clean responder page cannot embed vt in
  // return_to. This is structural (SignIn.tsx is unmodified and still
  // captures window.location.pathname + search verbatim), so the guarantee
  // is that RfpResponder — the client component whose source ships to the
  // browser and drives what's on that page — no longer references `vt` as a
  // credential AT ALL. A source-level regression check: if a future edit
  // reintroduces a `vt` query param or body field there, this test catches
  // it before a live SignIn round-trip could ever re-embed it. ---
  await ok("[7] RfpResponder.tsx source contains no `vt` credential reference (nothing left to end up in return_to)", () => {
    const src = readFileSync(new URL("../components/RfpResponder.tsx", import.meta.url), "utf8");
    const hit = src.match(/\bvt\b/);
    assert(!hit, `RfpResponder.tsx must not reference vt anymore (found: ${hit?.[0]} in context) — the credential is cookie-borne now, never client-visible`);
  });
  await ok("[7] variant. respond/page.tsx never renders RfpResponder with a vt prop", () => {
    const src = readFileSync(new URL("../app/(marketing)/rfp-builder/[id]/respond/page.tsx", import.meta.url), "utf8");
    assert(!/<RfpResponder[^>]*\bvt=/.test(src), "respond/page.tsx must not pass a vt prop to RfpResponder");
  });

  // Points 8, 9, 10, 11 are unchanged by this pass (no code touched on
  // those paths) and remain covered by the existing, still-passing suites:
  //  - 8/9: supplier-capability-access.fixtures.ts cases "A/C/G (credential
  //    tier)" (valid token, no session -> credential tier — the MCP-with-a-
  //    real-token shape) and "E/I/L. no session, no token -> deny" (the
  //    MCP-with-nothing shape). mcp-rfp-tools.ts's get_rfp_evidence_draft
  //    calls resolveSupplierPrincipal directly and is untouched here.
  //  - 10: nda/route.ts's POST handler still calls requireClaimedSupplierFor
  //    unconditionally after establishing a principal — untouched by this
  //    pass; supplier-capability-access.fixtures.ts's claimed-vs-credential
  //    tier cases exercise the distinction that gate depends on.
  //  - 11: scripts/verify-piece3b-2-supplier-identity.ts already runs
  //    rfp-response-access.fixtures.ts's full A-J matrix every invocation.

  return r;
}
