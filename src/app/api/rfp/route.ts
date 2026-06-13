import { corsHeaders, preflight } from "@/lib/cors";
import { saveProject, newId, kvConfigured, KvNotConfiguredError } from "@/lib/rfp-store";
import { BuyerContextSchema, ProjectDetailsSchema } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";
import { sessionFromRequest } from "@/lib/auth";
import { indexRfpForBuyer } from "@/lib/rfp-store";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Create a new RFP from optional buyer context. */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) {
    return Response.json({ error: new KvNotConfiguredError().message }, { status: 503, headers: cors });
  }
  let body: { title?: string; buyer?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine: starts a blank draft
  }
  const buyer = BuyerContextSchema.parse(body.buyer ?? {});
  const id = newId("rfp");
  const project = ProjectDetailsSchema.parse({
    id,
    created: Date.now(),
    updated: Date.now(),
    status: "draft",
    title: body.title || "Untitled SASE / SD-WAN RFP",
    buyer,
    rfp_sections: synthesiseSections(buyer),
    invited_vendors: [],
    share_token: newId("tok"),
    methodology_version: "2026.1",
  });
  const saved = await saveProject(project);
  const session = await sessionFromRequest(req);
  if (session && (session.role === "buyer" || session.role === "netify")) {
    try { await indexRfpForBuyer(session.email, saved.id); } catch { /* best effort */ }
  }
  return Response.json(saved, { headers: cors });
}
