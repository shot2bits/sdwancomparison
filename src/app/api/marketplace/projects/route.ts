import {sessionFromRequest} from "@/lib/auth";
import {getProject,saveProject,indexRfpForBuyer} from "@/lib/rfp-store";
import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { startMarketplaceProject } from "@/lib/marketplace-project-session";

export async function OPTIONS(req: Request) { return preflight(req); }
export async function POST(req: Request) {
  const headers = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers });
  try { const started=await startMarketplaceProject(await req.json()); const session=await sessionFromRequest(req); if(session && ["buyer","netify"].includes(session.role)){const project=await getProject(started.project_reference);if(project){await saveProject({...project,owner_email:session.email});await indexRfpForBuyer(session.email,project.id)}} return Response.json(started, { status: 201, headers }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid project input." }, { status: 400, headers }); }
}
