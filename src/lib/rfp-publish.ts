import { saveProject, saveOpportunity, getOpportunity, newId, kvGetJson, kvSetJson, indexRfpForBuyer, listSignoffs, listPublicOpportunities, getOrCreateSupplierVendorToken } from "@/lib/rfp-store";
import { ensureDistinctNoticeTitle } from "@/lib/notice-title";
import { advanceProject, recordProjectEvent } from "@/lib/project-machine";
import { publishDecisionGate, declinedConfirmationText, PUBLISH_DESPITE_DECLINED_ACTION, ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { inviteSupplier, vendorBySlug } from "@/lib/rfp-connect";
import { regionHintFromEmail } from "@/lib/region-hint";
import { buildShortlist } from "@/lib/shortlist-core";
import { FEATURE_NAMES } from "@/lib/vendors";
import { getStrictLiveShortlistDataset, LIVE_SHORTLIST_CONTRACT_VERSION } from "@/lib/live-shortlist";
import { SITE_URL } from "@/lib/structured-data";
import { emailDomain } from "@/lib/access-control";
import { OpportunitySchema, type Opportunity, type OppScope } from "@/lib/opportunity-types";
import { publicNoticeQualityGate, SECTOR_NOT_STATED } from "@/lib/notice-validate";
import { pingIndexNow, noticePingPaths } from "@/lib/indexnow";
import { verifyBusinessEmail, type BusinessVerification } from "@/lib/verify-business";
import { FOLLOW_UP_NOTE, PROMISES_PARAGRAPH } from "@/lib/publish-promises";
import { sectorLabel, RFP_DOCUMENT_PIPELINE_VERSION, livingDocumentToRfpSections } from "@/lib/rfp-document";
import { RFP_ORG_SIZES, labelFor } from "@/lib/notice-options";
import { buildMarketReport, formatBandGBP, type MarketReport } from "@/lib/market-report";
import {
  rfpContentSnapshot,
  contentHash,
  getLatestPublishedSnapshot,
  savePublishedSnapshot,
  saveFrozenRevision,
  type PublishedSnapshot,
} from "@/lib/published-snapshot";
import { loadGovernedRevisionState, applyGovernedEvent } from "@/lib/rfp-governed-revision";
import { hasPublished } from "@/lib/project-machine";
import { commitMarketUnlock, isMarketUnlocked, MarketUnlockBindingError } from "@/lib/market-unlock";
import { getPublicationAttempt, savePublicationAttempt, loadResumableAttempt, type PublicationAttempt } from "@/lib/publication-attempt";
import type { ProjectDetails } from "@/lib/rfp-types";
import { persistedEssentialBaselineChecklist } from "@/lib/workspace/publish-checklist";
import {
  anonymousBuyerOrganisation,
  invitationsAllowed,
  isPublicationReplay,
  publicationReadiness,
  quickListingReadiness,
} from "@/lib/publication-policy";

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
  /** F3 (29 Jul 2026, the mockup review Robert approved: the distribution
   *  list is the buyer's). Slugs the ranked fill must not invite. A pinned
   *  vendor beats an exclusion (explicit intent, and the pin is the
   *  stronger word); excluded seats backfill from the next best evidenced;
   *  the public board listing is unaffected. An exclusion is distribution
   *  control, never a judgement on the supplier's record. */
  excluded_vendors?: string[];
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
        ? "We could not verify that email address's company domain, so nothing has been published. Your requirement is saved and will keep. Publishing needs a working business email address because vendors and service providers need to know which business they are responding to."
        : "Publishing needs a business email address, because vendors and service providers need to know which business they are responding to. Nothing has been published. Your requirement is saved and will keep; come back with your work address and it publishes without redoing anything.",
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
  board: { listed: boolean; opportunity_id?: string; url?: string; reason?: string; visibility?: "public" };
  /** The instant publish reward: matched suppliers, price band, gaps. Never late because it is synchronous. */
  market_report: MarketReport;
  /** Round 4 correction (14 Aug 2026), Robert's finding 4: the REAL
   *  shortlist buildShortlist() selected -- the same one `invited` above
   *  was drawn from -- not `market_report.matched.names` (a different,
   *  simpler `matchSuppliers()` ranking that can genuinely omit an
   *  invited vendor). This is what `matched_vendor_ids`/`matched_vendors`
   *  freeze onto the published snapshot; returning it here too means the
   *  publish route's own immediate response can render the correct
   *  matched set, not only a later resumed read. */
  matched_vendors: { slug: string; name: string }[];
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

/**
 * Create or refresh the board notice for a published RFP. Exported for the
 * standing list-on-board action (a published RFP whose original publish
 * failed to list can list later without redoing the whole publish).
 *
 * Market-unlock correction round 2 (16 Aug 2026), Robert's non-negotiable
 * product rule: this ALWAYS creates a PUBLIC listing now -- there is no
 * more "unlisted" path through this function. Round 1 of this correction
 * accepted a `visibility` option so `list_on_board: false` could still
 * produce a real, unlisted Opportunity that unlocked the market privately;
 * Robert's review rejected that reading outright ("Do not reinterpret 'not
 * listed on the board' as 'listed privately'"). `executePublish()` no
 * longer calls this function at all when the buyer chose `list_on_board:
 * false` -- see its saga step C -- so by the time this function runs, a
 * public listing is exactly what is being asked for, full stop.
 *
 * `publishedRevisionId`, when supplied, binds the created/refreshed
 * Opportunity to that exact FrozenRevision (published-snapshot.ts) via
 * `source_published_revision_id` -- the field `commitMarketUnlock()`'s
 * integrity check (market-unlock.ts) verifies against. Every call from the
 * publish saga supplies it; the admin recovery path
 * (`recoverUnlistedPublish`) does not run the full saga and therefore does
 * not unlock the market on its own -- see that function's own doc comment.
 */
export async function listRfpOnBoard(
  p: ProjectDetails,
  ownerEmail: string,
  opts: { publishedRevisionId?: string } = {},
): Promise<{ opportunity_id: string; url: string }> {
  const visibility = "public" as const;
  const mapKey = `rfp:${p.id}:board_opp`;
  const existingId = await kvGetJson<string>(mapKey);
  const existing = existingId ? await getOpportunity(existingId) : null;

  // Count only sections that actually carry active questions (Harry's QA,
  // RFP Builder F3: the notice said "across 5 sections" while the document
  // rendered 2, because included-but-empty sections were being counted).
  const activeSections = p.rfp_sections.filter((s) => s.included && s.questions.some((q) => q.priority !== "optional"));
  const questionCount = activeSections.reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
  const sectionCount = activeSections.length;
  const quickListing = p.journey?.mode === "quick_list";
  const summary = quickListing
    ? `${p.buyer.notes.trim()} The buyer is seeking indicative, comparable responses. Publication is anonymous and non-binding; pricing stays private to the buyer.`
    : `The buyer has issued a full structured RFP (${questionCount} questions across ${sectionCount} sections, Netify SASE Methodology v${p.methodology_version}). Vendors respond to the RFP question set with evidence; pricing stays private to the buyer.`;

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
    buyer_org: anonymousBuyerOrganisation(),
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
    visibility,
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
    response_mode: quickListing ? "indicative_pricing" : "full_rfp",
    ai_summary: `Buyer seeks ${p.buyer.product_scope === "sse_only" ? "an SSE" : p.buyer.product_scope === "sdwan_only" ? "an SD-WAN" : "a SASE"} solution${p.buyer.operating_model === "managed" ? " as a managed service" : ""}${p.buyer.sector ? ` in the ${sectorLabel(p.buyer.sector)} sector` : ""}${p.buyer.site_count ? ` across ${p.buyer.site_count} sites` : ""}. ${quickListing ? "A concise opportunity brief has been published; sign in as a verified vendor to register interest." : "A full RFP with methodology-mapped questions has been issued; sign in as a verified vendor to register interest."}`,
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
    // Round 2 correction, requirement 3: bind this listing to the exact
    // frozen revision it was published against. Falls back to whatever was
    // previously bound (a refresh call that did not supply a fresh
    // revision id, e.g. a cosmetic re-list) rather than clearing it.
    source_published_revision_id: opts.publishedRevisionId ?? existing?.source_published_revision_id ?? "",
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
 * answer.
 *
 * Market-unlock correction round 2 (16 Aug 2026): this used to call
 * `listRfpOnBoard()` directly, creating an Opportunity WITHOUT running the
 * rest of the publish saga -- under Robert's non-negotiable rule, that
 * would list the notice publicly while leaving the market genuinely LOCKED
 * (no FrozenRevision to bind a MarketUnlock to, so `commitMarketUnlock()`
 * would refuse even if called). That is a real, silent defect for this
 * admin tool's actual purpose ("46 published, 14 ever seen by a supplier"
 * -- suppliers must actually be able to see and respond). Delegates to
 * `retryBoardPublication()` instead, which runs the full saga (freeze,
 * list, unlock, invite) idempotently -- "listing" and "the market
 * genuinely unlocking" are now the same recovered outcome, not two.
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
    const result = await retryBoardPublication(p, email);
    if (!result.board.opportunity_id) {
      const reason = result.board.reason ?? "board listing failed";
      await recordPublishLead({ state: "saved_unpublished", rfp_id: p.id, email, verification, requirement_depth: depth, reason });
      return { state: "saved_unpublished", reason };
    }
    await recordPublishLead({ state: "published", rfp_id: p.id, email, verification, requirement_depth: depth, board_opportunity_id: result.board.opportunity_id });
    return { state: "published", reason: null, opportunity_id: result.board.opportunity_id };
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

/** Friendly label for the internal alert: which engine, and which door the
 *  buyer came through. Both fields pre-date Milestone 3 as schema (engine
 *  Piece B, source Piece 2) but neither was ever surfaced to a human until
 *  now — Robert's 10 Aug ask to make the emails reflect the current
 *  deployment. */
function engineChannelLabel(p: ProjectDetails): string {
  const engine = p.engine === "security_sourcing" ? "Security Sourcing" : "Network/SD-WAN";
  const channel = p.source === "mcp" ? "AI agent (MCP)" : p.source === "wizard" ? "web wizard" : "unknown/pre-stamp";
  return `${engine} &middot; via ${channel}`;
}

async function sendPublishEmails(p: ProjectDetails, ownerEmail: string, invited: { name: string }[], report?: MarketReport) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk";
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? "support@netify.com";
  // The canonical Project view (Robert's copy, 21 Jul: the RFP Builder is
  // "a deliberate escape hatch, never the main road"). Both the internal
  // alert and the buyer confirmation used to point at that escape hatch
  // (/rfp-builder/{id}/, still a real, live page) rather than the front
  // door — fixed 10 Aug 2026.
  const rfpUrl = `${SITE_URL}/project/${p.id}/`;
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
    subject: `RFP Published Lead | ${emailDomain(ownerEmail) ?? "unknown"} | ${invited.length} vendors`,
    html: `<p><strong>${p.title}</strong> (${p.id}) was published by <strong>${ownerEmail}</strong>.</p><p>${engineChannelLabel(p)}</p>${org ? `<p>${org}</p>` : ""}<p><strong>Vendors auto-selected:</strong></p><pre>${supplierNames}</pre>${report?.matched?.region_assumption ? `<p><em>${report.matched.region_assumption}</em></p>` : ""}${pinnedNoteFor(p)}<p><a href="${rfpUrl}">Open the Project</a></p>`,
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
    ? `<p><strong>Gaps worth closing</strong> (edit your RFP any time; they always see the latest version):</p><ul>${report.gaps.map((g) => `<li>${g}</li>`).join("")}</ul>`
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
      `<p><strong>What happens next:</strong> ${invited.length} evaluated vendor${invited.length === 1 ? "" : "s"} ${invited.length === 1 ? "has" : "have"} been matched and invited${invited.length ? ` (${invited.map((v) => v.name).join(", ")})` : ""}. Their responses arrive side by side in your workspace, and pricing stays private to you.${deadlineLine ? ` The response window closes on ${deadlineLine}.` : ""}</p>` +
      bandBlock +
      (report?.matched?.region_assumption ? `<p><em>${report.matched.region_assumption}</em></p>` : "") +
      pinnedNoteFor(p) +
      `<p>To make replying fast, each invited vendor starts from a response Netify pre-drafted from its public-evidence evaluation of that company. They confirm, correct and add their pricing; capabilities Netify could not evidence are left blank for them to answer.</p>` +
      gapsBlock +
      `<p><strong>Your document:</strong> download your requirement as Word or PDF from your workspace to circulate internally.</p>` +
      `<p><a href="${rfpUrl}">Open your workspace</a></p>` +
      `<p><strong>Who is looking after this:</strong> ${report?.analyst_note ?? FOLLOW_UP_NOTE}</p><p>Netify research team</p>`,
  });
}

