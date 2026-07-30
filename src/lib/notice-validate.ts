/**
 * Deterministic project-notice validation, shared by the MCP agent tools
 * (draft_opportunity_notice / validate_opportunity_notice). Mirrors the
 * wizard's gap thinking but without a model call: agents get fast, stable,
 * explainable results. The AI rewrite stays a separate, optional step.
 */

import { OPP_SCOPES, RESPONSE_MODES } from "@/lib/opportunity-types";
import { SECTORS, SIZE_BANDS, USERS_BANDS, REGIONS, CLOUD_PLATFORMS, COMPLIANCE_OPTIONS, EVIDENCE_OPTIONS, EVALUATION_PRIORITIES } from "@/lib/notice-options";

export type NoticeDraftInput = Record<string, unknown>;

export type NormalisedNotice = {
  title: string;
  summary: string;
  scope: string[];
  buyer_org: string;
  buyer_visibility: "named" | "anonymous";
  buyer_sector: string;
  buyer_size_band: string;
  sites: number | null;
  users_band: string;
  remote_users_band: string;
  regions: string[];
  cloud_platforms: string[];
  current_environment: string;
  desired_outcomes: string;
  budget_note: string;
  timeline_note: string;
  compliance_requirements: string[];
  evidence_requested: string[];
  evaluation_priorities: string[];
  response_mode: string;
  eligibility: "open" | "invited";
  visibility: "public" | "unlisted";
  response_deadline: string | null;
  decision_target: string | null;
  go_live_target: string | null;
};

export type NoticeValidation = {
  completeness: number; // 0..1
  critical_gaps: string[];
  recommended_gaps: string[];
  dropped_values: string[]; // inputs that didn't match a catalogue key
};

const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const keys = (list: readonly { key: string }[]) => new Set(list.map((o) => o.key));

/**
 * The literal a buyer states when they choose not to name a sector. Unstated
 * is a value, not a gap to fill (the intake-truth law, 28 Jul 2026): the
 * public record may say "not stated", it may never say a guess.
 */
export const SECTOR_NOT_STATED = "not_stated";

/* ------------------------------------------------------------------ */
/* The public quality gate (Robert's ruling, 28 Jul 2026)             */
/* ------------------------------------------------------------------ */

/**
 * Placeholder and test-marker patterns that must never reach a public
 * surface. Two tiers, deterministic and versioned by observation, because
 * real procurement prose legitimately contains words like "testing" ("UAT
 * testing phase") that a title or an organisation name never needs:
 *  - TITLE_MARKERS run against title and buyer_org, where marker words
 *    have no legitimate use;
 *  - GIBBERISH_MARKERS run against the summary too, where only unambiguous
 *    placeholder text is refused.
 */
const TITLE_MARKERS =
  /\b(test(?:ing)?|asdf+|qwerty|lorem|ipsum|placeholder|dummy|fake|xxx+|zzz+|do not (?:respond|reply|use)|delete me|smoke[- ]?probe)\b/i;
const GIBBERISH_MARKERS =
  /\b(lorem|ipsum|asdf{2,}|qwerty|xxx{2,}|zzz{2,}|test (?:notice|record|opportunity|rfp|rfi|entry|data)|do not (?:respond|reply|use)|delete me|smoke[- ]?probe)\b/i;

