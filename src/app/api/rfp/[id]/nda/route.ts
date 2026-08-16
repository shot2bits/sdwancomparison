import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, getNdaAcceptance, saveNdaAcceptance, listNdaAcceptances, hasAcceptedNda, newId, kvConfigured } from "@/lib/rfp-store";
import { NdaAcceptanceSchema } from "@/lib/rfp-types";
import { sessionFromRequest, requireClaimedSupplierFor, supplierCredentialFromRequest } from "@/lib/auth";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { resolveSupplierPrincipal, SUPPLIER_PRINCIPAL_DENIAL_MESSAGES } from "@/lib/supplier-capability-access";
import { matchVendorSlug } from "@/lib/rfp-evaluation";
import { vendorName } from "@/lib/opportunity";
import { isMarketUnlocked } from "@/lib/market-unlock";

/** Share-token check for supplier-side NDA reads/accepts. */
function shareTokenOk(req: Request, shareToken: string, bodyToken?: string): boolean {
  if (!shareToken) return false;
  if (bodyToken && bodyToken === shareToken) return true;
  try {
    return new URL(req.url).searchParams.get("token") === shareToken;
  } catch {
    return false;
  }
}

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Public-safe view of the NDA config: never leak the buyer's manage_token. */
function ndaPublic(nda: { required: boolean; source: string; text: string; link: string; version: number; updated: number }) {
  return { required: nda.required, source: nda.source, text: nda.text, link: nda.link, version: nda.version, updated: nda.updated };
}

/**
 * getNdaAcceptance/hasAcceptedNda (rfp-store.ts) key their lookup by the
 * free-text `vendor` string stored on the record, not by vendor_slug — that
 * is shared, unmodified code Piece 3A's respond flow also depends on, so it
 * is not changed here. Once a supplier principal is resolved (real
 * identity), this derives the best text to feed that lookup: the caller's
 * own text when it still resolves to the same vendor (continuity with any
 * acceptance recorded before this piece, under whatever name was typed
 * then), otherwise the canonical vendor name for that slug.
 */
function lookupTextFor(principalVendorSlug: string, callerText: string): string {
  const t = callerText.trim();
  if (t && matchVendorSlug(t) === principalVendorSlug) return t;
  return vendorName(principalVendorSlug) ?? t;
}

