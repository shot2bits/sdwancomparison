/**
 * Autonomy primitives for Slice 1: the standing procurement goal, the approval
 * queue, the audit trail, and the bid-review record. Pure types and Zod, no
 * Node imports, so the client UIs can share them.
 *
 * Design rules enforced here:
 *  - Every proposed action carries a rationale (audit records WHY).
 *  - Bid review separates deterministic evidence checks from LLM judgement.
 *  - Netify's independent vendor grade is held distinctly from supplier claims.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Standing procurement goal                                           */
/* ------------------------------------------------------------------ */

export const BUDGET_DIRECTIONS = ["reduce", "hold", "flexible"] as const;
export const GOAL_AUTONOMY = ["notify_only", "propose_approve", "act_within_bounds"] as const;
export const GOAL_STATUSES = ["active", "paused", "achieved", "cancelled"] as const;

export const GoalTargetsSchema = z.object({
  deadline_ts: z.number().nullable().default(null),
  response_deadline_ts: z.number().nullable().default(null),
  budget_direction: z.enum(BUDGET_DIRECTIONS).default("hold"),
  min_bids: z.number().int().min(0).default(3),
}).strict();
export type GoalTargets = z.infer<typeof GoalTargetsSchema>;

export const ProcurementGoalSchema = z.object({
  rfp_id: z.string(),
  outcome: z.string().default(""),
  must_have: z.array(z.string()).default([]),
  targets: GoalTargetsSchema.default(() => GoalTargetsSchema.parse({})),
  // Slice 1 default is propose_approve and the loop is reactive only.
  autonomy: z.enum(GOAL_AUTONOMY).default("propose_approve"),
  status: z.enum(GOAL_STATUSES).default("active"),
  created: z.number(),
  updated: z.number(),
  last_run_ts: z.number().default(0),
}).strict();
export type ProcurementGoal = z.infer<typeof ProcurementGoalSchema>;

/* ------------------------------------------------------------------ */
/* Approval queue                                                      */
/* ------------------------------------------------------------------ */

// Slice 1 kinds only. Award recommendation and outreach kinds arrive in later
// slices. send_clarification is the one supplier-facing action here and it is
// gated: nothing leaves until the buyer approves.
export const APPROVAL_KINDS = ["send_clarification"] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "expired", "executed"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, per Slice 1 decision

export const ApprovalItemSchema = z.object({
  id: z.string(),
  rfp_id: z.string(),
  kind: z.enum(APPROVAL_KINDS),
  vendor_slug: z.string().default(""),   // target supplier, where relevant
  vendor_name: z.string().default(""),
  summary: z.string().default(""),       // one line for the buyer
  payload: z.record(z.string(), z.string()).default({}), // e.g. { question: "..." }
  rationale: z.string().default(""),     // WHY the agent proposes this (audit)
  source_review_id: z.string().default(""),
  status: z.enum(APPROVAL_STATUSES).default("pending"),
  created: z.number(),
  expires: z.number(),
  decided: z.number().nullable().default(null),
}).strict();
export type ApprovalItem = z.infer<typeof ApprovalItemSchema>;

/* ------------------------------------------------------------------ */
/* Audit trail                                                         */
/* ------------------------------------------------------------------ */

