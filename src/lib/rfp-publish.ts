import { saveProject, saveOpportunity, getOpportunity, newId, kvGetJson, kvSetJson, indexRfpForBuyer, listSignoffs } from "@/lib/rfp-store";
import { advanceProject, recordProjectEvent } from "@/lib/project-machine";
import { publishDecisionGate, declinedConfirmationText, PUBLISH_DESPITE_DECLINED_ACTION, ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { inviteSupplier } from "@/lib/rfp-connect";
import { regionHintFromEmail } from "@/lib/region-hint";
import { buildShortlist } from "@/lib/shortlist-core";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { SITE_URL } from "@/lib/structured-data";
import { emailDomain } from "@/lib/access-control";
import { OpportunitySchema, type Opportunity, type OppScope } from "@/lib/opportunity-types";
import { sectorLabel } from "@/lib/rfp-document";
import { RFP_ORG_SIZES, labelFor } from "@/lib/notice-options";
import { buildMarketReport, formatBandGBP, type MarketReport } from "@/lib/market-report";
import type { ProjectDetails } from "@/lib/rfp-types";

/**
 * The publish core, shared by the publish API route (buyer presses Submit in
 * the builder) and the auth verify endpoint (buyer clicks the "Confirm and
 * submit" magic link, with the submit intent carried on the draft as
 * pending_submit). Callers are responsible for identity: pass the verified
 * session email of the person the publish is attributed to.
 */

export type PublishOpts = {
  shortlist_size?: number;
  list_on_board?: boolean;
  marketing_opt_in?: boolean;
  /** D5 (Robert's amendment): publishing after a declined approval is
   *  allowed only as an intentional, recorded decision. */
  acknowledge_declined_approval?: boolean;
};

/** Thrown when a declined approval requires the explicit confirmation. */
export class DeclinedApprovalError extends Error {
  code = "declined_approval" as const;
}

export type PublishResult = {
  published: ProjectDetails;
  invited: { slug: string; name: string; supplier_url: string }[];
  criteria: string;
  board: { listed: boolean; opportunity_id?: string; url?: string; reason?: string };
  /** The instant publish reward: matched suppliers, price band, gaps. Never late because it is synchronous. */
  market_report: MarketReport;
};

/** Map the RFP's product scope + operating model onto board scope tags. */
function boardScope(p: ProjectDetails): OppScope[] {
  const scope: OppScope[] = [];
  if (p.buyer.product_scope === "sse_only") scope.push("sse");
  else if (p.buyer.product_scope === "sdwan_only") scope.push("sd_wan");
  else scope.push("sase");
  if (p.buyer.operating_model === "managed" || p.buyer.operating_model === "co_managed") scope.push("managed_service");
  return scope;
}

/** Create or refresh the public board notice for a published RFP. Exported
 *  for the standing list-on-board action (published RFPs that skipped the
 *  board at publish time can list later without re-running invites). */
export async function listRfpOnBoard(p: ProjectDetails, ownerEmail: string): Promise<{ opportunity_id: string; url: string }> {
  const mapKey = `rfp:${p.id}:board_opp`;
  const existingId = await kvGetJson<string>(mapKey);
  const existing = existingId ? await getOpportunity(existingId) : null;

  // Count only sections that actually carry active questions (Harry's QA,
  // RFP Builder F3: the notice said "across 5 sections" while the document
  // rendered 2, because included-but-empty sections were being counted).
  const activeSections = p.rfp_sections.filter((s) => s.included && s.questions.some((q) => q.priority !== "optional"));
  const questionCount = activeSections.reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
  const sectionCount = activeSections.length;
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
    ai_summary: `Buyer seeks ${p.buyer.product_scope === "sse_only" ? "an SSE" : p.buyer.product_scope === "sdwan_only" ? "an SD-WAN" : "a SASE"} solution${p.buyer.operating_model === "managed" ? " as a managed service" : ""}${p.buyer.sector ? ` in the ${sectorLabel(p.buyer.sector)} sector` : ""}${p.buyer.site_count ? ` across ${p.buyer.site_count} sites` : ""}. A full RFP with methodology-mapped questions has been issued; sign in as a verified supplier to register interest.`,
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
function pinnedNoteFor(p: ProjectDetails): string {
  const pins = (p.buyer.pinned_vendors ?? []).filter(Boolean);
  return pins.length ? `<p><em>Includes the vendor${pins.length === 1 ? "" : "s"} you named for evaluation: ${pins.join(", ")}.</em></p>` : "";
}

async function sendPublishEmails(p: ProjectDetails, ownerEmail: string, invited: { name: string }[], report?: MarketReport) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? "support@netify.com";
  const rfpUrl = `${SITE_URL}/rfp-builder/${p.id}/`;
  const supplierNames = invited.map((v) => v.name).join("\n");
  const org = [
    p.buyer.sector && `Sector: ${sectorLabel(p.buyer.sector)}`,
    p.buyer.organisation_size && p.buyer.organisation_size !== "any" && `Size: ${labelFor(RFP_ORG_SIZES, p.buyer.organisation_size)}`,
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
    html: `<p><strong>${p.title}</strong> (${p.id}) was published by <strong>${ownerEmail}</strong>.</p>${org ? `<p>${org}</p>` : ""}<p><strong>Suppliers auto-selected:</strong></p><pre>${supplierNames}</pre>${report?.matched?.region_assumption ? `<p><em>${report.matched.region_assumption}</em></p>` : ""}${pinnedNoteFor(p)}<p><a href="${rfpUrl}">Open the RFP</a></p>`,
  });

  // Confirmation to the buyer, carrying the Market Report (18 July 2026):
  // the publish reward stated in the email itself — price band, matched
  // suppliers, gaps and the document downloads — so the value survives even
  // if the buyer never returns to the app.
  const bandBlock = report?.estimate
    ? `<p><strong>Your indicative market price band</strong> (Netify TCO Methodology ${report.estimate.methodology_version}):<br/>` +
      `Monthly: <strong>${formatBandGBP(report.estimate.monthly_band_gbp)}</strong> · 3-year TCO: <strong>${formatBandGBP(report.estimate.three_year_tco_band_gbp)}</strong></p>` +
      (report.assumptions.length ? `<p style="font-size:12px;color:#555">Band assumptions: ${report.assumptions.join(" ")}</p>` : "")
    : "";
  const gapsBlock = report && report.gaps.length
    ? `<p><strong>Gaps worth closing</strong> (edit your RFP any time; suppliers always see the latest version):</p><ul>${report.gaps.map((g) => `<li>${g}</li>`).join("")}</ul>`
    : "";
  await send({
    from,
    to: ownerEmail,
    subject: "Your RFP is live. Here is your Netify Market Report",
    html:
      `<p>Hello,</p><p>Your RFP "${p.title}" has been published to ${invited.length} curated suppliers on the Netify marketplace. Their responses arrive side by side in your workspace, and pricing stays private to you.</p>` +
      bandBlock +
      (invited.length ? `<p><strong>Going to:</strong> ${invited.map((v) => v.name).join(", ")}.</p>` : "") +
      (report?.matched?.region_assumption ? `<p><em>${report.matched.region_assumption}</em></p>` : "") +
      pinnedNoteFor(p) +
      `<p>To make replying fast, each invited supplier starts from a response Netify pre-drafted from its public-evidence evaluation of that vendor. They confirm, correct and add their pricing; capabilities Netify could not evidence are left blank for them to answer.</p>` +
      gapsBlock +
      `<p><strong>Your document:</strong> download your RFP as Word or PDF from your workspace to circulate internally.</p>` +
      `<p><a href="${rfpUrl}">Open your RFP workspace</a></p>` +
      `<p>${report?.analyst_note ?? "A Netify analyst reviews every published RFP."}</p><p>Netify research team</p>`,
  });
}

