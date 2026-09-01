import { corsHeaders, preflight } from "@/lib/cors";
import { MarketplaceProjectConflict, MarketplaceProjectUnauthorised, updateMarketplaceProject } from "@/lib/marketplace-project-session";

export async function OPTIONS(req: Request) { return preflight(req); }
export async function PATCH(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const headers = corsHeaders(req); const { projectId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try { return Response.json(await updateMarketplaceProject(projectId, token, await req.json()), { headers }); }
  catch (error) {
    const status = error instanceof MarketplaceProjectConflict ? 409 : error instanceof MarketplaceProjectUnauthorised ? 404 : 400;
    return Response.json({ error: error instanceof Error ? error.message : "Invalid update." }, { status, headers });
  }
}
