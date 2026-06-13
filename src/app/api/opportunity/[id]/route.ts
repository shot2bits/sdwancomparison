import { corsHeaders, preflight } from "@/lib/cors";
import { getOpportunity, kvConfigured } from "@/lib/rfp-store";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const opp = await getOpportunity(id);
  if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
  return Response.json(opp, { headers: cors });
}
