import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, kvConfigured } from "@/lib/rfp-store";
import { ProjectDetailsSchema } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";
import { recordRfpBenchmark } from "@/lib/rfp-store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  return Response.json(project, { headers: cors });
}

/** Full update (the agent and the UI both PUT the whole ProjectDetails). */
export async function PUT(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const existing = await getProject(id);
  if (!existing) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }
  const regenerate = body.regenerate === true;
  delete body.regenerate;

  let merged = { ...existing, ...(body as object), id: existing.id, share_token: existing.share_token, created: existing.created } as typeof existing;

  // Regenerate methodology sections from buyer context, preserving custom and mandatory choices.
  if (regenerate) {
    const custom = existing.rfp_sections.flatMap((s) => s.questions.filter((q) => q.source === "custom").map((q) => ({ category: s.category, q })));
    const mandatoryIds = new Set(existing.rfp_sections.flatMap((s) => s.questions.filter((q) => q.mandatory).map((q) => q.id)));
    const fresh = synthesiseSections(merged.buyer);
    for (const { category, q } of custom) {
      let sec = fresh.find((s) => s.category === category);
      if (!sec) { sec = { category, included: true, questions: [] }; fresh.push(sec); }
      if (!sec.questions.some((x) => x.id === q.id)) sec.questions.push(q);
    }
    for (const s of fresh) for (const q of s.questions) if (mandatoryIds.has(q.id)) { q.mandatory = true; if (q.priority === "optional") q.priority = "required"; }
    merged = { ...merged, rfp_sections: fresh };
  }

  const parsed = ProjectDetailsSchema.safeParse(merged);
  if (!parsed.success) {
    return Response.json({ error: "Invalid RFP shape.", issues: parsed.error.issues.slice(0, 5) }, { status: 422, headers: cors });
  }
  const saved = await saveProject(parsed.data);
  if (existing.status !== "published" && saved.status === "published") {
    const mandatory = saved.rfp_sections.flatMap((s) => s.questions.filter((q) => q.mandatory && q.feature_id !== "custom").map((q) => q.feature_id));
    try { await recordRfpBenchmark(saved.buyer.sector, mandatory); } catch { /* best effort */ }
  }
  return Response.json(saved, { headers: cors });
}
