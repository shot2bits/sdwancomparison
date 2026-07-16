import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { getEstate, saveEstate, normaliseSites, indicativeBands } from "@/lib/estate-store";
import { toPublicEstate, SASE_ELEMENTS, type Estate } from "@/lib/estate-types";
import { getAllVendors } from "@/lib/vendors";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

function tokenFrom(req: Request, body?: Record<string, unknown>): string {
  const url = new URL(req.url);
  return String(body?.manage_token ?? url.searchParams.get("manage") ?? req.headers.get("x-manage-token") ?? "");
}

/**
 * Read an estate. With the manage key: the full record plus indicative bands
 * and bid values. Without: the public shape only, contacts and prices
 * stripped, bid statuses visible so pending pricing is legible in the clear.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const estate = await getEstate(id);
  if (!estate) return Response.json({ error: "Estate not found." }, { status: 404, headers: cors });
  const owner = tokenFrom(req) === estate.manage_token;
  if (!owner) return Response.json({ estate: toPublicEstate(estate), public: true }, { headers: cors });
  return Response.json({ estate, indicative: indicativeBands(estate), illustrative: true }, { headers: cors });
}

/** Update sites, service model, SASE elements or vendor selection. Manage key required. */
export async function PUT(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const estate = await getEstate(id);
  if (!estate) return Response.json({ error: "Estate not found." }, { status: 404, headers: cors });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  if (tokenFrom(req, body) !== estate.manage_token) {
    return Response.json({ error: "Manage key required." }, { status: 401, headers: cors });
  }
  const next: Estate = { ...estate };
  if (body.sites !== undefined) next.sites = normaliseSites(body.sites);
  if (body.service_model === "managed" || body.service_model === "co_managed" || body.service_model === "diy") next.service_model = body.service_model;
  if (Array.isArray(body.sase_elements)) {
    const els = body.sase_elements.filter((x) => (SASE_ELEMENTS as readonly string[]).includes(String(x))) as Estate["sase_elements"];
    if (els.length > 0) next.sase_elements = els;
  }
  if (Array.isArray(body.vendor_slugs)) {
    const known = new Set(getAllVendors().map((v) => v.slug));
    next.vendor_slugs = body.vendor_slugs.map(String).filter((s) => known.has(s)).slice(0, 12);
  }
  try {
    const saved = await saveEstate(next);
    return Response.json({ estate: saved, indicative: indicativeBands(saved), illustrative: true }, { headers: cors });
  } catch {
    return Response.json({ error: "Invalid estate payload." }, { status: 422, headers: cors });
  }
}
