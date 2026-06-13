import { corsHeaders, preflight } from "@/lib/cors";
import { saveOpportunity, kvConfigured, newId, listPublicOpportunities } from "@/lib/rfp-store";
import { addFeedItem } from "@/lib/opportunity";
import { OpportunitySchema, OPP_SCOPES, ENGAGEMENT_TYPES, AUCTION_FORMATS, ELIGIBILITY_TYPES, VISIBILITY_TYPES } from "@/lib/opportunity-types";

function pick<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** Public board: open opportunities as stripped projections (no pricing amounts). */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ opportunities: [] }, { headers: cors });
  const opportunities = await listPublicOpportunities();
  return Response.json({ opportunities, count: opportunities.length }, { headers: cors });
}

/** Create an opportunity. Adds the opening post to the feed. */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const scope = Array.isArray(body.scope) ? (body.scope as string[]).filter((s) => (OPP_SCOPES as readonly string[]).includes(s)) : [];
  if (!body.title || scope.length === 0) return Response.json({ error: "title and at least one scope are required." }, { status: 422, headers: cors });
  const now = Date.now();
  const engagement_type = pick(body.engagement_type, ENGAGEMENT_TYPES, "quote_room");
  const auction_format = pick(body.auction_format, AUCTION_FORMATS, "open");
  const eligibility = pick(body.eligibility, ELIGIBILITY_TYPES, "invited");
  const visibility = pick(body.visibility, VISIBILITY_TYPES, "public");
  // Deadline only applies to a timed auction; accept epoch ms or an ISO string.
  let deadline: number | null = null;
  if (engagement_type === "auction" && auction_format === "timed") {
    if (typeof body.deadline === "number") deadline = body.deadline;
    else if (typeof body.deadline === "string") { const t = Date.parse(body.deadline); if (!Number.isNaN(t)) deadline = t; }
  }
  const parsed = OpportunitySchema.safeParse({
    id: newId("opp"), created: now, updated: now,
    buyer_org: String(body.buyer_org ?? ""), title: String(body.title), scope,
    sites: typeof body.sites === "number" ? body.sites : null,
    regions: Array.isArray(body.regions) ? body.regions : [],
    summary: String(body.summary ?? ""), budget_note: String(body.budget_note ?? ""), timeline_note: String(body.timeline_note ?? ""),
    status: "open", engagement_type, auction_format, deadline, eligibility, visibility,
    awarded_vendor_slug: null, buyer_token: newId("btok"), invited: [], feed: [],
  });
  if (!parsed.success) return Response.json({ error: "Invalid opportunity." }, { status: 422, headers: cors });
  let opp = await saveOpportunity(parsed.data);
  opp = await addFeedItem(opp, "buyer", null, opp.buyer_org || "Buyer", "post", opp.summary || opp.title);
  return Response.json(opp, { headers: cors });
}
