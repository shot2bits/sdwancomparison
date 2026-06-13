import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listResponses, saveResponse, newId, kvConfigured } from "@/lib/rfp-store";
import { RfpResponseSchema } from "@/lib/rfp-types";
import { matchVendorSlug } from "@/lib/rfp-evaluation";
import { recordCompletenessSample } from "@/lib/rfp-store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** List supplier responses (buyer evaluation view). */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  return Response.json({ responses: await listResponses(id) }, { headers: cors });
}

/** Supplier submits or updates their answers to the RFP questions. */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  if (project.status !== "published" && project.status !== "qa") {
    return Response.json({ error: "This RFP is not open for responses." }, { status: 409, headers: cors });
  }
  let body: { vendor?: string; answers?: Record<string, string>; submit?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }
  if (!body.vendor) return Response.json({ error: "vendor is required." }, { status: 422, headers: cors });
  const existing = (await listResponses(id)).find((r) => r.vendor === body.vendor);
  const response = RfpResponseSchema.parse({
    id: existing?.id ?? newId("resp"),
    rfp_id: id,
    vendor: body.vendor,
    vendor_slug: existing?.vendor_slug ?? matchVendorSlug(body.vendor),
    answers: { ...(existing?.answers ?? {}), ...(body.answers ?? {}) },
    submitted: body.submit ? Date.now() : existing?.submitted ?? null,
    created: existing?.created ?? Date.now(),
  });
  const saved = await saveResponse(response);
  if (body.submit) {
    const active = project.rfp_sections.filter((x) => x.included).flatMap((x) => x.questions.filter((q) => q.priority !== "optional"));
    const answered = active.filter((q) => (saved.answers[q.id] ?? "").trim()).length;
    if (active.length) { try { await recordCompletenessSample(answered / active.length); } catch { /* best effort */ } }
  }
  return Response.json(saved, { headers: cors });
}
