import { saveProject, saveOpportunity, getOpportunity, newId, kvGetJson, kvSetJson, indexRfpForBuyer, listSignoffs, listPublicOpportunities } from "@/lib/rfp-store";
import { ensureDistinctNoticeTitle } from "@/lib/notice-title";
import { advanceProject, recordProjectEvent } from "@/lib/project-machine";
import { publishDecisionGate, declinedConfirmationText, PUBLISH_DESPITE_DECLINED_ACTION, ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { inviteSupplier } from "@/lib/rfp-connect";
import { regionHintFromEmail } from "@/lib/region-hint";
import { buildShortlist } from "@/lib/shortlist-core";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { SITE_URL } from "@/lib/structured-data";
import { emailDomain } from "@/lib/access-control";
import { OpportunitySchema, type Opportunity, type OppScope } from "@/lib/opportunity-types";
import { publicNoticeQualityGate, SECTOR_NOT_STATED } from "@/lib/notice-validate";
import { pingIndexNow, noticePingPaths } from "@/lib/indexnow";
import { verifyBusinessEmail, type BusinessVerification } from "@/lib/verify-business";
import { FOLLOW_UP_NOTE, PROMISES_PARAGRAPH } from "@/lib/publish-promises";
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

/**
 * Thrown when the automatic business verification chain fails at the
 * publish click (Robert's Rulings One and Two, 29 Jul 2026). The
 * requirement is SAVED, the email is CAPTURED as a lead on the internal
 * list, and nothing publishes anywhere. The message is what the buyer
 * reads; wording PROVISIONAL pending Harry's copy pass (the business-email
 * rejection message, pass four of five).
 */
export class SavedUnpublishedError extends Error {
  code = "saved_unpublished" as const;
  verification: BusinessVerification;
  return_url: string;
  constructor(verification: BusinessVerification, returnUrl: string) {
    super(
      verification.failed_check === "mx" || verification.failed_check === "website"
        ? "We could not verify that email address's company domain, so nothing has been published. Your requirement is saved and will keep. Publishing needs a working business email address because suppliers need to know which business they are responding to."
        : "Publishing needs a business email address, because suppliers need to know which business they are responding to. Nothing has been published. Your requirement is saved and will keep; come back with your work address and it publishes without redoing anything.",
    );
    this.verification = verification;
    this.return_url = returnUrl;
  }
}

/**
 * The internal list entry (Harry's list): every publish outcome, published
 * or saved-unpublished, with the buyer contact, the derived company, the
 * verification evidence and the requirement depth. Private: KV only, admin
 * surface only, never any public projection.
 */
async function recordPublishLead(entry: {
  state: "published" | "saved_unpublished";
  rfp_id: string;
  email: string;
  verification: BusinessVerification | null;
  requirement_depth: { questions: number; sections: number };
  board_opportunity_id?: string;
  reason?: string;
}): Promise<void> {
  try {
    const key = "publish:leads";
    const list = (await kvGetJson<Array<Record<string, unknown>>>(key)) ?? [];
    // One live entry per RFP: a later outcome supersedes (the saved
    // unpublished buyer who returns with a work address becomes published).
    const kept = list.filter((e) => e.rfp_id !== entry.rfp_id);
    kept.push({ at: Date.now(), ...entry });
    await kvSetJson(key, kept.slice(-500));
  } catch { /* the list is a record, never a gate */ }
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

  // No two identical open titles on the board (Harry's Section 1 finding,
  // 28 Jul 2026): the new listing's title gains one distinguishing stated
  // fact when it would collide with another open notice's display title.
  const openTitles = (await listPublicOpportunities().catch(() => []))
    .filter((o) => o.id !== (existing?.id ?? ""))
    .map((o) => o.title);
  const distinctTitle = ensureDistinctNoticeTitle(
    p.title,
    {
      sites: p.buyer.site_count ?? null,
      regions: p.buyer.regions ?? [],
      created: existing?.created ?? Date.now(),
      // RFP notices list anonymously; the title's site figure follows the
      // same exact-unless-identifying rule as the notice body.
      buyer_sector: p.buyer.sector || SECTOR_NOT_STATED,
      buyer_visibility: "anonymous",
    },
    openTitles,
  );

  const base: Opportunity = OpportunitySchema.parse({
    id: existing?.id ?? newId("opp"),
    created: existing?.created ?? Date.now(),
    updated: Date.now(),
    buyer_org: existing?.buyer_org ?? "",
    title: distinctTitle,
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
    // Unstated is a value (the intake-truth law, 28 Jul 2026): a notice
    // listed from an RFP whose buyer never stated a sector says so
    // explicitly. The public record reads "Not stated", never a guess.
    buyer_sector: p.buyer.sector || SECTOR_NOT_STATED,
    buyer_size_band: p.buyer.organisation_size === "any" ? "" : p.buyer.organisation_size,
    compliance_requirements: p.buyer.compliance,
    response_mode: "full_rfp",
    ai_summary: `Buyer seeks ${p.buyer.product_scope === "sse_only" ? "an SSE" : p.buyer.product_scope === "sdwan_only" ? "an SD-WAN" : "a SASE"} solution${p.buyer.operating_model === "managed" ? " as a managed service" : ""}${p.buyer.sector ? ` in the ${sectorLabel(p.buyer.sector)} sector` : ""}${p.buyer.site_count ? ` across ${p.buyer.site_count} sites` : ""}. A full RFP with methodology-mapped questions has been issued; sign in as a verified supplier to register interest.`,
    methodology_version: p.methodology_version,
    // The instrument's true shape rides the notice (Robert's R8 ruling,
    // 28 Jul 2026): section titles and counts only, never the questions;
    // the full set opens to participating suppliers.
    rfp_shape: {
      version: p.methodology_version,
      total: questionCount,
      sections: activeSections.map((s) => ({ title: s.category, questions: s.questions.filter((q) => q.priority !== "optional").length })),
    },
    owner_email: ownerEmail,
    source_rfp_id: p.id,
  });

  // The public quality gate (Robert's ruling, 28 Jul 2026): no test data,
  // coherent figures, sector stated or explicitly not stated. A gate failure
  // must never fail the publish itself — the RFP still goes to its invited
  // suppliers — it only keeps the notice off the public board, with the
  // reason handed back to the caller.
  const gateFailures = publicNoticeQualityGate(base);
  if (gateFailures.length > 0) {
    throw new BoardQualityGateError(gateFailures);
  }

  const saved = await saveOpportunity(base);
  await kvSetJson(mapKey, saved.id);
  // A new or refreshed public notice is news: tell IndexNow the notice,
  // board and sitemap changed. Best effort; never blocks the listing.
  try { await pingIndexNow(noticePingPaths(saved.id)); } catch { /* accelerant, never a dependency */ }
  return { opportunity_id: saved.id, url: `${SITE_URL}/opportunities/${saved.id}/` };
}

/** Thrown when the public quality gate keeps an RFP's notice off the board. */
export class BoardQualityGateError extends Error {
  code = "board_quality_gate" as const;
  failures: string[];
  constructor(failures: string[]) {
    super(`Not listed on the public board: ${failures.join(" ")}`);
    this.failures = failures;
  }
}

/**
 * Recover one historic publish that never reached the board (Robert's
 * ruling, 29 Jul 2026: 46 published, 14 ever seen by a supplier; the rest
 * should be publishable without the buyer redoing anything where a business
 * email exists). Runs the same verification chain as a fresh publish on the
 * stored owner email: pass and the notice lists through the same gate and
 * pipeline as any publish; fail (or no email, or the quality gate refuses
 * the content) and the record lands on the internal list as
 * saved-unpublished with the reason. Never throws; the outcome is the
 * answer. Invites are NOT re-run: listing is listRfpOnBoard's whole job.
 */
export async function recoverUnlistedPublish(
  p: ProjectDetails,
  contactFallback: string | null = null,
): Promise<{ state: "published" | "saved_unpublished"; reason: string | null; opportunity_id?: string }> {
  const email = p.owner_email || contactFallback || "";
  const depth = {
    questions: p.rfp_sections.filter((s) => s.included).reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0),
    sections: p.rfp_sections.filter((s) => s.included && s.questions.some((q) => q.priority !== "optional")).length,
  };
  if (!email) {
    await recordPublishLead({ state: "saved_unpublished", rfp_id: p.id, email: "", verification: null, requirement_depth: depth, reason: "no email on the record" });
    return { state: "saved_unpublished", reason: "no email on the record" };
  }
  const verification = await verifyBusinessEmail(email);
  if (!verification.passed) {
    const reason = `verification failed: ${verification.failed_check ?? "unknown"}`;
    await recordPublishLead({ state: "saved_unpublished", rfp_id: p.id, email, verification, requirement_depth: depth, reason });
    return { state: "saved_unpublished", reason };
  }
  try {
    const listed = await listRfpOnBoard(p, email);
    await recordPublishLead({ state: "published", rfp_id: p.id, email, verification, requirement_depth: depth, board_opportunity_id: listed.opportunity_id });
    return { state: "published", reason: null, opportunity_id: listed.opportunity_id };
  } catch (e) {
    const reason = e instanceof BoardQualityGateError ? e.message : "board listing failed";
    await recordPublishLead({ state: "saved_unpublished", rfp_id: p.id, email, verification, requirement_depth: depth, reason });
    return { state: "saved_unpublished", reason };
  }
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
  // The confirmation email is the first interaction, not a receipt
  // (Robert's Ruling Three, 29 Jul 2026): it carries the requirement, the
  // four promises, what happens next with real dates, and who is looking
  // after it. WORDING PROVISIONAL pending Harry's copy pass (the
  // confirmation email, pass three of five).
  const activeSectionsForEmail = p.rfp_sections.filter((s) => s.included && s.questions.some((q) => q.priority !== "optional"));
  const questionCountForEmail = activeSectionsForEmail.reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
  const deadlineLine = p.response_deadline
    ? new Date(p.response_deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  await send({
    from,
    to: ownerEmail,
    subject: "Your requirement is live. Here is what happens next",
    html:
      `<p>Hello,</p>` +
      `<p><strong>What you published:</strong> "${p.title}"${questionCountForEmail ? `, a structured requirement of ${questionCountForEmail} questions across ${activeSectionsForEmail.length} section${activeSectionsForEmail.length === 1 ? "" : "s"}` : ""}. It is attached to your workspace and nothing about it can change without you.</p>` +
      `<p><strong>What happens to your information:</strong> ${PROMISES_PARAGRAPH} The vetting standard is published at <a href="${SITE_URL}/supplier-vetting-standard/">${SITE_URL}/supplier-vetting-standard/</a>.</p>` +
      `<p><strong>What happens next:</strong> ${invited.length} evaluated supplier${invited.length === 1 ? "" : "s"} ${invited.length === 1 ? "has" : "have"} been matched and invited${invited.length ? ` (${invited.map((v) => v.name).join(", ")})` : ""}. Their responses arrive side by side in your workspace, and pricing stays private to you.${deadlineLine ? ` The response window closes on ${deadlineLine}.` : ""}</p>` +
      bandBlock +
      (report?.matched?.region_assumption ? `<p><em>${report.matched.region_assumption}</em></p>` : "") +
      pinnedNoteFor(p) +
      `<p>To make replying fast, each invited supplier starts from a response Netify pre-drafted from its public-evidence evaluation of that vendor. They confirm, correct and add their pricing; capabilities Netify could not evidence are left blank for them to answer.</p>` +
      gapsBlock +
      `<p><strong>Your document:</strong> download your requirement as Word or PDF from your workspace to circulate internally.</p>` +
      `<p><a href="${rfpUrl}">Open your workspace</a></p>` +
      `<p><strong>Who is looking after this:</strong> ${report?.analyst_note ?? FOLLOW_UP_NOTE}</p><p>Netify research team</p>`,
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

  // The automatic business verification chain (Rulings One and Two, 29 Jul
  // 2026), on the click, before anything sends or lists: list check, MX,
  // live website, Companies House evidence for UK domains. Fail: nothing
  // publishes, the requirement stays saved, the email is captured on the
  // internal list, and the buyer is told plainly why. Pass: the evidence
  // rides the record and the publish continues. One choke point for the
  // web page, the MCP publish tools and the magic-link confirm (Article 17).
  //
  // The SESSION email is what the chain verifies, never the stored owner
  // (Harry's retest F11, 29 Jul 2026: his draft was claimed days earlier
  // under a personal gmail, so the stored owner beat the work-email session
  // pressing publish and the chain refused a legitimate business publish).
  // The ruling is precise: the confirmation click proves the person
  // controls an address at that company, and the person clicking IS the
  // session. This also makes the rejection message's promise true: come
  // back with your work address and it publishes without redoing anything.
  const publishEmail = sessionEmail || project.owner_email;
  const requirementDepth = {
    questions: activeQuestionCount,
    sections: project.rfp_sections.filter((s) => s.included && s.questions.some((q) => q.priority !== "optional")).length,
  };
  const verification = await verifyBusinessEmail(publishEmail);
  if (!verification.passed) {
    await recordPublishLead({
      state: "saved_unpublished",
      rfp_id: project.id,
      email: publishEmail,
      verification,
      requirement_depth: requirementDepth,
    });
    throw new SavedUnpublishedError(verification, `${SITE_URL}/rfp-builder/${project.id}/`);
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
      business_verification: { ...verification },
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
    // The record-keeping gap Harry proved (24 July 2026): builder-lane
    // projects published with EMPTY history, so the Timeline read "No
    // recorded events yet" on a project created and published the same
    // morning. The same append-only events the engine lane records are
    // recorded here; nothing is invented, both facts ARE this call. The
    // record must never block the publish, so failures fall through to
    // the plain write.
    let p: ProjectDetails = {
      ...working,
      status: "published",
      owner_email: ownerEmail,
      response_deadline: responseDeadline,
      invited_vendors: mergedInvited,
      pending_submit: undefined,
      business_verification: { ...verification },
    };
    try {
      const now = Date.now();
      p = recordProjectEvent(p, { at: now, actor: "buyer", actor_ref: ownerEmail, via: "web", event: "publish.consented", detail: {}, consent: true });
      p = recordProjectEvent(p, { at: now + 1, actor: "buyer", actor_ref: ownerEmail, via: "web", event: "publish.live", detail: { invited: invited.length } });
    } catch { /* the history is a record, never a gate */ }
    published = await saveProject(p);
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
    } catch (e) {
      // The quality gate says exactly why a notice stayed off the board
      // (Robert's ruling, 28 Jul 2026); other failures keep the generic line.
      board = e instanceof BoardQualityGateError
        ? { listed: false, reason: e.message }
        : { listed: false, reason: "Board listing failed; try re-publishing." };
    }
  }

  // The internal list hears every outcome (Ruling One): this publish, with
  // its evidence, derived company and requirement depth. Best effort.
  await recordPublishLead({
    state: "published",
    rfp_id: published.id,
    email: publishEmail,
    verification,
    requirement_depth: requirementDepth,
    ...(board.listed && board.opportunity_id ? { board_opportunity_id: board.opportunity_id } : {}),
  });

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
      analyst_note: FOLLOW_UP_NOTE,
    };
  }

  // Notifications are best effort and never block the publish.
  try { await sendPublishEmails(published, ownerEmail, invited, market_report); } catch { /* best effort */ }

  return { published, invited, criteria: result.criteria_summary, board, market_report };
}
