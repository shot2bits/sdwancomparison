import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { buildEvidenceDraft } from "@/lib/evidence-response";
import { sessionFromRequest, supplierCredentialFromRequest } from "@/lib/auth";
import { resolveSupplierPrincipal, SUPPLIER_PRINCIPAL_DENIAL_MESSAGES } from "@/lib/supplier-capability-access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * The Evidence Response draft for an invited supplier (18 July 2026).
 * Share-token gated, exactly like the supplier projection: possession of the
 * response link is the credential for RFP access. Piece 3B-2 (hybrid model,
 * Robert's ruling 9 Aug 2026): that credential proves invitation possession,
 * never which vendor the caller is — a resolved supplier principal, via the
 * vendor-specific bearer credential (?vt=, no sign-in needed — this is one
 * of the low-friction reads Robert's ruling #3 names explicitly) or a
 * session, is now also required before this vendor-specific evidence draft
 * is built. Deterministic and rebuilt per request from the vendor dataset;
 * contains no buyer-private data beyond the active question list the
 * supplier already sees, but IS specific, competitive, per-vendor evidence
 * that a different supplier must not be able to pull merely by typing
 * another vendor's name.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  if (!token || token !== project.share_token) {
    return Response.json({ error: "A valid response token is required." }, { status: 401, headers: cors });
  }
  const vendor = (url.searchParams.get("vendor") ?? "").trim();
  if (!vendor) return Response.json({ error: "vendor is required (your organisation name)." }, { status: 422, headers: cors });

  // The credential now normally arrives via the HttpOnly cookie the
  // /supplier-credential exchange sets (Robert's ruling, 9 Aug 2026); an
  // explicit ?vt= is still honoured for any caller not going through that
  // exchange, but the web client no longer sends one. MCP's own
  // get_rfp_evidence_draft tool is a separate call site (mcp-rfp-tools.ts)
  // that calls resolveSupplierPrincipal() directly with its vendor_token
  // argument — it never goes through this HTTP route or a cookie at all.
  const vendorToken = url.searchParams.get("vt") ?? supplierCredentialFromRequest(req, id);
  const session = await sessionFromRequest(req);
  const principal = await resolveSupplierPrincipal(session, id, vendorToken, vendor);
  if (!principal.established) {
    return Response.json(
      { error: SUPPLIER_PRINCIPAL_DENIAL_MESSAGES[principal.reason], auth_required: principal.reason === "supplier_identity_required" },
      { status: principal.reason === "supplier_identity_required" ? 401 : 403, headers: cors },
    );
  }

  // Build from the RESOLVED vendor slug, not the caller's raw text —
  // resolveVendor() (evidence-response.ts) accepts a slug directly, so this
  // sidesteps the free-text fuzzy-match entirely for the actual content
  // lookup, using it only for the identity question above.
  return Response.json(buildEvidenceDraft(project, principal.vendorSlug), { headers: cors });
}