/**
 * Living Procurement Canvas Phase 2 (14 Aug 2026): a stable, content-
 * addressable identity for one publish REQUEST -- the same real-world click
 * (or an exact retry of it: double-click, timeout retry) always produces the
 * SAME id; a genuinely different request (the buyer edited the draft first,
 * or asked for a different shortlist_size) always produces a DIFFERENT one.
 * Built from `rfpContentSnapshot()` (the buyer's actual governed content)
 * plus the publish OPTIONS that change what gets invited/listed -- never
 * from volatile fields (timestamps, history) that would make every attempt
 * look unique regardless of content.
 */
function publishEventId(projectId: string, contentSnapshot: Record<string, unknown>, opts: PublishOpts): string {
  return `publish:${projectId}:${contentHash({
    content: contentSnapshot,
    shortlist_size: opts.shortlist_size ?? null,
    list_on_board: opts.list_on_board ?? null,
    excluded_vendors: [...(opts.excluded_vendors ?? [])].sort(),
  })}`;
}

/** The security-sourcing engine's rulebook version, from the project's own
 *  latest immutable verdict artefact -- null for non-engine projects, where
 *  no rulebook applies (see PublishedSnapshot's own doc comment). */
function rulebookVersionOf(p: ProjectDetails): string | null {
  if (p.engine !== "security_sourcing") return null;
  const verdicts = p.engine_data?.verdicts ?? [];
  if (verdicts.length === 0) return null;
  return verdicts.reduce((a, b) => (b.version > a.version ? b : a)).verdict.rulebookVersion ?? null;
}