export const AUDIT_ACTIONS = [
  "memory_learn", "memory_conflict", "memory_edit",
  "goal_set", "goal_update",
  "bid_review", "propose_action", "approve_action", "reject_action", "execute_action",
  "risk_flag",
  // Slice 2 run loop
  "run_start", "run_inspect", "run_propose", "run_skip", "run_noop", "run_deferred", "run_error", "run_complete",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AuditEntrySchema = z.object({
  id: z.string(),
  rfp_id: z.string(),
  action: z.enum(AUDIT_ACTIONS),
  actor: z.enum(["agent", "buyer", "system"]).default("agent"),
  summary: z.string().default(""),
  rationale: z.string().default(""), // the why, always recorded for agent actions
  ref: z.string().default(""),       // related id (approval, review, vendor)
  ts: z.number(),
}).strict();
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/* ------------------------------------------------------------------ */
/* Bid review: evidence checks vs LLM judgement, kept separate         */
/* ------------------------------------------------------------------ */

/** One deterministic, rules-based check. No model involved. */
export const EvidenceCheckSchema = z.object({
  key: z.string(),                 // e.g. "mandatory_coverage", "claim_vs_grade:f30_..."
  label: z.string(),
  pass: z.boolean(),
  detail: z.string().default(""),
}).strict();
export type EvidenceCheck = z.infer<typeof EvidenceCheckSchema>;

/** Compares a supplier's self-asserted claim against Netify's independent grade. */
export const ClaimVsGradeSchema = z.object({
  feature_id: z.string(),
  feature_name: z.string().default(""),
  supplier_claim: z.string().default(""),   // what the supplier said
  netify_grade: z.string().default(""),      // Netify's independent grade (yes/partial/...)
  overreach: z.boolean().default(false),     // claim exceeds the graded evidence
  note: z.string().default(""),
}).strict();
export type ClaimVsGrade = z.infer<typeof ClaimVsGradeSchema>;

/** A gap the agent wants to close, optionally drafted as a clarification. */
export const BidGapSchema = z.object({
  question_id: z.string().default(""),
  feature_id: z.string().default(""),
  category: z.string().default(""),
  kind: z.enum(["unanswered", "weak", "overreach", "non_committal"]).default("weak"),
  detail: z.string().default(""),
  drafted_clarification: z.string().default(""), // proposed, never auto-sent
}).strict();
export type BidGap = z.infer<typeof BidGapSchema>;

export const BidReviewSchema = z.object({
  id: z.string(),
  rfp_id: z.string(),
  response_id: z.string(),
  vendor: z.string().default(""),
  vendor_slug: z.string().nullable().default(null),
  // Deterministic, evidence-based layer:
  coverage_ratio: z.number().min(0).max(1).default(0), // required questions answered
  evidence_checks: z.array(EvidenceCheckSchema).default([]),
  claim_vs_grade: z.array(ClaimVsGradeSchema).default([]),
  // LLM-judgement layer, clearly separated:
  llm_quality_summary: z.string().default(""),
  llm_score: z.number().min(0).max(100).nullable().default(null), // null if model unavailable
  // Synthesis:
  gaps: z.array(BidGapSchema).default([]),
  goal_fit_note: z.string().default(""),
  created: z.number(),
}).strict();
export type BidReview = z.infer<typeof BidReviewSchema>;

/* ------------------------------------------------------------------ */
/* Risk flags (Slice 1: surfaced, not auto-actioned)                   */
/* ------------------------------------------------------------------ */

export const RISK_KINDS = ["single_bidder", "compliance_gap", "claim_overreach", "weak_field", "deadline_risk"] as const;
export type RiskKind = (typeof RISK_KINDS)[number];

export const RiskFlagSchema = z.object({
  kind: z.enum(RISK_KINDS),
  severity: z.enum(["info", "warn", "high"]).default("warn"),
  message: z.string(),
  recommendation: z.string().default(""), // recommended next action (not auto-run in Slice 1)
}).strict();
export type RiskFlag = z.infer<typeof RiskFlagSchema>;

/* ------------------------------------------------------------------ */
/* Slice 2: time-driven run loop (digest + run report)                 */
/* ------------------------------------------------------------------ */

// Budgets and windows. Constants, not config, so behaviour is predictable.
export const RUN_MAX_RFPS = 25;                       // RFPs processed per run
export const RUN_MAX_PROPOSALS_PER_RFP = 5;           // new proposals per RFP per run
export const RUN_MAX_LLM_CALLS = 12;                  // digest-summary LLM calls per run
export const RUN_SOFT_DEADLINE_MS = 50_000;           // stop starting new RFPs after this
export const RUN_LOCK_TTL_MS = 240_000;               // whole-run lock (4 min)
export const RFP_LOCK_TTL_MS = 120_000;               // per-RFP lock (2 min)
export const DIGEST_COOLDOWN_MS = 12 * 60 * 60 * 1000; // min interval between digests per RFP
export const STALE_APPROVAL_MS = 5 * 24 * 60 * 60 * 1000; // pending proposal age that warrants a nudge
export const DEADLINE_WINDOW_MS = 72 * 60 * 60 * 1000; // "deadline approaching" window
export const MAX_OPEN_PROPOSALS_PER_SUPPLIER_PER_RFP = 3;
// Quiet hours, Europe/London. Governs (future) buyer notifications, not computation.
export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 7;

export const DIGEST_ITEM_KINDS = ["deadline_risk", "missing_bids", "pending_gap", "weak_answer", "stale_approval"] as const;
export type DigestItemKind = (typeof DIGEST_ITEM_KINDS)[number];

export const DigestItemSchema = z.object({
  kind: z.enum(DIGEST_ITEM_KINDS),
  severity: z.enum(["info", "warn", "high"]).default("info"),
  message: z.string(),
  recommendation: z.string().default(""),
  ref: z.string().default(""), // related approval id, vendor slug, etc.
}).strict();
export type DigestItem = z.infer<typeof DigestItemSchema>;

export const DigestSchema = z.object({
  id: z.string(),
  rfp_id: z.string(),
  rfp_title: z.string().default(""),
  created: z.number(),
  run_id: z.string().default(""),
  summary: z.string().default(""),       // deterministic, optionally LLM-phrased
  llm_used: z.boolean().default(false),
  items: z.array(DigestItemSchema).default([]),
  proposal_ids: z.array(z.string()).default([]),
}).strict();
export type Digest = z.infer<typeof DigestSchema>;

export const AgentRunSchema = z.object({
  id: z.string(),
  trigger: z.enum(["cron", "manual"]).default("cron"),
  started: z.number(),
  finished: z.number().default(0),
  considered: z.number().default(0),   // active-goal RFPs found
  processed: z.number().default(0),    // RFPs fully inspected
  skipped: z.number().default(0),      // ineligible (no goal, cooldown, locked, not open)
  deferred: z.number().default(0),     // hit budget/soft-deadline, left for next run
  proposals_created: z.number().default(0),
  digests_created: z.number().default(0),
  // Supplier-facing actions executed by this run. In Slice 2 the loop has no
  // outbound path, so this is always 0; it is a positive, observable assertion
  // in the run output, and any future slice that executes a send MUST increment
  // it (and only after approval), so a non-zero value is immediately auditable.
  sends: z.number().default(0),
  llm_calls: z.number().default(0),
  note: z.string().default(""),        // e.g. "another run in progress"
  errors: z.array(z.string()).default([]),
}).strict();
export type AgentRun = z.infer<typeof AgentRunSchema>;
