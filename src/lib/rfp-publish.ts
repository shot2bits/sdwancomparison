import { saveProject, saveOpportunity, getOpportunity, newId, kvGetJson, kvSetJson, indexRfpForBuyer, listSignoffs, listPublicOpportunities, getOrCreateSupplierVendorToken } from "@/lib/rfp-store";
import { ensureDistinctNoticeTitle } from "@/lib/notice-title";
import { advanceProject, recordProjectEvent } from "@/lib/project-machine";
import { publishDecisionGate, declinedConfirmationText, PUBLISH_DESPITE_DECLINED_ACTION, ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { inviteSupplier, vendorBySlug } from "@/lib/rfp-connect";
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
import { sectorLabel, RFP_DOCUMENT_PIPELINE_VERSION } from "@/lib/rfp-document";
import { RFP_ORG_SIZES, labelFor } from "@/lib/notice-options";
import { buildMarketReport, formatBandGBP, type MarketReport } from "@/lib/market-report";
import { rfpContentSnapshot, contentHash, getLatestPublishedSnapshot, savePublishedSnapshot, type PublishedSnapshot } from "@/lib/published-snapshot";
import { loadGovernedRevisionState, applyGovernedEvent } from "@/lib/rfp-governed-revision";
import { hasPublished } from "@/lib/project-machine";
import { commitMarketUnlock, isMarketUnlocked } from "@/lib/market-unlock";
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
  board: { listed: boolean; opportunity_id?: string; url?: string; reason?: string; visibility?: "public" | "unlisted" };
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
 * Market-unlock correction round (16 Aug 2026): `visibility` defaults to
 * "public" (the standing /list-on-board route's own purpose -- an explicit
 * ask to become publicly crawlable) but `executePublish()`'s internal call
 * passes "unlisted" when the buyer chose `list_on_board: false` ("matched
 * suppliers only"). Board-record creation itself is NO LONGER optional in
 * either case -- see market-unlock.ts's header comment for why an
 * `Opportunity` record (public OR unlisted) is now the one thing every
 * publish must produce before anything supplier-facing unlocks. Only its
 * PUBLIC crawlability is what `list_on_board` still controls;
 * `listPublicOpportunities()` (rfp-store.ts) already filters strictly on
 * `visibility === "public"`, so an unlisted notice never appears on the
 * public board page or its data.json feed, matching the buyer's actual
 * choice.
 */
export async function listRfpOnBoard(
  p: ProjectDetails,
  ownerEmail: string,
  opts: { visibility?: "public" | "unlisted" } = {},
): Promise<{ opportunity_id: string; url: string }> {
  const visibility = opts.visibility ?? "public";
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
    `Netify SASE Methodology v${p.methodology_version}). Vendors respond to the RFP question set with evidence; ` +
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
    response_mode: "full_rfp",
    ai_summary: `Buyer seeks ${p.buyer.product_scope === "sse_only" ? "an SSE" : p.buyer.product_scope === "sdwan_only" ? "an SD-WAN" : "a SASE"} solution${p.buyer.operating_model === "managed" ? " as a managed service" : ""}${p.buyer.sector ? ` in the ${sectorLabel(p.buyer.sector)} sector` : ""}${p.buyer.site_count ? ` across ${p.buyer.site_count} sites` : ""}. A full RFP with methodology-mapped questions has been issued; sign in as a verified vendor to register interest.`,
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
  const invited = await Promise.all(
    snapshot.invited_vendor_ids.map(async (slug) => {
      const vendor = vendorBySlug(slug);
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
    snapshot.matched_vendors ?? snapshot.matched_vendor_ids.map((slug) => ({ slug, name: vendorBySlug(slug)?.name ?? slug }));
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
 * The corrected sequence (Robert's explicit ordering): validate
 * eligibility (unchanged, still first) -> freeze the canonical revision
 * (mint publishedRevisionId, no side effects) -> transition the project's
 * own status/history (bookkeeping; still no supplier-facing effect) ->
 * create/list the board opportunity -> ONLY IF that succeeds, commit the
 * MarketUnlock record (market-unlock.ts) -> ONLY THEN compute matching and
 * create invitations. A board-listing failure (the quality gate, or any
 * other write failure) now returns a genuinely locked PublishResult --
 * empty invited/matched_vendors, no MarketUnlock committed, no governed-
 * revision idempotency state committed -- so a retry (the same "Submit to
 * your matched vendors" click, or the standing /list-on-board recovery
 * action, which now runs this same tail -- see retryBoardPublication()
 * below) is a genuine, safe re-attempt rather than a silent no-op or a
 * second round of invitations.
 *
 * Phase 2 (14 Aug 2026): also the publication boundary the product brief
 * requires -- freezes one authoritative PublishedSnapshot after every
 * genuinely new publish (see published-snapshot.ts), and short-circuits
 * entirely, before any side effect, on an exact repeat of the last
 * successful publish (see replayResultFrom() above and the idempotency
 * check just inside this function).
 */
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
  if (priorGovernedState.lastAppliedEventId === publishEventIdForRequest) {
    const priorSnapshot = await getLatestPublishedSnapshot(project.id);
    if (priorSnapshot) return replayResultFrom(project, priorSnapshot);
    // Governed state says this exact request already applied, but no
    // snapshot exists (a pre-Phase-2 record, or a snapshot write that
    // failed after the state commit) -- fall through to a real publish
    // rather than returning nothing; the snapshot below will be created.
  }

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
      "This RFP has no questions yet, so there is nothing for vendors to respond to. Describe your project and generate the question set first; nothing has been sent.",
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

  // FREEZE THE CANONICAL REVISION (market-unlock correction round): mint
  // this publish's revision identity now, before any board or invite side
  // effect -- a pure id mint, no I/O, no content computed from matching or
  // invites (neither exists yet). This is the id market-unlock.ts's
  // MarketUnlock.published_revision_id (and, once the invite step below
  // completes, invitation_snapshot_id) will bind to, and the SAME id the
  // PublishedSnapshot saved at the end of this function is keyed under --
  // one identity for "the frozen thing this publish produced", minted at
  // the moment it is genuinely fixed rather than at the moment it happens
  // to be written to storage.
  const publishedRevisionId = newId("snap");

  // TRANSITION THE PROJECT'S OWN STATUS/HISTORY. Bookkeeping only -- no
  // supplier-facing effect yet (invited_vendors is intentionally left
  // UNCHANGED here; the invite loop that would extend it has not run).
  // Skipped entirely when this project already crossed the publication
  // boundary on an EARLIER attempt whose board step failed (the standard
  // "click Submit again" or list-on-board retry): advanceProject() only
  // permits the drafted -> published transition once, so re-running it on
  // an already-published record would throw a spurious illegal-transition
  // error even though nothing here is actually wrong.
  let published: ProjectDetails;
  if (hasPublished(project.status)) {
    published = working;
  } else if (project.engine) {
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
    // genuinely happen, below.
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

  // CREATE/LIST THE BOARD OPPORTUNITY -- now a prerequisite for everything
  // supplier-facing, never an optional afterthought (Robert's ruling).
  // `list_on_board: false` ("matched suppliers only") no longer skips
  // Opportunities Board record creation entirely -- it only controls that
  // record's public crawlability (see listRfpOnBoard()'s own doc comment
  // and market-unlock.ts's header for why: ONE canonical boundary, not a
  // public-board path plus a separate ungated private-invite path).
  const boardVisibility: "public" | "unlisted" = opts.list_on_board === false ? "unlisted" : "public";
  let board: { listed: boolean; opportunity_id?: string; url?: string; reason?: string; visibility?: "public" | "unlisted" };
  try {
    const listed = await listRfpOnBoard(published, sessionEmail, { visibility: boardVisibility });
    board = { listed: boardVisibility === "public", ...listed, visibility: boardVisibility };
  } catch (e) {
    // The quality gate says exactly why a notice stayed off the board
    // (Robert's ruling, 28 Jul 2026); other failures (a storage/write
    // failure, for instance) keep the generic line. Either way, per THIS
    // round's ruling, this is now also the reason the market never
    // unlocks for this attempt -- see the early return just below.
    board = e instanceof BoardQualityGateError
      ? { listed: false, reason: e.message }
      : { listed: false, reason: "Board listing failed; try re-publishing." };
  }

  // The internal list hears every outcome (Ruling One): this publish, with
  // its evidence, derived company and requirement depth. Best effort.
  await recordPublishLead({
    state: "published",
    rfp_id: published.id,
    email: publishEmail,
    verification,
    requirement_depth: requirementDepth,
    ...(board.opportunity_id ? { board_opportunity_id: board.opportunity_id } : {}),
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

  // NO BOARD OPPORTUNITY WAS CREATED: stop here. Per Robert's ruling, this
  // means the market never unlocked for this attempt -- no matching is
  // computed, no supplier is invited, no MarketUnlock record is committed,
  // and (deliberately) no governed-revision idempotency state is committed
  // either, so a retry (this same request again, or the standing
  // /list-on-board recovery action -- see retryBoardPublication() below)
  // is a genuine, safe re-attempt, not a silent no-op. The project itself
  // legitimately stays in its "published" status/phase (that IS one of
  // this round's required fixture states: internal published status, no
  // board listing yet) -- only the market-facing consequences are held
  // back.
  if (!board.opportunity_id) {
    let lockedReport: MarketReport;
    try {
      const full = buildMarketReport(published);
      lockedReport = { ...full, matched: { count: 0, names: [], total_evaluated_market: full.matched.total_evaluated_market } };
    } catch {
      lockedReport = {
        generated_at: Date.now(),
        matched: { count: 0, names: [], total_evaluated_market: 0 },
        estimate: null,
        assumptions: [],
        gaps: [],
        document: { sections: 0, questions: 0 },
        analyst_note: FOLLOW_UP_NOTE,
      };
    }
    return { published, invited: [], criteria: "", board, market_report: lockedReport, matched_vendors: [] };
  }

  // COMMIT THE MARKET-UNLOCK STATE -- the canonical, server-derived record
  // (market-unlock.ts). Only now: a frozen revision exists (minted above)
  // AND a board opportunity was just created successfully AND that
  // opportunity is about to be bound to this exact revision.
  await commitMarketUnlock({
    project_id: published.id,
    published_revision_id: publishedRevisionId,
    board_opportunity_id: board.opportunity_id,
    board_visibility: boardVisibility,
    matching_basis_hash: contentHash(contentSnapshotForEvent),
    invitation_snapshot_id: publishedRevisionId,
  });

  // ONLY NOW: calculate matching and create invitations. Everything above
  // this point ran with zero project-specific vendor computation and zero
  // supplier-facing writes.
  const size = Math.min(Math.max(Number(opts.shortlist_size ?? 8), 3), 12);
  // Buyer-named vendors are always invited (explicit intent beats inference),
  // capped upstream at five; the ranked shortlist fills the remainder.
  const pinSlugs = (published.buyer.pinned_vendors ?? []).filter(Boolean);
  // Buyer exclusions (F3): sanitised, capped, and never allowed to beat a
  // pin. They govern the ranked fill only; the board listing, the grading
  // and the record are untouched.
  const excluded = new Set(
    (opts.excluded_vendors ?? [])
      .filter((s): s is string => typeof s === "string" && s.length > 0 && s.length <= 80)
      .slice(0, 40)
      .filter((s) => !pinSlugs.includes(s)),
  );
  // Excluded seats backfill: ask the ranking for enough names that an
  // exclusion shrinks nobody's field, capped at the engine's own ceiling.
  const requestSize = Math.min(12, size + excluded.size);
  // Region hint (20 July 2026, the ministry lesson): when the buyer stated no
  // regions, weight the ranking by the email's country TLD. Never filters;
  // declared to the buyer as an assumption in the confirmation email.
  const statedRegions = (published.buyer.regions ?? []).filter(Boolean);
  const regionHint = statedRegions.length === 0 ? regionHintFromEmail(published.owner_email || sessionEmail) : null;
  const result = buildShortlist(getShortlistDataset(), {
    sector: published.buyer.sector ?? null,
    organisation_size: published.buyer.organisation_size ?? "any",
    service_model: published.buyer.operating_model ?? "any",
    required_regions: statedRegions,
    ...(regionHint ? { preferred_regions: [regionHint.region] } : {}),
    shortlist_size: requestSize,
  }, FEATURE_NAMES);

  const rankedFill = result.shortlist.map((v) => v.slug).filter((s) => !excluded.has(s));
  const inviteSlugs = [...new Set([...pinSlugs, ...rankedFill])].slice(0, Math.max(size, pinSlugs.length));
  const invited: { slug: string; name: string; supplier_url: string }[] = [];
  for (const v of inviteSlugs.map((slug) => ({ slug }))) {
    const r = await inviteSupplier(
      published.id,
      v.slug,
      `You are invited to respond to the RFP "${published.title}". Netify has pre-drafted evidence answers for your organisation from its public capability evaluation; open your response link, review the draft, correct anything and add your pricing. Most of the writing is already done.`,
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
      const vendorToken = await getOrCreateSupplierVendorToken(published.id, v.slug);
      invited.push({
        slug: v.slug,
        name: r.vendor_name,
        supplier_url: `${SITE_URL}/api/rfp/${published.id}/supplier-credential?token=${published.share_token}&vt=${vendorToken}`,
      });
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
    market_report = buildMarketReport(published);
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
  const matchedVendorsFrozen = result.shortlist.map((v) => ({ slug: v.slug, name: v.name }));
  if (govResult.applied && govResult.revision) {
    const snapshot: PublishedSnapshot = {
      // Market-unlock correction round: the SAME id minted and bound into
      // the MarketUnlock record above (published_revision_id /
      // invitation_snapshot_id), never a second, independently-minted id --
      // "the frozen revision" and "the row this snapshot ends up saved
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
      frozen_content: { title: published.title, buyer: published.buyer, rfp_sections: published.rfp_sections },
      public_projection: { opportunity_id: board.opportunity_id ?? null, url: board.url ?? null },
      private_requirement: { rfp_id: published.id },
      match_criteria: result.criteria_summary,
      matched_vendor_ids: result.shortlist.map((v) => v.slug),
      invited_vendor_ids: invited.map((i) => i.slug),
      matched_vendors: matchedVendorsFrozen,
      invited_vendors: invited,
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

  return { published, invited, criteria: result.criteria_summary, board, market_report, matched_vendors: matchedVendorsFrozen };
}

/**
 * The standing recovery path (market-unlock correction round, 16 Aug
 * 2026): when a publish's board step failed (or was never attempted -- a
 * pre-round-published record with no MarketUnlock yet), this re-attempts
 * board listing against the project's CURRENT content -- re-freezing a
 * fresh revision, since the buyer may have edited the draft after the
 * failed attempt -- and, if it succeeds this time, runs the exact same
 * unlock-and-invite tail executePublish() itself would have run. Called by
 * the standing /list-on-board POST route so that route's own recovery
 * action (documented there since 23 Jul 2026: "a published-but-unlisted
 * RFP could only reach the board by re-running the whole publish") now
 * ALSO completes the deferred market-unlock and invitation step, rather
 * than creating an Opportunity that a stale hasPublished()-only reader
 * would have treated as sufficient on its own.
 *
 * A no-op, returning the existing state, when the market is already
 * unlocked (idempotent: calling this twice after a genuine success never
 * re-invites or re-lists).
 */
export async function retryBoardPublication(project: ProjectDetails, sessionEmail: string): Promise<PublishResult> {
  if (!hasPublished(project.status)) {
    throw new Error("Only a published RFP can be listed on the board. Publish first; listing is part of the publish step.");
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
  // listed) -- executePublish() itself detects the project is already
  // published (hasPublished(project.status) true) and skips re-running the
  // status transition, going straight to a fresh board attempt.
  return executePublish(project, sessionEmail, { list_on_board: true });
}
