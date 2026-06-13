import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, kvConfigured } from "@/lib/rfp-store";
import { ProjectDetailsSchema } from "@/lib/rfp-types";

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }
  // Merge onto existing, keep id/token/created stable
  const parsed = ProjectDetailsSchema.safeParse({
    ...existing,
    ...(body as object),
    id: existing.id,
    share_token: existing.share_token,
    created: existing.created,
  });
  if (!parsed.success) {
    return Response.json({ error: "Invalid RFP shape.", issues: parsed.error.issues.slice(0, 5) }, { status: 422, headers: cors });
  }
  const saved = await saveProject(parsed.data);
  return Response.json(saved, { headers: cors });
}