/**
 * GET — NDA status for a supplier.
 *   ?vendor=<organisation>  → also reports whether that organisation has accepted.
 *   ?acceptances=1          → buyer/Netify only: the full acceptance audit list.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  const url = new URL(req.url);

  // The RFP's owner can pull the acceptance audit trail.
  if (url.searchParams.get("acceptances")) {
    const access = await requireRfpOwner(req, project);
    if (!access.ok) return ownerRequired("Reading NDA acceptances", cors);
    return Response.json({ nda: ndaPublic(project.nda), acceptances: await listNdaAcceptances(id) }, { headers: cors });
  }

  // Supplier status read: needs the share token from the response link (or
  // the owner) as an unchanged baseline gate, PLUS — Piece 3B-2 (hybrid
  // model, Robert's ruling 9 Aug 2026) — a resolved supplier principal, via
  // the vendor-specific bearer credential (?vt=) or a session, when a
  // specific ?vendor= is asked about. The record this returns (acceptance)
  // carries the signatory's name, email, IP and user agent: real personal
  // data, not a bare boolean, so this read gets the same fix as the write
  // below, not just the accept action. Credential tier is sufficient here
  // (Robert's ruling #3 names NDA-status reads explicitly) — the higher,
  // claimed tier is reserved for the accept action below.
  if (!shareTokenOk(req, project.share_token)) {
    const access = await requireRfpOwner(req, project);
    if (!access.ok) return ownerRequired("Reading the NDA status", cors);
    const vendor = (url.searchParams.get("vendor") ?? "").trim();
    const accepted = await hasAcceptedNda(project, vendor);
    const acceptance = vendor ? await getNdaAcceptance(id, vendor) : null;
    return Response.json({ nda: ndaPublic(project.nda), accepted, acceptance }, { headers: cors });
  }

  // Market-unlock correction round (16 Aug 2026): a supplier's own bearer
  // credential (?vt=) can only ever be minted by an invite created AFTER
  // the market unlocks (rfp-publish.ts's corrected sequencing), so this
  // check never fires in the ordinary post-unlock case. It closes the
  // OTHER path into this route: resolveSupplierPrincipal()'s "claimed
  // session" lazy-issuance branch (supplier-capability-access.ts) mints a
  // fresh per-vendor credential for ANY vendor with an approved profile
  // claim and a session, for ANY rfp id, regardless of whether that vendor
  // was ever invited or whether this project's market has unlocked at all
  // -- so a claimed supplier account that merely obtained this project's
  // share_token (the same non-cryptographic, copyable-before-unlock token
  // the row-8 hotfix addressed on the main project route) could otherwise
  // read this project's NDA status/acceptance record before the buyer's
  // market ever unlocked. Responds identically to "not found", matching
  // the row-8 precedent on the main project route, so this cannot be used
  // to distinguish a locked project from one that doesn't exist.
  if (!(await isMarketUnlocked(id))) {
    return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  }
  const vendorParam = (url.searchParams.get("vendor") ?? "").trim();
  if (!vendorParam) {
    // No vendor named: just the public NDA text/requirement, nothing
    // personal, and the share_token already proves invitation possession —
    // unchanged from before this piece.
    return Response.json({ nda: ndaPublic(project.nda), accepted: null, acceptance: null }, { headers: cors });
  }
  // The credential now normally arrives via the HttpOnly cookie the
  // /supplier-credential exchange sets (Robert's ruling, 9 Aug 2026); an
  // explicit ?vt= is still honoured for any caller not going through that
  // exchange, but the web client no longer sends one.
  const vendorToken = url.searchParams.get("vt") ?? supplierCredentialFromRequest(req, id);
  const session = await sessionFromRequest(req);
  const principal = await resolveSupplierPrincipal(session, id, vendorToken, vendorParam);
  if (!principal.established) {
    return Response.json(
      { error: SUPPLIER_PRINCIPAL_DENIAL_MESSAGES[principal.reason], auth_required: principal.reason === "supplier_identity_required" },
      { status: principal.reason === "supplier_identity_required" ? 401 : 403, headers: cors },
    );
  }
  const lookupVendor = lookupTextFor(principal.vendorSlug, vendorParam);
  const accepted = await hasAcceptedNda(project, lookupVendor);
  const acceptance = await getNdaAcceptance(id, lookupVendor);
  return Response.json({ nda: ndaPublic(project.nda), accepted, acceptance }, { headers: cors });
}

/** POST — a supplier records their click-to-accept of the buyer's NDA. */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  if (!project.nda.required) return Response.json({ error: "This RFP has no NDA requirement." }, { status: 409, headers: cors });

  let body: { vendor?: string; signatory_name?: string; agree?: boolean; token?: string; vt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }
  // Accepting is a supplier action performed from the response link. The
  // share token is still required (unchanged baseline gate).
  if (!shareTokenOk(req, project.share_token, body.token)) {
    return Response.json({ error: "Accepting the NDA needs the response link token. Open this RFP via your response link and try again." }, { status: 401, headers: cors });
  }
  // Market-unlock correction round (16 Aug 2026): see the matching comment
  // on GET above -- the canonical gate every supplier-capability route now
  // applies before resolving any supplier principal or accepting any write.
  if (!(await isMarketUnlocked(id))) {
    return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  }
  const vendor = (body.vendor ?? "").trim();
  const signatory = (body.signatory_name ?? "").trim();
  if (!vendor) return Response.json({ error: "Enter your organisation name." }, { status: 422, headers: cors });
  if (!signatory) return Response.json({ error: "Enter the full name of the person accepting." }, { status: 422, headers: cors });
  if (body.agree !== true) return Response.json({ error: "You must confirm you have read and agree to the NDA." }, { status: 422, headers: cors });

  // Piece 3B-2 (hybrid model, Robert's ruling #4, 9 Aug 2026): accepting an
  // NDA is a legally significant write, deliberately held to the SAME bar
  // as respond_to_rfp — a claimed, admin-approved supplier session (or the
  // Netify relay) — not merely the low-friction bearer credential that is
  // sufficient for reads and for asking a clarification question. First
  // resolve a principal at all (so a bearer-token-only caller gets a clear
  // "sign in" message naming the credential, not a generic auth failure)...
  const session = await sessionFromRequest(req);
  const principal = await resolveSupplierPrincipal(session, id, body.vt ?? supplierCredentialFromRequest(req, id), vendor);
  if (!principal.established) {
    return Response.json(
      { error: SUPPLIER_PRINCIPAL_DENIAL_MESSAGES[principal.reason], auth_required: principal.reason === "supplier_identity_required" },
      { status: principal.reason === "supplier_identity_required" ? 401 : 403, headers: cors },
    );
  }
  // ...then require the claimed tier specifically, reusing Piece 3A's own,
  // already-verified gate rather than duplicating tier logic here. A
  // bearer-token-only principal (tier "credential") is established but
  // still fails this: requireClaimedSupplierFor(null-ish session, ...)
  // asks them to sign in, exactly as intended.
  const claimGate = await requireClaimedSupplierFor(session, principal.vendorSlug, cors);
  if (claimGate) return claimGate;

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);

  const acceptance = NdaAcceptanceSchema.parse({
    id: newId("nda"),
    rfp_id: id,
    vendor,
    vendor_slug: principal.vendorSlug,
    signatory_name: signatory,
    email: session?.email ?? "",
    nda_version: project.nda.version,
    accepted: Date.now(),
    ip,
    user_agent: ua,
  });
  const saved = await saveNdaAcceptance(acceptance);
  return Response.json({ accepted: true, acceptance: saved }, { headers: cors });
}
