import { corsHeaders, preflight } from "@/lib/cors";
import { saveOpportunity, kvConfigured, newId } from "@/lib/rfp-store";
import { addFeedItem } from "@/lib/opportunity";
import { OpportunitySchema, OPP_SCOPES } from "@/lib/opportunity-types";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** Create an opportunity. Adds the opening post to the feed. */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const scope = Array.isArray(body.scope) ? (body.scope as string[]).filter((s) => (OPP_SCOPES as readonly string[]).includes(s)) : [];
  if (!body.title || scope.length === 0) return Response.json({ error: "title and at least one scope are required." }, { status: 422, headers: cors });
  const now = Date.now();
  const parsed = OpportunitySchema.safeParse({
    id: newId("opp"), created: now, updated: now,
    buyer_org: String(body.buyer_org ?? ""), title: String(body.title), scope,
    sites: typeof body.sites === "number" ? body.sites : null,
    regions: Array.isArray(body.regions) ? body.regions : [],
    summary: String(body.summary ?? ""), budget_note: String(body.budget_note ?? ""), timeline_note: String(body.timeline_note ?? ""),
    status: "open", awarded_vendor_slug: null, buyer_token: newId("btok"), invited: [], feed: [],
  });
  if (!parsed.success) return Response.json({ error: "Invalid opportunity." }, { status: 422, headers: cors });
  let opp = await saveOpportunity(parsed.data);
  opp = await addFeedItem(opp, "buyer", null, opp.buyer_org || "Buyer", "post", opp.summary || opp.title);
  return Response.json(opp, { headers: cors });
}
