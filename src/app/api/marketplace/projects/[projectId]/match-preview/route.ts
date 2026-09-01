import { previewMarketplaceProject, MarketplaceProjectConflict, MarketplaceProjectUnauthorised } from "@/lib/marketplace-project-session";
import { ProviderMatchSourceUnavailable } from "@/lib/provider-match-source";

function bearer(req: Request) {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function POST(req: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  try {
    return Response.json(await previewMarketplaceProject(projectId, bearer(req), await req.json()));
  } catch (error) {
    if (error instanceof MarketplaceProjectUnauthorised) return Response.json({ error: "Project not found." }, { status: 404 });
    if (error instanceof MarketplaceProjectConflict) return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof ProviderMatchSourceUnavailable) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ error: error instanceof Error ? error.message : "Invalid preview request." }, { status: 400 });
  }
}
