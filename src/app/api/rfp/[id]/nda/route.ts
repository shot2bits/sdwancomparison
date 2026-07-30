import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, getNdaAcceptance, saveNdaAcceptance, listNdaAcceptances, hasAcceptedNda, newId, kvConfigured } from "@/lib/rfp-store";
import { NdaAcceptanceSchema } from "@/lib/rfp-types";
import { matchVendorSlug } from "@/lib/rfp-evaluation";
import { sessionFromRequest } from "@/lib/auth";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";

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

  // Supplier status read: needs the share token from the response link (or the owner).
  if (!shareTokenOk(req, project.share_token)) {
    const access = await requireRfpOwner(req, project);
    if (!access.ok) return ownerRequired("Reading the NDA status", cors);
  }
  const vendor = (url.searchParams.get("vendor") ?? "").trim();
  const accepted = await hasAcceptedNda(project, vendor);
  const acceptance = vendor ? await getNdaAcceptance(id, vendor) : null;
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

  let body: { vendor?: string; signatory_name?: string; agree?: boolean; token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }
  // Accepting is a supplier action performed from the response link.
  if (!shareTokenOk(req, project.share_token, body.token)) {
    return Response.json({ error: "Accepting the NDA needs the response link token. Open this RFP via your response link and try again." }, { status: 401, headers: cors });
  }
  const vendor = (body.vendor ?? "").trim();
  const signatory = (body.signatory_name ?? "").trim();
  if (!vendor) return Response.json({ error: "Enter your organisation name." }, { status: 422, headers: cors });
  if (!signatory) return Response.json({ error: "Enter the full name of the person accepting." }, { status: 422, headers: cors });
  if (body.agree !== true) return Response.json({ error: "You must confirm you have read and agree to the NDA." }, { status: 422, headers: cors });

  const session = await sessionFromRequest(req);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);

  const acceptance = NdaAcceptanceSchema.parse({
    id: newId("nda"),
    rfp_id: id,
    vendor,
    vendor_slug: matchVendorSlug(vendor),
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