/** The most recent publish-related consent recorded on the project, if any
 *  -- for the snapshot's own audit trail. Non-engine publishes without a
 *  declined-approval acknowledgement record no explicit "publish" consent
 *  entry today (see executePublish's D5 gate below), so this is honestly
 *  `null` in that case rather than a fabricated entry. */
function latestPublishConsent(p: ProjectDetails): PublishedSnapshot["consent"] {
  const relevant = (p.consents ?? []).filter((c) => c.action === "publish" || c.action === PUBLISH_DESPITE_DECLINED_ACTION);
  if (relevant.length === 0) return null;
  const last = relevant.reduce((a, b) => (b.at > a.at ? b : a));
  return { action: last.action, at: last.at, granted_by: last.granted_by, text: last.text };
}

/**
 * Idempotent-replay reconstruction (Robert's Phase 2 idempotency brief):
 * double-clicking Publish, or retrying after a timeout, with EXACTLY the
 * same content and options as the last successful publish must never
 * re-invite, re-list, re-save or re-notify. This rebuilds the SAME
 * `PublishResult` shape from the durable snapshot instead -- the only live
 * work it does is re-mint each invited vendor's bearer token, which
 * `getOrCreateSupplierVendorToken` already makes idempotent and silent (no
 * email, no new connection).
 */
async function replayResultFrom(project: ProjectDetails, snapshot: PublishedSnapshot): Promise<PublishResult> {
  const frozenBySlug = new Map((snapshot.provider_evidence ?? []).map((provider) => [provider.slug, provider]));
  const invited = await Promise.all(
    snapshot.invited_vendor_ids.map(async (slug) => {
      const vendor = frozenBySlug.get(slug) ?? vendorBySlug(slug);
      const vendorToken = await getOrCreateSupplierVendorToken(project.id, slug);
      return {
        slug,
        name: vendor?.name ?? slug,
        supplier_url: `${SITE_URL}/api/rfp/${project.id}/supplier-credential?token=${project.share_token}&vt=${vendorToken}`,
      };
    }),
  );
  // Round 4 (14 Aug 2026): prefer the snapshot's own frozen names when
  // this snapshot was written after that schema addition; an older
  // snapshot resolves the same real matched_vendor_ids against the live
  // dataset, same pattern `invited` above already used for names.
  const matchedVendorsReplay =
    snapshot.matched_vendors ?? snapshot.matched_vendor_ids.map((slug) => ({ slug, name: frozenBySlug.get(slug)?.name ?? vendorBySlug(slug)?.name ?? slug }));
  return {
    published: project,
    invited,
    criteria: snapshot.match_criteria,
    board: {
      listed: Boolean(snapshot.public_projection.opportunity_id),
      ...(snapshot.public_projection.opportunity_id ? { opportunity_id: snapshot.public_projection.opportunity_id } : {}),
      ...(snapshot.public_projection.url ? { url: snapshot.public_projection.url } : {}),
    },
    market_report: snapshot.market_report,
    matched_vendors: matchedVendorsReplay,
  };
}

