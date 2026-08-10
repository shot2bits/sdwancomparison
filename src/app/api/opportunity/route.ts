import { corsHeaders, preflight } from "@/lib/cors";
import { saveOpportunity, kvConfigured, newId, listPublicOpportunities } from "@/lib/rfp-store";
import { addFeedItem } from "@/lib/opportunity";
import { notifyOpportunityPublishedLead } from "@/lib/notify";
import { sessionFromRequest } from "@/lib/auth";
import {
  OpportunitySchema,
  OPP_SCOPES,
  ENGAGEMENT_TYPES,
  AUCTION_FORMATS,
  ELIGIBILITY_TYPES,
  VISIBILITY_TYPES,
  BUYER_VISIBILITY_TYPES,
  RESPONSE_MODES,
} from "@/lib/opportunity-types";

function pick<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

function strArray(value: unknown, max = 20): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, max) : [];
}

function epoch(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return t;
  }
  return null;
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

/**
 * Publish an opportunity notice. Adds the opening post to the feed.
 *
 * Gating (marketplace rebuild): drafting and previewing a notice is completely
 * open, but PUBLISHING requires a signed-in session. The wizard carries the
 * draft through sign-in, so nothing is lost at the gate. This is what keeps
 * the board trustworthy for suppliers and ties every notice to an accountable
 * business identity.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });

  const session = await sessionFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "Sign in to publish this opportunity. Your draft is kept and carried through sign-in.", auth_required: true },
      { status: 401, headers: cors },
    );
  }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const scope = Array.isArray(body.scope) ? (body.scope as string[]).filter((s) => (OPP_SCOPES as readonly string[]).includes(s)) : [];
  if (!body.title || scope.length === 0) return Response.json({ error: "title and at least one scope are required." }, { status: 422, headers: cors });
  const now = Date.now();
  const engagement_type = pick(body.engagement_type, ENGAGEMENT_TYPES, "quote_room");
  const auction_format = pick(body.auction_format, AUCTION_FORMATS, "open");
  const eligibility = pick(body.eligibility, ELIGIBILITY_TYPES, "invited");
  const visibility = pick(body.visibility, VISIBILITY_TYPES, "public");
  const buyer_visibility = pick(body.buyer_visibility, BUYER_VISIBILITY_TYPES, "named");
  const response_mode = pick(body.response_mode, RESPONSE_MODES, "quote_room");
  // Auction deadline only applies to a timed auction; accept epoch ms or ISO.
  let deadline: number | null = null;
  if (engagement_type === "auction" && auction_format === "timed") {
    deadline = epoch(body.deadline);
  }
  const parsed = OpportunitySchema.safeParse({
    id: newId("opp"), created: now, updated: now,
    buyer_org: String(body.buyer_org ?? ""), title: String(body.title), scope,
    sites: typeof body.sites === "number" ? body.sites : null,
    regions: strArray(body.regions, 10),
    summary: String(body.summary ?? ""), budget_note: String(body.budget_note ?? ""), timeline_note: String(body.timeline_note ?? ""),
    status: "open", engagement_type, auction_format, deadline, eligibility, visibility,
    awarded_vendor_slug: null, buyer_token: newId("btok"), invited: [], feed: [],
    // Project notice fields
    buyer_visibility,
    buyer_sector: String(body.buyer_sector ?? ""),
    buyer_size_band: String(body.buyer_size_band ?? ""),
    users_band: String(body.users_band ?? ""),
    remote_users_band: String(body.remote_users_band ?? ""),
    cloud_platforms: strArray(body.cloud_platforms, 10),
    current_environment: String(body.current_environment ?? "").slice(0, 4000),
    desired_outcomes: String(body.desired_outcomes ?? "").slice(0, 4000),
    compliance_requirements: strArray(body.compliance_requirements, 12),
    evidence_requested: strArray(body.evidence_requested, 12),
    evaluation_priorities: strArray(body.evaluation_priorities, 12),
    response_mode,
    response_deadline: epoch(body.response_deadline),
    decision_target: epoch(body.decision_target),
    go_live_target: epoch(body.go_live_target),
    ai_summary: String(body.ai_summary ?? "").slice(0, 2000),
    ai_assumptions: strArray(body.ai_assumptions, 10),
    ai_gap_flags: strArray(body.ai_gap_flags, 10),
    methodology_version: "sase-marketplace-2026.1",
    owner_email: session.email ?? "",
  });
  if (!parsed.success) return Response.json({ error: "Invalid opportunity." }, { status: 422, headers: cors });
  let opp = await saveOpportunity(parsed.data);
  opp = await addFeedItem(opp, "buyer", null, (buyer_visibility === "anonymous" ? "" : opp.buyer_org) || "Buyer", "post", opp.summary || opp.title);
  // This POST is the only moment an Opportunity exists at all (no draft
  // state precedes it), so it is also the only correct moment to alert the
  // team — see notify.ts's notifyOpportunityPublishedLead for the reasoning.
  try { await notifyOpportunityPublishedLead(opp); } catch { /* best effort */ }
  return Response.json(opp, { headers: cors });
}