/**
 * Execute a publish: invite the best-fit graded vendors, move the RFP to
 * published (adopting ownership onto sessionEmail when the draft has no
 * owner), set the response window, optionally list on the public board,
 * record marketing consent and send the notifications. Clears any
 * pending_submit intent so the action can never run twice from the same
 * stored instruction.
 */
export async function executePublish(project: ProjectDetails, sessionEmail: string, opts: PublishOpts): Promise<PublishResult> {
  // Minimum-content gate (Harry's QA, RFP Builder F2): submit was live at
  // zero questions, one click from dispatching an empty requirement to real
  // supplier contacts. The gate is server-side so every client (the page,
  // the MCP publish tools, and the verify path's pending_submit) refuses
  // identically (Article 17).
  const activeQuestionCount = project.rfp_sections
    .filter((s) => s.included)
    .reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
  if (activeQuestionCount === 0) {
    throw new Error(
      "This RFP has no questions yet, so there is nothing for suppliers to respond to. Describe your project and generate the question set first; nothing has been sent.",
    );
  }

  const size = Math.min(Math.max(Number(opts.shortlist_size ?? 8), 3), 12);
  // Region hint (20 July 2026, the ministry lesson): when the buyer stated no
  // regions, weight the ranking by the email's country TLD. Never filters;
  // declared to the buyer as an assumption in the confirmation email.
  const statedRegions = (project.buyer.regions ?? []).filter(Boolean);
  const regionHint = statedRegions.length === 0 ? regionHintFromEmail(project.owner_email || sessionEmail) : null;
  const result = buildShortlist(getShortlistDataset(), {
    sector: project.buyer.sector ?? null,
    organisation_size: project.buyer.organisation_size ?? "any",
    service_model: project.buyer.operating_model ?? "any",
    required_regions: statedRegions,
    ...(regionHint ? { preferred_regions: [regionHint.region] } : {}),
    shortlist_size: size,
  }, FEATURE_NAMES);

  // Buyer-named vendors are always invited (explicit intent beats inference),
  // capped upstream at five; the ranked shortlist fills the remainder.
  const pinSlugs = (project.buyer.pinned_vendors ?? []).filter(Boolean);
  const inviteSlugs = [...new Set([...pinSlugs, ...result.shortlist.map((v) => v.slug)])].slice(0, Math.max(size, pinSlugs.length));
  const invited: { slug: string; name: string; supplier_url: string }[] = [];
  for (const v of inviteSlugs.map((slug) => ({ slug }))) {
    const r = await inviteSupplier(
      project.id,
      v.slug,
      `You are invited to respond to the RFP "${project.title}". Netify has pre-drafted evidence answers for your organisation from its public capability evaluation; open your response link, review the draft, correct anything and add your pricing. Most of the writing is already done.`,
    );
    if (!("error" in r)) invited.push({ slug: v.slug, name: r.vendor_name, supplier_url: `${SITE_URL}/rfp-builder/${project.id}/respond?token=${project.share_token}` });
  }

  // Publish is the strongest identity-capture moment: adopt ownership onto
  // the verified account when the RFP has no owner yet, so the RFP appears
  // under the buyer's account.
  const ownerEmail = project.owner_email || sessionEmail;
  // Response window: 14 days by default from the moment of submission,
  // preserved on re-sends so the clock never quietly restarts.
  const responseDeadline = project.response_deadline ?? Date.now() + 14 * 86400000;

  // D5 decision gate (Robert's amendment): a declined approval never
  // vetoes, but publishing against it must be an intentional, recorded
  // decision. The confirmation wording is recorded verbatim as consent.
  const signoffs = await listSignoffs(project.id);
  let working: ProjectDetails = project;
  if (
    opts.acknowledge_declined_approval === true &&
    signoffs.some((a) => a.decision === "declined") &&
    !(working.consents ?? []).some((c) => c.action === PUBLISH_DESPITE_DECLINED_ACTION)
  ) {
    working = {
      ...working,
      consents: [
        ...(working.consents ?? []),
        { at: Date.now(), action: PUBLISH_DESPITE_DECLINED_ACTION, granted_by: ownerEmail, via: "web" as const, text: declinedConfirmationText(signoffs) },
      ],
    };
  }
  const gate = publishDecisionGate(signoffs, working.consents);
  if (gate.blocked) throw new DeclinedApprovalError(gate.confirmationText);

  const mergedInvited = Array.from(new Set([...project.invited_vendors, ...invited.map((i) => i.slug)]));
  let published: ProjectDetails;
  if (project.engine) {
    // Engine records publish THROUGH THE MACHINE (the legacy direct
    // status write is refused by the write gate for engine records, by
    // design): publish consent recorded verbatim, then the drafted to
    // published transition with its guards (consent + the gap gate).
    const now = Date.now();
    let p: ProjectDetails = {
      ...working,
      owner_email: ownerEmail,
      response_deadline: responseDeadline,
      invited_vendors: mergedInvited,
      pending_submit: undefined,
    };
    if (!(p.consents ?? []).some((c) => c.action === "publish")) {
      p = {
        ...p,
        consents: [...(p.consents ?? []), { at: now, action: "publish", granted_by: ownerEmail, via: "web" as const, text: ENGINE_PUBLISH_CONSENT_TEXT }],
      };
      p = recordProjectEvent(p, { at: now, actor: "buyer", actor_ref: ownerEmail, via: "web", event: "publish.consented", detail: {}, consent: true });
    }
    p = advanceProject(p, { at: now + 1, actor: "buyer", actor_ref: ownerEmail, via: "web", event: "publish.live", detail: { invited: invited.length } });
    published = await saveProject(p);
  } else {
    published = await saveProject({
      ...working,
      status: "published",
      owner_email: ownerEmail,
      response_deadline: responseDeadline,
      invited_vendors: mergedInvited,
      pending_submit: undefined,
    });
  }
  if (!project.owner_email) {
    try { await indexRfpForBuyer(sessionEmail, published.id); } catch { /* best effort */ }
  }

  // A publish also lists the RFP on the public opportunity board unless the
  // caller opted for matched suppliers only (the wizard-submit default,
  // 15 July 2026).
  let board: { listed: boolean; opportunity_id?: string; url?: string; reason?: string };
  if (opts.list_on_board === false) {
    board = { listed: false, reason: "Matched suppliers only; not listed on the public board." };
  } else {
    try {
      const listed = await listRfpOnBoard(published, sessionEmail);
      board = { listed: true, ...listed };
    } catch {
      board = { listed: false, reason: "Board listing failed; try re-publishing." };
    }
  }

  // Optional marketing consent captured at the agreement step is recorded
  // against the verified identity the publish runs as.
  if (opts.marketing_opt_in === true) {
    try {
      const key = "email:marketing_optin";
      const list = (await kvGetJson<string[]>(key)) ?? [];
      const addr = sessionEmail.toLowerCase();
      if (!list.includes(addr)) { list.push(addr); await kvSetJson(key, list); }
    } catch { /* best effort */ }
  }

  // The Market Report: synchronous, deterministic, the buyer's instant
  // reward for publishing. Built after the save so it reflects the published
  // state. A report failure must never fail a publish.
  let market_report: MarketReport;
  try {
    market_report = buildMarketReport(published);
  } catch {
    market_report = {
      generated_at: Date.now(),
      matched: { count: invited.length, names: invited.map((i) => i.name) },
      estimate: null,
      assumptions: [],
      gaps: [],
      document: { sections: 0, questions: 0 },
      analyst_note: "A Netify analyst reviews every published RFP and follows up where a human read adds value.",
    };
  }

  // Notifications are best effort and never block the publish.
  try { await sendPublishEmails(published, ownerEmail, invited, market_report); } catch { /* best effort */ }

  return { published, invited, criteria: result.criteria_summary, board, market_report };
}
