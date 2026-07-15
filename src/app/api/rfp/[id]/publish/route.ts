import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, kvConfigured, saveOpportunity, getOpportunity, newId, kvGetJson, kvSetJson, indexRfpForBuyer } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { inviteSupplier } from "@/lib/rfp-connect";
import { buildShortlist } from "@/lib/shortlist-core";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { SITE_URL } from "@/lib/structured-data";
import { emailDomain } from "@/lib/access-control";
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
 * Publish notifications, best effort: an internal lead alert to the Netify
 * team and a confirmation to the buyer. Sent with the auth transport (Resend,
 * no-reply sender); failures never fail the publish, matching /api/lead.
 */
async function sendPublishEmails(p: ProjectDetails, ownerEmail: string, invited: { name: string }[]) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? "support@netify.com";
  const rfpUrl = `${SITE_URL}/rfp-builder/${p.id}/`;
  const supplierNames = invited.map((v) => v.name).join("\n");
  const org = [
    p.buyer.sector && `Sector: ${p.buyer.sector.replace(/_/g, " ")}`,
    p.buyer.organisation_size && p.buyer.organisation_size !== "any" && `Size: ${p.buyer.organisation_size.replace(/_/g, " ")}`,
    p.buyer.site_count && `Sites: ${p.buyer.site_count}`,
    p.buyer.regions.length > 0 && `Regions: ${p.buyer.regions.join(", ")}`,
  ].filter(Boolean).join("<br/>");

  const send = (payload: Record<string, unknown>) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  // Internal lead alert
  await send({
    from,
    to,
    reply_to: ownerEmail,
    subject: `RFP Published Lead | ${emailDomain(ownerEmail) ?? "unknown"} | ${invited.length} suppliers`,
    html: `<p><strong>${p.title}</strong> (${p.id}) was published by <strong>${ownerEmail}</strong>.</p>${org ? `<p>${org}</p>` : ""}<p><strong>Suppliers auto-selected:</strong></p><pre>${supplierNames}</pre><p><a href="${rfpUrl}">Open the RFP</a></p>`,
  });

  // Confirmation to the buyer
  await send({
    from,
    to: ownerEmail,
    subject: "Your Netify RFP has been published",
    html: `<p>Hello,</p><p>Your RFP "${p.title}" has been published to ${invited.length} curated suppliers on the Netify marketplace.</p><p>What happens next: the Netify team brokers the introductions, gathers supplier responses against your question set, and emails you as responses arrive. There is nothing further you need to do.</p><p><a href="${rfpUrl}">Open your RFP workspace</a></p><p>Netify research team</p>`,
  });
}

/**
 * Publish an RFP: invite the best-fit graded vendors, move the RFP to
 * published, list it on the public opportunity board and notify the Netify
 * team and the buyer. Requires the RFP owner (manage_token or the owning
 * account) AND a verified buyer/netify session: publishing reaches named
 * suppliers, so possession of the draft alone is no longer enough.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { manage_token?: string; shortlist_size?: number; list_on_board?: boolean; marketing_opt_in?: boolean } = {};
  try { body = await req.json(); } catch { /* body optional */ }

  const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
  if (!access.ok) return ownerRequired("Publishing this RFP", cors);

  // Hard identity gate: signed-out owners and agents get a machine-readable
  // handoff instead of a silent token-only publish. Drafting stays open; the
  // manage_token remains the ownership proof, the session is the identity.
  const sessionEmail = access.session && (access.session.role === "buyer" || access.session.role === "netify") ? access.session.email : "";
  if (!sessionEmail) {
    return Response.json(
      {
        error: "sign_in_required",
        auth_required: true,
        message: "Publishing sends this RFP to suppliers, so it needs a verified work email. Open the builder, sign in and publish again; your draft is untouched.",
        sign_in_url: `${SITE_URL}/rfp-builder/${project.id}/`,
      },
      { status: 401, headers: cors },
    );
  }

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

  // Publish is the strongest identity-capture moment: adopt ownership onto
  // the signed-in account when the RFP has no owner yet (mirrors the PUT
  // adopt-ownership rule), so the RFP appears under the buyer's account.
  const ownerEmail = project.owner_email || sessionEmail;
  // Response window: 14 days by default from the moment of submission,
  // preserved on re-sends so the clock never quietly restarts.
  const responseDeadline = project.response_deadline ?? Date.now() + 14 * 86400000;
  const published = await saveProject({ ...project, status: "published", owner_email: ownerEmail, response_deadline: responseDeadline, invited_vendors: Array.from(new Set([...project.invited_vendors, ...invited.map((i) => i.slug)])) });
  if (!project.owner_email) {
    try { await indexRfpForBuyer(sessionEmail, published.id); } catch { /* best effort */ }
  }

  // The sign-in gate guarantees an accountable identity, so a publish also
  // lists the RFP on the public opportunity board unless the caller opted
  // for matched suppliers only (the wizard-submit default, 15 July 2026).
  let board: { listed: boolean; opportunity_id?: string; url?: string; reason?: string };
  if (body.list_on_board === false) {
    board = { listed: false, reason: "Matched suppliers only; not listed on the public board." };
  } else {
    try {
      const listed = await listOnBoard(published, sessionEmail);
      board = { listed: true, ...listed };
    } catch {
      board = { listed: false, reason: "Board listing failed; try re-publishing." };
    }
  }

  // Optional marketing consent captured at the agreement step rides the
  // publish call so it is recorded against the verified session identity.
  if (body.marketing_opt_in === true) {
    try {
      const key = "email:marketing_optin";
      const list = (await kvGetJson<string[]>(key)) ?? [];
      const addr = sessionEmail.toLowerCase();
      if (!list.includes(addr)) { list.push(addr); await kvSetJson(key, list); }
    } catch { /* best effort */ }
  }

  // Notifications are best effort and never block the publish.
  try { await sendPublishEmails(published, ownerEmail, invited); } catch { /* best effort */ }

  return Response.json({ ok: true, status: published.status, invited, criteria: result.criteria_summary, board }, { headers: cors });
}