/**
 * Market-unlock correction round (16 Aug 2026), Robert's ruling on the
 * row-8 checkpoint evidence: the CURRENT executePublish() (before this
 * round) computed the matched shortlist and called inviteSupplier() for
 * every selected vendor BEFORE the D5 declined-approval gate check, BEFORE
 * the project's status ever moved to "published", and BEFORE the board
 * listing was even attempted. Three consequences, all real defects:
 *
 *   1. A publish blocked by the D5 gate (a declined approval with no
 *      explicit confirmation) still resulted in real, persisted
 *      SupplierConnection invitations to real named vendors, even though
 *      the function then threw DeclinedApprovalError and the project
 *      NEVER left "draft" status -- an invitation sent from behind a
 *      thrown exception, on a project the buyer never actually published.
 *   2. `hasPublished(project.status)` (the row-8 hotfix's own gate) could
 *      read true, and RfpBuilder's vendor panel could show real invited-
 *      vendor names, while the SAME publish's own board listing had failed
 *      -- the project's internal status and its public market presence are
 *      two different facts, and only one of them was ever checked.
 *   3. Because "reveal identities" and "create invitations" happened
 *      before "list on the board", a board-listing failure could never
 *      undo either -- there was no sequencing left to make the invitations
 *      contingent on the board outcome even in principle.
 *
 * MARKET-UNLOCK CORRECTION ROUND 2 (16 Aug 2026): round 1's sequence above
 * was still wrong in two further ways Robert's review found, with real
 * reproduced evidence (see reports/row8-repro/round2-before-evidence.json):
 *
 *   4. Round 1 moved the project's status to "published" BEFORE the board
 *      listing was attempted (only the invite/unlock steps were moved
 *      after it) -- so a board-listing failure still left the project
 *      internally "published" with no board presence and no unlock: a
 *      published-but-never-actually-published project, bookkeeping-only in
 *      name only.
 *   5. Round 1's MarketUnlock was committed with a `published_revision_id`
 *      that was only ever a minted STRING at that point -- the
 *      corresponding PublishedSnapshot was not persisted until the very
 *      end of the function, well after the unlock. An unlock could exist
 *      referencing a "frozen revision" that had never actually been frozen
 *      anywhere.
 *   6. Round 1 also let `list_on_board: false` produce a real, unlisted
 *      Opportunity that still satisfied the board prerequisite and
 *      unlocked the market privately. Robert's review rejected this
 *      reading outright: an unlisted/private Opportunity does NOT satisfy
 *      the non-negotiable rule, and reinterpreting "not listed" as "listed
 *      privately" is not this change's call to make.
 *
 * THE RECOVERABLE PUBLICATION SAGA (round 2's fix, Robert's exact
 * lettering -- see publication-attempt.ts for the record this saga's
 * in-progress state lives in, entirely separate from `project.status`):
 *
 *   A. Validate eligibility, ownership, consent and D5 (unchanged, still
 *      first: the idempotency short-circuit, the min-content gate, the
 *      business-verification chain, then the D5 declined-approval gate).
 *   B. Compile and persist an immutable FrozenRevision (published-
 *      snapshot.ts), not yet externally exposed -- resuming an in-flight
 *      PublicationAttempt for this EXACT request if one exists, minting a
 *      fresh one otherwise.
 *   C. Create the PUBLIC Opportunities Board listing bound to that exact
 *      revision. `list_on_board: false` no longer creates any Opportunity
 *      at all -- the market simply never unlocks for that attempt, exactly
 *      as it does not for a genuine board failure.
 *   D. Persist the matching basis and invitation plan (buildShortlist()
 *      against the frozen content) into the PublicationAttempt, for
 *      deterministic replay -- reused verbatim on resume, never
 *      recomputed.
 *   E. Commit MarketUnlock (market-unlock.ts) -- idempotent by
 *      (project_id, published_revision_id, board_opportunity_id); refuses
 *      unless the FrozenRevision and the public board Opportunity both
 *      verify. This is the ONLY step that may expose anything supplier-
 *      facing; everything before it ran with zero project-specific vendor
 *      computation and zero supplier-facing writes.
 *   F. Transition the project to published -- ONLY NOW, strictly after E
 *      has verified and committed. This is round 2's literal fix for
 *      finding 4 above.
 *   G. Create invitations idempotently from the frozen invitation plan --
 *      an idempotent outbox: already-invited slugs are never re-invited on
 *      a resume.
 *
 * Failures before E leave the project market-locked and non-published,
 * retryable. Failures after E resume idempotently without changing the
 * frozen revision, shortlist or original `unlocked_at` (see
 * commitMarketUnlock()'s and the invite loop's own idempotency).
 *
 * Phase 2 (14 Aug 2026): also the publication boundary the product brief
 * requires -- freezes one authoritative PublishedSnapshot after every
 * genuinely new publish (see published-snapshot.ts), and short-circuits
 * entirely, before any side effect, on an exact repeat of the last
 * successful publish (see replayResultFrom() above and the idempotency
 * check just inside this function).
 */

/**
 * Full-unification CLOSURE pass (17 Aug 2026), requirement 4: how many
 * "would a supplier see this" questions this project's minimum-content gate
 * (below) counts -- extracted as its own pure, exported function so the
 * fixture suite can exercise the REAL gate logic directly (never a
 * hand-duplicated copy that could silently drift from it), and so the exact
 * same count can be asserted consistent with the notice/export pipelines
 * that also read from `procurement_document`.
 *
 * `rfp_sections` is no longer a second authority for a project that has a
 * canonical envelope (`project.envelope` is set only once
 * `buildEnvelopeUpdate()` has durably persisted a server-recomputed
 * `procurement_document` -- see envelope.ts's own `EnvelopeSaveOutcome`,
 * where `envelope` and `procurement_document` are always set together). For
 * such a project, this counts through the SAME faithful rendering adapter
 * every export already uses (`livingDocumentToRfpSections()`,
 * rfp-document.ts) -- never a second, hand-rolled count of
 * `procurement_document.clauses` -- so "how many questions would a supplier
 * see" can only ever mean one thing across the gate and the exports. A
 * record with no `envelope` (every record saved before this pass, or a
 * project whose engine never reached the canonical-envelope save path)
 * falls back to the exact pre-existing `rfp_sections`-based count,
 * unaffected -- the explicitly identified compatibility projection for
 * historic records the requirement calls for, not a silently degraded
 * resume experience.
 */
export function minimumContentQuestionCount(project: ProjectDetails): number {
  return project.envelope && project.procurement_document
    ? livingDocumentToRfpSections(project.procurement_document).reduce((n, s) => n + s.questions.length, 0)
    : project.rfp_sections
        .filter((s) => s.included)
        .reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
}

