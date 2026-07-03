import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, kvConfigured, saveOpportunity, getOpportunity, newId, kvGetJson, kvSetJson } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { inviteSupplier } from "@/lib/rfp-connect";
import { buildShortlist } from "@/lib/shortlist-core";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { SITE_URL } from "@/lib/structured-data";
import { OpportunitySchema, type Opportunity, type OppScope } from "@/lib/opportunity-types";
import type { ProjectDetails } from "@/lib/rfp-types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/** Map the RFP's product scope + operating model onto board scope tags. */
function boardScope(p: ProjectDetails): OppScope[] {
  const scope: OppScope[] = [];
  if (p.buyer.product_scope === "sse_only") scope.push("sse");
  else if (p.buyer.product_scope === "sdwan_only") scope.push("sd_wan");
  else scope.push("sase");
  if (p.buyer.operating_model === "managed" || p.buyer.operating_model === "co_managed") scope.push("managed_service");
  return scope;
}

/** Create or refresh the public board notice for a published RFP. */
async function listOnBoard(p: ProjectDetails, ownerEmail: string): Promise<{ opportunity_id: string; url: string }> {
  const mapKey = `rfp:${p.id}:board_opp`;
  const existingId = await kvGetJson<string>(mapKey);
  const existing = existingId ? await getOpportunity(existingId) : null;

  const questionCount = p.rfp_sections.filter((s) => s.included).reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
  const sectionCount = p.rfp_sections.filter((s) => s.included).length;
  const summary =
    `The buyer has issued a full structured RFP (${questionCount} questions across ${sectionCount} sections, ` +
    `Netify SASE Methodology v${p.methodology_version}). Suppliers respond to the RFP question set with evidence; ` +
    `pricing stays private to the buyer.`;

  const base: Opportunity = OpportunitySchema.parse({
    id: existing?.id ?? newId("opp"),
    created: existing?.created ?? Date.now(),
    updated: Date.now(),
    buyer_org: existing?.buyer_org ?? "",
    title: p.title,
    scope: boardScope(p),
    sites: p.buyer.site_count,
    regions: p.buyer.regions,
    summary,
    budget_note: existing?.budget_note ?? "",
    timeline_note: existing?.timeline_note ?? "",
    status: "open",
    engagement_type: "quote_room",
    auction_format: "open",
    deadline: null,
    eligibility: "open",
    visibility: "public",
    awarded_vendor_slug: existing?.awarded_vendor_slug ?? null,
    buyer_token: existing?.buyer_token ?? newId("btok"),
    invited: existing?.invited ?? [],
    feed: existing?.feed ?? [],
    buyer_visibility: "anonymous", // RFPs carry no org name; sector/size describe the buyer
    buyer_sector: p.buyer.sector ?? "",
    buyer_size_band: p.buyer.organisation_size === "any" ? "" : p.buyer.organisation_size,
    compliance_requirements: p.buyer.compliance,
    response_mode: "full_rfp",
    ai_summary: `Buyer seeks ${p.buyer.product_scope === "sse_only" ? "an SSE" : p.buyer.product_scope === "sdwan_only" ? "an SD-WAN" : "a SASE"} solution${p.buyer.operating_model === "managed" ? " as a managed service" : ""}${p.buyer.sector ? ` in the ${p.buyer.sector.replace(/_/g, " ")} sector` : ""}${p.buyer.site_count ? ` across ${p.buyer.site_count} sites` : ""}. A full RFP with methodology-mapped questions has been issued; sign in as a verified supplier to register interest.`,
    methodology_version: p.methodology_version,
    owner_email: ownerEmail,
    source_rfp_id: p.id,
  });

  const saved = await saveOpportunity(base);
  await kvSetJson(mapKey, saved.id);
  return { opportunity_id: saved.id, url: `${SITE_URL}/opportunities/${saved.id}/` };
}

/**
 * Publish an RFP: invite the best-fit graded vendors, move the RFP to
 * published and — when the owner is signed in — list it on the public
 * opportunity board. Owner-only (manage_token or the owning account); a
 * plain buyer session is not enough.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { manage_token?: string; shortlist_size?: number } = {};
  try { body = await req.json(); } catch { /* body optional */ }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Publishing this RFP", cors);

  const size = Math.min(Math.max(Number(body.shortlist_size ?? 8), 3), 12);
  const result = buildShortlist(getShortlistDataset(), {
    sector: project.buyer.sector ?? null,
    organisation_size: project.buyer.organisation_size ?? "any",
    service_model: project.buyer.operating_model ?? "any",
    required_regions: project.buyer.regions ?? [],
    shortlist_size: size,
  }, FEATURE_NAMES);

  const invited: { slug: string; name: string; supplier_url: string }[] = [];
  for (const v of result.shortlist) {
    const r = await inviteSupplier(project.id, v.slug, `You are invited to respond to the RFP "${project.title}".`);
    if (!("error" in r)) invited.push({ slug: v.slug, name: r.vendor_name, supplier_url: `${SITE_URL}/rfp-builder/${project.id}/respond?token=${project.share_token}` });
  }

  const published = await saveProject({ ...project, status: "published", invited_vendors: Array.from(new Set([...project.invited_vendors, ...invited.map((i) => i.slug)])) });

  // Public board listing needs an accountable identity, so it happens only for
  // a signed-in owner (matching the notice publisher's login-to-publish rule).
  // Token-only publishes (agents, logged-out buyers) still invite the curated
  // list, and the response says why the board listing was skipped.
  let board: { listed: boolean; opportunity_id?: string; url?: string; reason?: string };
  const sessionEmail = access.session && (access.session.role === "buyer" || access.session.role === "netify") ? access.session.email : "";
  if (sessionEmail) {
    try {
      const listed = await listOnBoard(published, sessionEmail);
      board = { listed: true, ...listed };
    } catch {
      board = { listed: false, reason: "Board listing failed; try re-publishing." };
    }
  } else {
    board = { listed: false, reason: "Sign in to also list this RFP on the public opportunity board. Publishing while signed out invites the curated suppliers only." };
  }

  return Response.json({ ok: true, status: published.status, invited, criteria: result.criteria_summary, board }, { headers: cors });
}
