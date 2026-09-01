import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { startMarketplaceProject } from "@/lib/marketplace-project-session";

export async function OPTIONS(req: Request) { return preflight(req); }
export async function POST(req: Request) {
  const headers = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers });
  try { return Response.json(await startMarketplaceProject(await req.json()), { status: 201, headers }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid project input." }, { status: 400, headers }); }
}