export async function executePublish(project: ProjectDetails, sessionEmail: string, opts: PublishOpts): Promise<PublishResult> {
  // IDEMPOTENCY (Robert's Phase 2 brief): checked first, before any gate or
  // side effect. If this exact request (same governed content, same
  // options) already completed a successful publish, this is a double-
  // click or a retry after a lost response -- return the durable record of
  // what already happened, never re-run verification, invites, board
  // listing, the save or the notification emails. A DIFFERENT request
  // (the buyer edited the draft, or asked for different options) always
  // produces a different eventId and falls through to a real publish.
  const contentSnapshotForEvent = rfpContentSnapshot(project);
  const publishEventIdForRequest = publishEventId(project.id, contentSnapshotForEvent, opts);
  const priorGovernedState = await loadGovernedRevisionState(project.id);
  if (isPublicationReplay(priorGovernedState.lastAppliedEventId, publishEventIdForRequest)) {
    const priorSnapshot = await getLatestPublishedSnapshot(project.id);
    if (priorSnapshot) return replayResultFrom(project, priorSnapshot);
    // Governed state says this exact request already applied, but no
    // snapshot exists (a pre-Phase-2 record, or a snapshot write that
    // failed after the state commit) -- fall through to a real publish
    // rather than returning nothing; the snapshot below will be created.
  }

  const essentialBaseline = persistedEssentialBaselineChecklist({
    facts: project.facts,
    decisionLedger: project.decision_ledger,
    procurementDocument: project.procurement_document,
  });
  // Minimum-content gate (Harry's QA, RFP Builder F2): submit was live at
  // zero questions, one click from dispatching an empty requirement to real
  // supplier contacts. The gate is server-side so every client (the page,
  // the MCP publish tools, and the verify path's pending_submit) refuses
  // identically (Article 17). Extracted into `minimumContentQuestionCount()`
  // (below) so the fixture suite can exercise the REAL gate logic directly,
  // never a hand-duplicated copy that could silently drift from it.
  const activeQuestionCount = minimumContentQuestionCount(project);
  const quickRaw = project.entrance_context?.raw_input ?? {};
  const readiness = project.journey?.mode === "quick_list"
    ? quickListingReadiness({ solutionScope: String(quickRaw.solution_scope ?? ""), sector: project.buyer.sector, siteCount: project.buyer.site_count, regions: project.buyer.regions, operatingModel: project.buyer.operating_model, outcome: String(quickRaw.outcome ?? project.buyer.notes), timescale: String(quickRaw.timescale ?? "") })
    : publicationReadiness({ baselineReady: essentialBaseline.ready, baselineRemaining: essentialBaseline.remaining, activeQuestionCount });
  if (!readiness.allowed) {
    throw new Error(`Complete the meaningful ${project.journey?.mode === "quick_list" ? "opportunity" : "RFP"} baseline before publishing. Still needed: ${readiness.reasons.join(", ")}. Nothing has been sent.`);
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
  // MOVED UP (market-unlock correction round): this must run BEFORE any
  // market-facing effect, and strictly before the board/invite sequence
  // below -- previously it ran AFTER the shortlist was computed and every
  // vendor already invited, so a blocked publish (declined approval, no
  // confirmation) still left real invitations sent to real named vendors
  // for a project that never actually left "draft" (see this function's
  // own header comment, finding 1).
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

  // Locked-result builder shared by every "the market did not unlock this
  // attempt" exit below (list_on_board:false, a board failure, or a
  // MarketUnlock binding refusal) -- always the SAME shape: nothing
  // supplier-specific computed, project left exactly as it was.
  const lockedMarketReportFor = (p: ProjectDetails): MarketReport => {
    try {
      const full = buildMarketReport(p);
      return { ...full, matched: { count: 0, names: [], total_evaluated_market: full.matched.total_evaluated_market } };
    } catch {
      return {
        generated_at: Date.now(),
        matched: { count: 0, names: [], total_evaluated_market: 0 },
        estimate: null,
        assumptions: [],
        gaps: [],
        document: { sections: 0, questions: 0 },
        analyst_note: FOLLOW_UP_NOTE,
      };
    }
  };

  // STEP B (Robert's lettering): compile and persist an immutable frozen
  // revision, not yet externally exposed. Resume an in-flight
  // PublicationAttempt for this EXACT request (same content + options) if
  // one exists -- reusing its id/board_opportunity_id/invitation_plan
  // verbatim, never re-minting or recomputing anything already durable;
  // mint a fresh attempt otherwise (a genuinely new request always gets a
  // new revision, never colliding with a prior, never-unlocked attempt).
  // See publication-attempt.ts's header for the full resume contract.
  let attempt: PublicationAttempt | null = await loadResumableAttempt(project.id, publishEventIdForRequest);
  if (!attempt) {
    const freshRevisionId = newId("snap");
    await saveFrozenRevision({
      id: freshRevisionId,
      project_id: project.id,
      content_hash: contentHash(contentSnapshotForEvent),
      // 2030 blueprint, full-unification phase (17 Aug 2026): freeze the
      // living document alongside the legacy fields -- `?? null`, not a
      // hard failure, when this project's most recent save predates the
      // field or came from a client build that had not yet started
      // sending it (published-snapshot.ts's own frozen_content comment).
      frozen_content: { title: working.title, buyer: working.buyer, rfp_sections: working.rfp_sections, living_document: working.procurement_document ?? null },
      created_at: Date.now(),
    });
    attempt = await savePublicationAttempt({
      id: freshRevisionId,
      project_id: project.id,
      request_event_id: publishEventIdForRequest,
      frozen_content_hash: contentHash(contentSnapshotForEvent),
      board_opportunity_id: null,
      invitation_plan: null,
      invited_slugs: [],
      unlocked: false,
      published: false,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  }
  const publishedRevisionId = attempt.id;

  // Seal the exact published Neon provider revisions and the resulting
  // invitation plan before any public board write. A provider-source
  // failure therefore cannot leave a board opportunity behind and cannot
  // unlock or invite suppliers. Existing resumable attempts keep their
  // already-sealed plan and never recompute it against newer evidence.
  if (opts.list_on_board !== false && (!attempt.invitation_plan || !attempt.provider_evidence || !attempt.match_input)) {
    const live = await getStrictLiveShortlistDataset();
    const size = Math.min(Math.max(Number(opts.shortlist_size ?? 8), 3), 12);
    const pinSlugs = (working.buyer.pinned_vendors ?? []).filter(Boolean);
    const excluded = new Set(
      (opts.excluded_vendors ?? [])
        .filter((slug): slug is string => typeof slug === "string" && slug.length > 0 && slug.length <= 80)
        .slice(0, 40)
        .filter((slug) => !pinSlugs.includes(slug)),
    );
    const requestSize = Math.min(12, size + excluded.size);
    const statedRegions = (working.buyer.regions ?? []).filter(Boolean);
    const regionHint = statedRegions.length === 0 ? regionHintFromEmail(ownerEmail) : null;
    const matchInput = {
      sector: working.buyer.sector ?? null,
      organisation_size: working.buyer.organisation_size ?? "any",
      service_model: working.buyer.operating_model ?? "any",
      required_regions: statedRegions,
      ...(regionHint ? { preferred_regions: [regionHint.region] } : {}),
      shortlist_size: requestSize,
    };
    const shortlist = buildShortlist(live.vendors, matchInput, FEATURE_NAMES);
    const rankedFill = shortlist.shortlist.map((vendor) => vendor.slug).filter((slug) => !excluded.has(slug));
    const inviteSlugs = [...new Set([...pinSlugs, ...rankedFill])].slice(0, Math.max(size, pinSlugs.length));
    const revisionBySlug = new Map(live.providerRevisions.map((revision) => [revision.slug, revision]));
    const vendorById = new Map(live.vendors.map((vendor) => [vendor.slug, vendor]));
    const evidenceSlugs = [...new Set([...shortlist.shortlist.map((vendor) => vendor.slug), ...inviteSlugs])];
    const providerEvidence = evidenceSlugs.flatMap((slug) => {
      const vendor = vendorById.get(slug);
      if (!vendor) return [];
      const revision = revisionBySlug.get(slug);
      return [{
        slug,
        name: vendor.name,
        provider_id: revision?.providerId ?? null,
        revision_id: revision?.revisionId ?? null,
        dataset_version: revision?.datasetVersion ?? null,
        record: vendor,
      }];
    });
    attempt = await savePublicationAttempt({
      ...attempt,
      invitation_plan: inviteSlugs.map((slug) => ({ slug, name: vendorById.get(slug)?.name ?? slug })),
      provider_evidence: providerEvidence,
      provider_provenance: {
        shortlist_contract_version: LIVE_SHORTLIST_CONTRACT_VERSION,
        provider_contract_version: live.providerContractVersion,
        dataset_versions: live.datasetVersions,
        loaded_at: live.loadedAt,
      },
      matched_provider_slugs: shortlist.shortlist.map((vendor) => vendor.slug),
      match_input: shortlist.input,
      match_criteria: shortlist.criteria_summary,
    });
  }

  // STEP C: create the PUBLIC Opportunities Board listing bound to that
  // exact revision -- the ONLY path onto the board this saga ever takes.
  // `list_on_board: false` no longer creates ANY Opportunity (public or
  // otherwise): per Robert's non-negotiable rule, "not listed on the
  // board" is never reinterpreted as "listed privately" -- the market
  // simply never unlocks for this attempt, exactly as if the board write
  // had failed outright. A private-market workflow may be a legitimate
  // FUTURE product, but it is a separately named lifecycle requiring its
  // own explicit approval, not a side effect of this flag.
  let board: { listed: boolean; opportunity_id?: string; url?: string; reason?: string; visibility?: "public" };
  if (opts.list_on_board === false) {
    board = {
      listed: false,
      reason:
        "This requirement was not submitted for publication on the Opportunities Board. Vendor matching, invitations and supplier access only unlock once a requirement is successfully published as a public opportunity on the board.",
    };
  } else {
    try {
      const listed = await listRfpOnBoard(working, sessionEmail, { publishedRevisionId });
      board = { listed: true, ...listed, visibility: "public" as const };
      if (attempt.board_opportunity_id !== listed.opportunity_id) {
        attempt = await savePublicationAttempt({ ...attempt, board_opportunity_id: listed.opportunity_id });
      }
    } catch (e) {
      // The quality gate says exactly why a notice stayed off the board
      // (Robert's ruling, 28 Jul 2026); other failures (a storage/write
      // failure, for instance) keep the generic line. Either way, this is
      // now also the reason the market never unlocks for this attempt --
      // see the locked return just below.
      board = e instanceof BoardQualityGateError
        ? { listed: false, reason: e.message }
        : { listed: false, reason: "Board listing failed; try re-publishing." };
    }
  }

  // The internal list hears every outcome (Ruling One): this publish
  // attempt, with its evidence, derived company and requirement depth,
  // and honestly which state it actually reached. Best effort.
  await recordPublishLead({
    state: board.opportunity_id ? "published" : "saved_unpublished",
    rfp_id: project.id,
    email: publishEmail,
    verification,
    requirement_depth: requirementDepth,
    ...(board.opportunity_id ? { board_opportunity_id: board.opportunity_id } : {}),
    ...(board.reason ? { reason: board.reason } : {}),
  });

  // Optional marketing consent captured at the agreement step is recorded
  // against the verified identity the publish runs as, regardless of
  // whether this attempt goes on to unlock -- the buyer's consent to be
  // contacted is a fact about the click, not about the outcome.
  if (opts.marketing_opt_in === true) {
    try {
      const key = "email:marketing_optin";
      const list = (await kvGetJson<string[]>(key)) ?? [];
      const addr = sessionEmail.toLowerCase();
      if (!list.includes(addr)) { list.push(addr); await kvSetJson(key, list); }
    } catch { /* best effort */ }
  }

  // NO PUBLIC BOARD OPPORTUNITY WAS CREATED (list_on_board:false, or a
  // board failure): stop here. Per Robert's non-negotiable rule, this
  // means the market never unlocked for this attempt, and -- round 2's
  // literal fix -- the project's status is NEVER touched: `working` here
  // is exactly `project` (plus, at most, a D5 acknowledgement consent
  // entry), never transitioned toward "published". The private match plan
  // remains sealed but no provider identity is exposed, no supplier is
  // invited, no MarketUnlock record is committed, and no governed-revision
  // idempotency state is committed
  // either, so a retry (this same request again, or the standing
  // /list-on-board recovery action -- see retryBoardPublication() below)
  // is a genuine, safe re-attempt, not a silent no-op.
  if (!board.opportunity_id) {
    return { published: working, invited: [], criteria: "", board, market_report: lockedMarketReportFor(working), matched_vendors: [] };
  }

  // STEP D was sealed before the board write. At this point a successful
  // board opportunity can only proceed with that durable plan.
  if (!attempt.invitation_plan || !attempt.provider_evidence || !attempt.match_input) {
    return { published: working, invited: [], criteria: "", board: { listed: false, reason: "Provider evidence could not be sealed; publication remains incomplete." }, market_report: lockedMarketReportFor(working), matched_vendors: [] };
  }
  const sealedProviderEvidence = attempt.provider_evidence;

  // STEP E: atomically/finally commit MarketUnlock -- the ONLY step that
  // may expose anything supplier-facing. Idempotent by
  // (project_id, published_revision_id, board_opportunity_id) --
  // market-unlock.ts's own commit path; refuses unless the FrozenRevision
  // and the public board Opportunity both independently verify.
  try {
    await commitMarketUnlock({
      project_id: working.id,
      published_revision_id: publishedRevisionId,
      board_opportunity_id: attempt.board_opportunity_id!,
    });
  } catch (e) {
    // A binding refusal here (MarketUnlockBindingError) means the frozen
    // revision or board Opportunity this attempt just produced somehow
    // does not verify -- treated exactly like a board failure: stay
    // locked, non-published, retryable. This should not happen on the
    // normal path (both were just persisted above in this same call), but
    // the saga must never silently "unlock" past a verification failure.
    const reason = e instanceof MarketUnlockBindingError ? e.message : "Market-unlock verification failed; try re-publishing.";
    return { published: working, invited: [], criteria: "", board: { listed: false, reason }, market_report: lockedMarketReportFor(working), matched_vendors: [] };
  }
  const marketUnlockValid = await isMarketUnlocked(working.id);
  if (!marketUnlockValid) {
    return { published: working, invited: [], criteria: "", board: { listed: false, reason: "Market-unlock verification failed; try re-publishing." }, market_report: lockedMarketReportFor(working), matched_vendors: [] };
  }
  if (!attempt.unlocked) {
    attempt = await savePublicationAttempt({ ...attempt, unlocked: true });
  }

  if (!invitationsAllowed({ publicBoardOpportunityId: attempt.board_opportunity_id, marketUnlockValid })) {
    return { published: working, invited: [], criteria: "", board: { listed: false, reason: "Publication policy did not permit supplier invitations." }, market_report: lockedMarketReportFor(working), matched_vendors: [] };
  }

  // STEP F: transition the project to published -- ONLY NOW, strictly
  // after E has verified and committed (round 2's literal fix: this used
  // to run before the board attempt was even made). Skipped entirely when
  // this project already crossed the publication boundary on an EARLIER
  // successful cycle (a genuine republish, or a resumed attempt whose F
  // already ran before an earlier crash): advanceProject() only permits
  // the drafted -> published transition once, so re-running it on an
  // already-published record would throw a spurious illegal-transition
  // error even though nothing here is actually wrong.
  let published: ProjectDetails;
  if (hasPublished(working.status)) {
    published = working;
  } else if (working.engine) {
    // Engine records publish THROUGH THE MACHINE (the legacy direct
    // status write is refused by the write gate for engine records, by
    // design): publish consent recorded verbatim, then the drafted to
    // published transition with its guards (consent + the gap gate).
    const now = Date.now();
    let p: ProjectDetails = {
      ...working,
      owner_email: ownerEmail,
      response_deadline: responseDeadline,
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
    // `detail.invited` no longer belongs on this transition event -- the
    // invite count is not known yet at this point in the sequence. A
    // separate `invite.sent` event (already a legal NON_TRANSITION_EVENT
    // for the published/qa/evaluation phases) is appended once invites
    // genuinely happen, below (step G).
    p = advanceProject(p, { at: now + 1, actor: "buyer", actor_ref: ownerEmail, via: "web", event: "publish.live", detail: {} });
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
      pending_submit: undefined,
      business_verification: { ...verification },
    };
    try {
      const now = Date.now();
      p = recordProjectEvent(p, { at: now, actor: "buyer", actor_ref: ownerEmail, via: "web", event: "publish.consented", detail: {}, consent: true });
      p = recordProjectEvent(p, { at: now + 1, actor: "buyer", actor_ref: ownerEmail, via: "web", event: "publish.live", detail: {} });
    } catch { /* the history is a record, never a gate */ }
    published = await saveProject(p);
  }
  if (!project.owner_email) {
    try { await indexRfpForBuyer(sessionEmail, published.id); } catch { /* best effort */ }
  }
  if (!attempt.published) {
    attempt = await savePublicationAttempt({ ...attempt, published: true });
  }

  // STEP G: create invitations idempotently from the frozen invitation
  // plan -- an idempotent outbox: `invited_slugs` is persisted after each
  // successful invite, so a crash mid-loop resumes without re-inviting an
  // already-invited slug. Already-invited slugs (from a resumed attempt)
  // still get their supplier_url reconstructed for THIS response, even
  // though inviteSupplier() itself is not called again for them.
  const invitationPlan = attempt.invitation_plan ?? [];
  const alreadyInvited = new Set(attempt.invited_slugs);
  const invited: { slug: string; name: string; supplier_url: string }[] = [];
  for (const entry of invitationPlan) {
    if (alreadyInvited.has(entry.slug)) {
      const vendorToken = await getOrCreateSupplierVendorToken(published.id, entry.slug);
      invited.push({
        slug: entry.slug,
        name: entry.name,
        supplier_url: `${SITE_URL}/api/rfp/${published.id}/supplier-credential?token=${published.share_token}&vt=${vendorToken}`,
      });
      continue;
    }
    const r = await inviteSupplier(
      published.id,
      entry.slug,
      `You are invited to respond to the RFP "${published.title}". Netify has pre-drafted evidence answers for your organisation from its public capability evaluation; open your response link, review the draft, correct anything and add your pricing. Most of the writing is already done.`,
      sealedProviderEvidence.find((provider) => provider.slug === entry.slug)?.record,
    );
    if (!("error" in r)) {
      // Piece 3B-2 (hybrid model, Robert's ruling #2, 9 Aug 2026): mint this
      // vendor's own bearer credential at publish time, distinct from
      // project.share_token (which stays exactly what it always was — proof
      // of RFP-invitation possession, shared by every invited vendor) and
      // distinct from `r.token`/SupplierConnection.token (the separate
      // connect/messaging feature's credential, not reused here to avoid
      // coupling two unrelated features). This is what lets the
      // clarification thread, NDA status and evidence draft work without a
      // sign-in, while still telling suppliers apart. See
      // supplier-capability-access.ts for how it is consumed.
      //
      // Credential-exchange delivery (Robert's ruling, 9 Aug 2026, replacing
      // the first version's `&vt=` query-string embedding on the respond
      // link itself): the invitation now points at the credential-exchange
      // endpoint, /api/rfp/[id]/supplier-credential, which validates the
      // token server-side, sets it as an HttpOnly cookie, and redirects to
      // the plain respond URL. The bearer secret still appears once, in this
      // first link, but never again in a navigable URL — see that route for
      // the exchange, and auth.ts's supplierCredentialCookieHeader for the
      // cookie it sets.
      const vendorToken = await getOrCreateSupplierVendorToken(published.id, entry.slug);
      invited.push({
        slug: entry.slug,
        name: r.vendor_name,
        supplier_url: `${SITE_URL}/api/rfp/${published.id}/supplier-credential?token=${published.share_token}&vt=${vendorToken}`,
      });
      attempt = await savePublicationAttempt({ ...attempt, invited_slugs: [...attempt.invited_slugs, entry.slug] });
    }
  }

  // Merge the real invite list onto the project record and append the
  // `invite.sent` history event now that invites genuinely exist -- best
  // effort throughout: the invitations themselves are already real,
  // irreversible SupplierConnection writes by this point, so a bookkeeping
  // hiccup here must never be reported as a failed publish.
  if (invited.length > 0) {
    try {
      const mergedInvited = Array.from(new Set([...published.invited_vendors, ...invited.map((i) => i.slug)]));
      let p: ProjectDetails = { ...published, invited_vendors: mergedInvited };
      try {
        p = recordProjectEvent(p, { at: Date.now(), actor: "buyer", actor_ref: ownerEmail, via: "web", event: "invite.sent", detail: { invited: invited.length, slugs: invited.map((i) => i.slug) } });
      } catch { /* the history is a record, never a gate */ }
      published = await saveProject(p);
    } catch {
      // Persistence failed; fall back to reflecting the real invites in the
      // in-memory object this function returns, so the immediate response
      // is still honest even if the next read has to catch up.
      published = { ...published, invited_vendors: Array.from(new Set([...published.invited_vendors, ...invited.map((i) => i.slug)])) };
    }
  }

  // The Market Report: synchronous, deterministic, the buyer's instant
  // reward for publishing. Built after the save so it reflects the published
  // state. A report failure must never fail a publish.
  let market_report: MarketReport;
  try {
    market_report = buildMarketReport(published, sealedProviderEvidence.map((provider) => provider.record));
  } catch {
    market_report = {
      generated_at: Date.now(),
      matched: { count: invited.length, names: invited.map((i) => i.name), total_evaluated_market: invited.length },
      estimate: null,
      assumptions: [],
      gaps: [],
      document: { sections: 0, questions: 0 },
      analyst_note: FOLLOW_UP_NOTE,
    };
  }

  // Notifications are best effort and never block the publish.
  try { await sendPublishEmails(published, ownerEmail, invited, market_report); } catch { /* best effort */ }

  // Freeze the published snapshot and COMMIT the governed-revision state
  // (Robert's Phase 2 brief): only now, after every side effect above has
  // genuinely succeeded, so a request that throws partway through never
  // poisons the idempotency state -- a real failure stays retryable as a
  // real new attempt, never silently swallowed as "already applied".
  // `factsBefore` is the PRIOR snapshot's own frozen content (an honest
  // diff against what was actually last published, not against whatever
  // the live draft happened to contain); `factsAfter` is this publish's
  // content -- both real Record<string,unknown> snapshots, so
  // resolveGovernedRevision()'s changedFactIds computation is a genuine
  // diff, never a caller assertion.
  const priorSnapshotForDiff = await getLatestPublishedSnapshot(project.id);
  const factsBeforeSnapshot = priorSnapshotForDiff
    ? rfpContentSnapshot({ ...published, ...priorSnapshotForDiff.frozen_content })
    : {};
  const govResult = await applyGovernedEvent(
    project.id,
    "publish",
    publishEventIdForRequest,
    factsBeforeSnapshot,
    contentSnapshotForEvent,
  );
  // Round 4 (14 Aug 2026), Robert's findings 4 & 5: the REAL shortlist
  // buildShortlist() selected, with vendor NAMES frozen at this exact
  // moment -- computed once here so the snapshot, the return value below
  // (which the publish route's immediate response carries), and every
  // later resumed read all agree on the identical list.
  const matchedProviderSlugs = attempt.matched_provider_slugs ?? sealedProviderEvidence.map((provider) => provider.slug);
  const evidenceBySlug = new Map(sealedProviderEvidence.map((provider) => [provider.slug, provider]));
  const matchedVendorsFrozen = matchedProviderSlugs.flatMap((slug) => {
    const provider = evidenceBySlug.get(slug);
    return provider ? [{ slug, name: provider.name }] : [];
  });
  if (govResult.applied && govResult.revision) {
    const snapshot: PublishedSnapshot = {
      // Market-unlock correction round: the SAME id minted and bound into
      // the MarketUnlock record above (published_revision_id /
      // invitation_snapshot_id) -- and the SAME id the earlier FrozenRevision
      // (step B) was persisted under -- never a second, independently-minted
      // id. "The frozen revision" and "the row this snapshot ends up saved
      // under" must always be the same identity.
      id: publishedRevisionId,
      project_id: published.id,
      document_version: govResult.revision.cycle,
      compiler_version: RFP_DOCUMENT_PIPELINE_VERSION,
      methodology_version: published.methodology_version,
      rulebook_version: rulebookVersionOf(published),
      published_at: Date.now(),
      published_by: ownerEmail,
      consent: latestPublishConsent(published),
      content_hash: contentHash(contentSnapshotForEvent),
      // Same treatment as the earlier FrozenRevision (step B) above.
      frozen_content: { title: published.title, buyer: published.buyer, rfp_sections: published.rfp_sections, living_document: published.procurement_document ?? null },
      public_projection: { opportunity_id: board.opportunity_id ?? null, url: board.url ?? null },
      private_requirement: { rfp_id: published.id },
      match_criteria: attempt.match_criteria ?? "",
      matched_vendor_ids: matchedProviderSlugs,
      invited_vendor_ids: invited.map((i) => i.slug),
      matched_vendors: matchedVendorsFrozen,
      invited_vendors: invited,
      provider_evidence: sealedProviderEvidence,
      provider_provenance: attempt.provider_provenance,
      provider_match_input: attempt.match_input,
      accepted_assumptions: market_report.assumptions,
      open_decisions: market_report.gaps,
      market_report,
    };
    await savePublishedSnapshot(project.id, snapshot);
  }
  // A missing `govResult.applied` here would mean this exact eventId was
  // somehow already the last-applied one despite failing the read at the
  // top of this function (a race between two truly concurrent identical
  // requests -- see rfp-governed-revision.ts's own documented limit). The
  // publish itself has already genuinely succeeded above either way; only
  // the SNAPSHOT write is skipped to avoid a duplicate version, matching
  // this function's idempotency contract rather than throwing after the
  // buyer's vendors have already been invited.

  return { published, invited, criteria: attempt.match_criteria ?? "", board, market_report, matched_vendors: matchedVendorsFrozen };
}

/**
 * The standing recovery path (market-unlock correction round, 16 Aug
 * 2026, updated in round 2): when a publish's board step failed, was
 * refused (`list_on_board: false`), or was never attempted (a pre-round
 * published record with no MarketUnlock yet), this re-attempts the FULL
 * saga against the project's CURRENT content -- resuming or freezing a
 * revision as needed, listing publicly, and, if that succeeds, committing
 * the unlock and running the invite tail. Called by the standing
 * /list-on-board POST route so that route's own recovery action
 * (documented there since 23 Jul 2026: "a published-but-unlisted RFP
 * could only reach the board by re-running the whole publish") now ALSO
 * completes the deferred market-unlock and invitation step.
 *
 * Round 2 correction: the guard used to be `hasPublished(project.status)`
 * -- wrong now that `project.status` never moves until the saga's own
 * step F succeeds, so a project stuck on a failed/never-attempted
 * publication attempt would never satisfy it. The guard is now "does a
 * PublicationAttempt exist for this project" (has a publish ever been
 * genuinely tried), which is exactly the retryable state this route
 * exists to recover.
 *
 * A no-op, returning the existing state, when the market is already
 * unlocked (idempotent: calling this twice after a genuine success never
 * re-invites or re-lists).
 */
export async function retryBoardPublication(project: ProjectDetails, sessionEmail: string): Promise<PublishResult> {
  const existingAttempt = await getPublicationAttempt(project.id);
  if (!hasPublished(project.status) && !existingAttempt) {
    throw new Error("Only a project with a publish attempt already in progress can be listed on the board. Publish first; listing is part of the publish step.");
  }
  if (await isMarketUnlocked(project.id)) {
    // Already unlocked: nothing to retry. Return a result shaped like a
    // fresh publish's, sourced from the latest frozen snapshot so callers
    // get the same honest, already-unlocked state either way.
    const snapshot = await getLatestPublishedSnapshot(project.id);
    if (snapshot) return replayResultFrom(project, snapshot);
  }
  // Re-run the SAME publish core, with list_on_board defaulting to true
  // (this route's own purpose is an explicit ask to become publicly
  // listed) -- executePublish() itself resumes the existing
  // PublicationAttempt when the content/options are unchanged, and skips
  // re-running the status transition when the project is already
  // published, going straight to a fresh board attempt.
  return executePublish(project, sessionEmail, { list_on_board: true });
}
