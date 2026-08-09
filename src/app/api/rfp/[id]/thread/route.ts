import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listThreads, saveThread, newId, kvConfigured } from "@/lib/rfp-store";
import { RfpThreadSchema } from "@/lib/rfp-types";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { sessionFromRequest, supplierCredentialFromRequest } from "@/lib/auth";
import { resolveSupplierPrincipal, SUPPLIER_PRINCIPAL_DENIAL_MESSAGES } from "@/lib/supplier-capability-access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Does the request carry the RFP's supplier share token (query or body)?
 *  Piece 3B-2: this proves the caller holds this RFP's invitation link. It
 *  never proved, and must not be read as proving, WHICH vendor the caller
 *  is — that is resolveSupplierPrincipal()'s job below. */
function shareTokenOk(req: Request, shareToken: string, body?: { token?: string }): boolean {
  if (!shareToken) return false;
  if (body?.token && body.token === shareToken) return true;
  try {
    return new URL(req.url).searchParams.get("token") === shareToken;
  } catch {
    return false;
  }
}

/**
 * List clarification threads for an RFP.
 *  - Owner (or Netify, via requireRfpOwner): every thread, unchanged.
 *  - Supplier: the response link's share token is still required (unchanged
 *    baseline), but Piece 3B-2 (hybrid model, Robert's ruling 9 Aug 2026)
 *    now also requires a resolved supplier principal — either the
 *    per-vendor bearer credential (?vt=, no sign-in needed) or a supplier
 *    session — and the result is FILTERED to that vendor's own threads
 *    only. Before this piece, any holder of the share token saw every
 *    vendor's threads — the confirmed, flagged confidentiality bug. A
 *    caller with neither a valid vt token nor a session sees nothing.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  if (!shareTokenOk(req, project.share_token)) {
    const access = await requireRfpOwner(req, project);
    if (!access.ok) return ownerRequired("Reading clarification threads", cors);
    return Response.json({ threads: await listThreads(id) }, { headers: cors });
  }

  // Share token present but not the owner: this request must now prove a
  // real supplier (or Netify-relay) principal before it sees anything —
  // either the per-vendor bearer credential or a supplier session. The
  // credential itself now normally arrives via the HttpOnly cookie set by
  // the /supplier-credential exchange (Robert's ruling, 9 Aug 2026); an
  // explicit ?vt= is still honoured for any caller not going through that
  // exchange (e.g. a future non-cookie transport), but the web client no
  // longer sends one. ?vendor= free text is no longer trusted as identity;
  // it is consulted only when the caller is a signed-in Netify relay.
  const url = new URL(req.url);
  const vendorToken = url.searchParams.get("vt") ?? supplierCredentialFromRequest(req, id);
  const vendorText = url.searchParams.get("vendor") ?? "";
  const session = await sessionFromRequest(req);
  const principal = await resolveSupplierPrincipal(session, id, vendorToken, vendorText);
  if (!principal.established) {
    return Response.json(
      { error: SUPPLIER_PRINCIPAL_DENIAL_MESSAGES[principal.reason], auth_required: principal.reason === "supplier_identity_required" },
      { status: principal.reason === "supplier_identity_required" ? 401 : 403, headers: cors },
    );
  }
  // Both a supplier's own principal and a Netify relay acting for a named
  // vendor are scoped to that one vendor's threads here — "netify" is not a
  // second, broader case. The buyer's full, unfiltered view is the
  // requireRfpOwner branch above, not this one; a relay wanting that must
  // authenticate as the owner, not as a supplier-vendor pair. Credential
  // tier is sufficient for a read (Robert's ruling #3); no claimed-tier
  // check is applied here.
  const threads = (await listThreads(id)).filter((t) => (t.vendor_slug ?? null) === principal.vendorSlug);
  return Response.json({ threads }, { headers: cors });
}

/**
 * POST creates a supplier question (share token AND a resolved supplier
 * principal now required — Piece 3B-2), or a buyer answer when
 * { answer, thread_id } is sent (owner-only, unchanged).
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { vendor?: string; question?: string; category?: string; thread_id?: string; answer?: string; token?: string; vt?: string; manage_token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }

  // Buyer answering an existing thread — unchanged, already owner-gated.
  if (body.thread_id && typeof body.answer === "string") {
    const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
    if (!access.ok) return ownerRequired("Answering a clarification", cors);
    const threads = await listThreads(id);
    const t = threads.find((x) => x.id === body.thread_id);
    if (!t) return Response.json({ error: "Thread not found." }, { status: 404, headers: cors });
    const saved = await saveThread({ ...t, buyer_answer: body.answer, status: "answered", answered: Date.now() });
    return Response.json(saved, { headers: cors });
  }

  // Supplier asking a question: the response link's share token is still
  // required (unchanged baseline), but Piece 3B-2 now also requires the
  // caller to hold the vendor-specific bearer credential (vt, minted at
  // publish time) or a matching supplier session — not merely type a
  // vendor's name. A caller-supplied vendor field is data; it grants no
  // authority on its own. Credential tier is sufficient for this write
  // (Robert's ruling #3 names clarification reads/writes explicitly).
  if (!shareTokenOk(req, project.share_token, body)) {
    return Response.json({ error: "Asking a question needs the response link token. Open this RFP via your response link and try again." }, { status: 401, headers: cors });
  }
  if (!body.vendor || !body.question) {
    return Response.json({ error: "vendor and question are required." }, { status: 422, headers: cors });
  }
  const session = await sessionFromRequest(req);
  const principal = await resolveSupplierPrincipal(session, id, body.vt ?? supplierCredentialFromRequest(req, id), body.vendor);
  if (!principal.established) {
    return Response.json(
      { error: SUPPLIER_PRINCIPAL_DENIAL_MESSAGES[principal.reason], auth_required: principal.reason === "supplier_identity_required" },
      { status: principal.reason === "supplier_identity_required" ? 401 : 403, headers: cors },
    );
  }
  const cat = (body.category as string) || autoCategory(body.question);
  const thread = RfpThreadSchema.parse({
    id: newId("thr"),
    rfp_id: id,
    vendor: body.vendor,
    vendor_slug: principal.vendorSlug,
    category: cat,
    question: body.question,
    status: "open",
    buyer_answer: "",
    created: Date.now(),
    answered: null,
  });
  const saved = await saveThread(thread);
  return Response.json(saved, { headers: cors });
}

function autoCategory(q: string): "technical" | "commercial" | "timeline" | "scope" | "other" {
  const s = q.toLowerCase();
  if (/(price|cost|licen|commercial|discount|term|payment|contract)/.test(s)) return "commercial";
  if (/(when|deadline|timeline|date|submit by|how long|lead time)/.test(s)) return "timeline";
  if (/(scope|include|out of scope|in scope|cover|number of sites|how many)/.test(s)) return "scope";
  if (/(ztna|swg|casb|dlp|firewall|bandwidth|latency|protocol|integration|api|architecture|throughput|tls|segmentation)/.test(s)) return "technical";
  return "other";
}
