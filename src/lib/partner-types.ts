/**
 * Reseller (BT Business) partner workspace entities for Slice R1.
 * Same spine as the SASE side: memory, goal, tool artefacts, approvals, audit,
 * digest. Pure types and Zod, no Node imports, so the workspace UI shares them.
 *
 * Discipline: the agent produces internal artefacts freely; anything that would
 * reach a customer, an account manager or BT is a pending approval, never sent.
 */

import { z } from "zod";

/* ---------------- Partner memory ---------------- */

export const ORCA_STATUSES = ["not_applied", "applied", "in_onboarding", "live"] as const;
export type OrcaStatus = (typeof ORCA_STATUSES)[number];

export const PartnerMemorySchema = z.object({
  email: z.string(),
  company_name: z.string().default(""),
  companies_house_no: z.string().default(""),
  orca_status: z.enum(ORCA_STATUSES).default("not_applied"),
  orca_code_on_file: z.boolean().default(false),
  target_customer_type: z.array(z.string()).default([]),   // SME, micro, mid-market
  preferred_sectors: z.array(z.string()).default([]),
  broadband_focus: z.array(z.string()).default([]),         // fttp, sogea, soadsl, mixed
  preferred_addons: z.array(z.string()).default([]),        // cloud_voice_express, threat_protection, complete_wifi
  monthly_opportunity_target: z.number().int().min(0).default(0),
  sales_capacity: z.string().default(""),
  margin_or_commission_goal: z.string().default(""),
  blockers: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
  created: z.number(),
  updated: z.number(),
}).strict();
export type PartnerMemory = z.infer<typeof PartnerMemorySchema>;

/* ---------------- Reseller goal ---------------- */

export const GOAL_KINDS = ["generate_opportunities", "run_campaign", "prioritise_fttp_reviews", "complete_onboarding", "target_sector"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const ResellerGoalSchema = z.object({
  partner_email: z.string(),
  outcome: z.string().default(""),
  kind: z.enum(GOAL_KINDS).default("generate_opportunities"),
  targets: z.object({
    opportunity_count: z.number().int().min(0).default(0),
    window_end_ts: z.number().nullable().default(null),
    segment: z.string().default(""),
  }).strict().default(() => ({ opportunity_count: 0, window_end_ts: null, segment: "" })),
  status: z.enum(["active", "paused", "achieved", "cancelled"]).default("active"),
  created: z.number(),
  updated: z.number(),
  last_run_ts: z.number().default(0),
}).strict();
export type ResellerGoal = z.infer<typeof ResellerGoalSchema>;

/* ---------------- Artefacts (internal, produced by tools) ---------------- */

export const ARTEFACT_KINDS = ["sales_plan", "call_script", "email_draft", "objection_handling", "checklist", "simulator_run", "next_actions"] as const;
export type ArtefactKind = (typeof ARTEFACT_KINDS)[number];

export const ArtefactSchema = z.object({
  id: z.string(),
  partner_email: z.string(),
  kind: z.enum(ARTEFACT_KINDS),
  title: z.string().default(""),
  content: z.string().default(""),        // markdown / plain text the partner can copy
  meta: z.record(z.string(), z.string()).default({}), // e.g. simulator inputs/outputs as JSON
  // Email drafts are internal until approved to send; this links the draft to
  // its pending approval so the UI can show "drafted, awaiting your approval".
  external: z.boolean().default(false),
  created: z.number(),
}).strict();
export type Artefact = z.infer<typeof ArtefactSchema>;

/* ---------------- Tasks ---------------- */

export const TaskSchema = z.object({
  id: z.string(),
  partner_email: z.string(),
  title: z.string(),
  detail: z.string().default(""),
  due_ts: z.number().nullable().default(null),
  status: z.enum(["open", "done"]).default("open"),
  created: z.number(),
}).strict();
export type PartnerTask = z.infer<typeof TaskSchema>;

/* ---------------- External approvals (pending-only in R1) ---------------- */

export const PARTNER_APPROVAL_KINDS = ["customer_email", "customer_followup", "account_manager_request", "bt_submission", "quote_order"] as const;
export type PartnerApprovalKind = (typeof PARTNER_APPROVAL_KINDS)[number];

export const PARTNER_APPROVAL_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export const PartnerApprovalSchema = z.object({
  id: z.string(),
  partner_email: z.string(),
  kind: z.enum(PARTNER_APPROVAL_KINDS),
  summary: z.string().default(""),
  payload: z.record(z.string(), z.string()).default({}), // recipient, subject, body, etc.
  rationale: z.string().default(""),
  artefact_id: z.string().default(""),
  // In R1, approving only records the decision; no send path exists yet, so
  // there is no "executed" status. Execution arrives in a later slice.
  status: z.enum(["pending", "approved", "rejected", "expired"]).default("pending"),
  created: z.number(),
  expires: z.number(),
  decided: z.number().nullable().default(null),
}).strict();
export type PartnerApproval = z.infer<typeof PartnerApprovalSchema>;

/* ---------------- Audit ---------------- */

export const PARTNER_AUDIT_ACTIONS = [
  "memory_learn", "memory_conflict", "memory_edit",
  "goal_set",
  "artefact_created", "task_created",
  "propose_external", "approve_external", "reject_external",
  "digest", "run_noop",
] as const;
export type PartnerAuditAction = (typeof PARTNER_AUDIT_ACTIONS)[number];

export const PartnerAuditSchema = z.object({
  id: z.string(),
  partner_email: z.string(),
  action: z.enum(PARTNER_AUDIT_ACTIONS),
  actor: z.enum(["agent", "partner"]).default("agent"),
  summary: z.string().default(""),
  rationale: z.string().default(""),
  ref: z.string().default(""),
  ts: z.number(),
}).strict();
export type PartnerAuditEntry = z.infer<typeof PartnerAuditSchema>;

/* ---------------- Digest (manual in R1) ---------------- */

export const PARTNER_DIGEST_ITEM_KINDS = ["goal_progress", "onboarding_stalled", "task_due", "draft_awaiting_approval", "blocker_unresolved"] as const;
export type PartnerDigestItemKind = (typeof PARTNER_DIGEST_ITEM_KINDS)[number];

export const PartnerDigestItemSchema = z.object({
  kind: z.enum(PARTNER_DIGEST_ITEM_KINDS),
  severity: z.enum(["info", "warn", "high"]).default("info"),
  message: z.string(),
  recommendation: z.string().default(""),
  ref: z.string().default(""),
}).strict();
export type PartnerDigestItem = z.infer<typeof PartnerDigestItemSchema>;

export const PartnerDigestSchema = z.object({
  id: z.string(),
  partner_email: z.string(),
  created: z.number(),
  trigger: z.enum(["manual", "cron"]).default("manual"),
  summary: z.string().default(""),
  items: z.array(PartnerDigestItemSchema).default([]),
  pending_external: z.number().default(0),
  // Positive operational assertion, same idea as the SASE run report: this
  // process executed zero customer/BT-facing sends.
  sends: z.number().default(0),
}).strict();
export type PartnerDigest = z.infer<typeof PartnerDigestSchema>;