/** Accepts epoch ms or an ISO date string; null when absent or unreadable. */
function toEpoch(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

export type QualityGateInput = {
  title: string;
  summary: string;
  buyer_org?: string;
  buyer_sector?: string;
  sites?: number | null;
  response_deadline?: number | string | null;
  decision_target?: number | string | null;
  go_live_target?: number | string | null;
};

/**
 * The gate every notice crosses before a public surface: no test data, no
 * placeholder text, coherent figures, and a sector that is either stated or
 * explicitly "not_stated". Returns the list of failures in plain English;
 * an empty list is a pass. Callers decide the consequence (the MCP reports
 * them as critical gaps; the RFP auto-listing skips the board and says why).
 */
export function publicNoticeQualityGate(n: QualityGateInput): string[] {
  const failures: string[] = [];

  const title = String(n.title ?? "").trim();
  const org = String(n.buyer_org ?? "").trim();
  const summary = String(n.summary ?? "").trim();
  if (TITLE_MARKERS.test(title)) failures.push('title: reads as test or placeholder content. A public notice needs a real project title.');
  if (org && TITLE_MARKERS.test(org)) failures.push('buyer_org: reads as test or placeholder content. Name the organisation, or publish as anonymous.');
  if (GIBBERISH_MARKERS.test(summary)) failures.push('summary: contains placeholder or test wording. Describe the real need; vendors read this verbatim.');

  if (typeof n.sites === "number" && Number.isFinite(n.sites) && (n.sites < 1 || n.sites > 20000)) {
    failures.push(`sites: ${n.sites} is outside the plausible estate range (1 to 20,000). State the real count or leave it unstated.`);
  }

  const rd = toEpoch(n.response_deadline ?? null);
  const dt = toEpoch(n.decision_target ?? null);
  const gl = toEpoch(n.go_live_target ?? null);
  if (rd != null && dt != null && rd > dt) failures.push("dates: the response deadline falls after the decision target. Vendors cannot respond to a decision already due.");
  if (dt != null && gl != null && dt > gl) failures.push("dates: the decision target falls after the go-live target. The plan decides before it goes live.");
  if (rd != null && gl != null && rd > gl) failures.push("dates: the response deadline falls after the go-live target.");

  const sector = String(n.buyer_sector ?? "").trim();
  const sectorOk = sector === SECTOR_NOT_STATED || keys(SECTORS).has(sector);
  if (!sectorOk) {
    failures.push(sector
      ? `buyer_sector: "${sector}" is not a catalogue sector. Pick one, or state not_stated explicitly.`
      : 'buyer_sector: pick a sector, or state not_stated explicitly. The public record says one or the other, never a guess.');
  }

  return failures;
}

function filterKeys(v: unknown, allowed: Set<string>, dropped: string[], label: string): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    if (allowed.has(x)) out.push(x);
    else dropped.push(`${label}: "${x}"`);
  }
  return out;
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export function normaliseNoticeDraft(input: NoticeDraftInput): { notice: NormalisedNotice; validation: NoticeValidation } {
  const dropped: string[] = [];

  const scope = filterKeys(input.scope, new Set(OPP_SCOPES as readonly string[]), dropped, "scope");
  const sectorKeys = keys(SECTORS);
  sectorKeys.add(SECTOR_NOT_STATED); // "not stated" is a stated value, never dropped
  const sector = str(input.buyer_sector);

  const notice: NormalisedNotice = {
    title: str(input.title, 120),
    summary: str(input.summary),
    scope,
    buyer_org: str(input.buyer_org, 200),
    buyer_visibility: input.buyer_visibility === "anonymous" ? "anonymous" : "named",
    buyer_sector: sectorKeys.has(sector) ? sector : (sector ? (dropped.push(`buyer_sector: "${sector}"`), "") : ""),
    buyer_size_band: keys(SIZE_BANDS).has(str(input.buyer_size_band)) ? str(input.buyer_size_band) : "",
    sites: typeof input.sites === "number" && Number.isFinite(input.sites) ? Math.round(input.sites) : null,
    users_band: keys(USERS_BANDS).has(str(input.users_band)) ? str(input.users_band) : "",
    remote_users_band: keys(USERS_BANDS).has(str(input.remote_users_band)) ? str(input.remote_users_band) : "",
    regions: filterKeys(input.regions, keys(REGIONS), dropped, "regions"),
    cloud_platforms: filterKeys(input.cloud_platforms, keys(CLOUD_PLATFORMS), dropped, "cloud_platforms"),
    current_environment: str(input.current_environment),
    desired_outcomes: str(input.desired_outcomes),
    budget_note: str(input.budget_note, 500),
    timeline_note: str(input.timeline_note, 1000),
    compliance_requirements: filterKeys(input.compliance_requirements, keys(COMPLIANCE_OPTIONS), dropped, "compliance_requirements"),
    evidence_requested: filterKeys(input.evidence_requested, keys(EVIDENCE_OPTIONS), dropped, "evidence_requested"),
    evaluation_priorities: filterKeys(input.evaluation_priorities, keys(EVALUATION_PRIORITIES), dropped, "evaluation_priorities"),
    response_mode: (RESPONSE_MODES as readonly string[]).includes(str(input.response_mode)) ? str(input.response_mode) : "indicative_pricing",
    eligibility: input.eligibility === "invited" ? "invited" : "open",
    visibility: input.visibility === "unlisted" ? "unlisted" : "public",
    response_deadline: isoOrNull(input.response_deadline),
    decision_target: isoOrNull(input.decision_target),
    go_live_target: isoOrNull(input.go_live_target),
  };

  const critical: string[] = [];
  if (notice.scope.length === 0) critical.push("scope: pick at least one category (underlay_circuits, sd_wan, sse, sase, managed_service, firewall_fwaas, ztna, swg, casb, connectivity, managed_security, not_sure).");
  if (notice.summary.trim().length < 40) critical.push("summary: describe the need in plain English (a few sentences).");
  if (!notice.title) critical.push("title: a clear one-line project title.");
  if (notice.regions.length === 0) critical.push("regions: where vendors must deliver.");
  // The public quality gate (Robert's ruling, 28 Jul 2026): no test data,
  // coherent figures, sector stated or explicitly not stated. Reported as
  // critical gaps so every client, web wizard or agent, hears the same
  // refusal for the same reason (Article 17).
  critical.push(...publicNoticeQualityGate(notice));

  const recommended: string[] = [];
  if (notice.sites == null && !notice.users_band) recommended.push("sites or users_band: scale is the first thing every vendor asks.");
  if (!notice.response_deadline) recommended.push("response_deadline: undated notices get slower responses.");
  if (notice.evidence_requested.length === 0) recommended.push("evidence_requested: asking for evidence up front makes replies comparable.");
  if (notice.evaluation_priorities.length === 0) recommended.push("evaluation_priorities: tell vendors what will win.");
  if (!notice.current_environment) recommended.push("current_environment: what you run today (contracts ending, known pain).");

  // Denominators reflect the checks actually run (4 baseline critical checks
  // plus the quality gate's ceiling of 8; 5 recommended checks). Clamped at
  // zero: a notice can fail more gates than the baseline four.
  const criticalScore = Math.max(0, (4 - critical.length) / 4);
  const recommendedScore = Math.max(0, (5 - recommended.length) / 5);
  const completeness = Math.round((criticalScore * 0.7 + recommendedScore * 0.3) * 100) / 100;

  return {
    notice,
    validation: { completeness, critical_gaps: critical, recommended_gaps: recommended, dropped_values: dropped },
  };
}
