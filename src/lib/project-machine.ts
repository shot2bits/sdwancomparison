/**
 * The Project state machine (Phase B step 1, 21 July 2026; spec:
 * docs/netify-security-sourcing-phase-bc-implementation-spec.md section 1).
 *
 * Engine-agnostic and constitutional: ONE function moves a Project between
 * phases (advanceProject), illegal transitions throw and append nothing,
 * every successful transition appends exactly one history event, history is
 * append-only (assertHistoryExtends is the tamper test saveProject uses),
 * and the legacy `status` field is kept in sync for every existing consumer
 * (Constitution Articles 9, 11; spec 1.2, 1.3).
 *
 * Pure and client-safe like rfp-types: no Node imports, no I/O. Storage
 * lives in rfp-store (saveProject); this module only computes.
 */

import type { ProjectDetails, RfpStatus } from "@/lib/rfp-types";
import type { ProjectPhase, ProjectHistoryEvent } from "@/lib/rfp-types";

/* ------------------------------------------------------------------ */
/* Phase <-> legacy status mapping (spec 1.2)                          */
/* ------------------------------------------------------------------ */

/** Legacy status implied by each phase; kept in sync on every advance. */
export const STATUS_FOR_PHASE: Record<ProjectPhase, RfpStatus> = {
  scoping: "draft",
  scoped: "draft",
  drafting: "draft",
  drafted: "review",
  published: "published",
  qa: "qa",
  evaluation: "evaluation",
  // Post-evaluation phases have no legacy equivalent; existing consumers
  // continue to see the terminal legacy stage they already understand.
  awarded: "evaluation",
  transacting: "evaluation",
  complete: "evaluation",
  closed: "evaluation",
};

/** Phase derived for records created before the engine fields existed. */
export const PHASE_FOR_LEGACY_STATUS: Record<RfpStatus, ProjectPhase> = {
  draft: "drafting",
  review: "drafted",
  published: "published",
  qa: "qa",
  evaluation: "evaluation",
};

/** Effective phase with pre-engine back-compat (spec 1.2: absent fields
 *  mean "pre-engine project"; nothing is rewritten to find out). */
export function projectPhase(p: ProjectDetails): ProjectPhase {
  return p.phase ?? PHASE_FOR_LEGACY_STATUS[p.status];
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export class ProjectTransitionError extends Error {
  readonly code = "illegal_transition";
  constructor(message: string) {
    super(message);
    this.name = "ProjectTransitionError";
  }
}

export class ProjectHistoryError extends Error {
  readonly code = "history_violation";
  constructor(message: string) {
    super(message);
    this.name = "ProjectHistoryError";
  }
}

/* ------------------------------------------------------------------ */
/* The transition table (spec 1.3 rules, 1.6 event names)              */
/* ------------------------------------------------------------------ */

type Guard = (p: ProjectDetails, e: ProjectHistoryEvent) => string | null; // null = pass, string = reason

const hasVerdict: Guard = (p) =>
  (p.engine_data?.verdicts?.length ?? 0) >= 1
    ? null
    : "scoped requires at least one attached verdict (spec 1.3)";

const hasSections: Guard = (p) =>
  (p.rfp_sections?.length ?? 0) > 0
    ? null
    : "drafted requires a generated artefact: rfp_sections is empty (spec 1.3)";

const hasPublishConsent: Guard = (p) => {
  const ledger = (p.consents ?? []).some((c) => c.action === "publish");
  const legacy = !!p.consent; // the existing wizard submit-agreement record
  return ledger || legacy
    ? null
    : "published requires a recorded publish consent (spec 1.3; Article 13)";
};

const evaluationOpen: Guard = (_p, e) => {
  const submitted = Number(e.detail?.submitted_responses ?? 0);
  const deadline = e.detail?.deadline_passed === true;
  return submitted >= 1 || deadline
    ? null
    : "evaluation requires at least one submitted response or a passed deadline, stated in event.detail (spec 1.3)";
};

const hasPreferredSupplier: Guard = (_p, e) =>
  typeof e.detail?.preferred_vendor_slug === "string" && e.detail.preferred_vendor_slug
    ? null
    : "award.decided requires detail.preferred_vendor_slug (spec 6)";

const awardAccepted: Guard = (p) =>
  (p.history ?? []).some((h) => h.event === "award.accepted")
    ? null
    : "transacting requires a recorded award.accepted (spec 7)";

const closeReason: Guard = (_p, e) => {
  const reasons = ["withdrawn", "no_responses", "escalated_sase", "superseded"];
  return reasons.includes(String(e.detail?.reason))
    ? null
    : `project.closed requires detail.reason in [${reasons.join(", ")}] (spec 1.3)`;
};

interface Transition {
  from: ProjectPhase[];
  to: ProjectPhase;
  event: string;
  guard?: Guard;
}

const PRE_AWARD: ProjectPhase[] = [
  "scoping", "scoped", "drafting", "drafted", "published", "qa", "evaluation",
];

export const PROJECT_TRANSITIONS: Transition[] = [
  { from: ["scoping"], to: "scoped", event: "verdict.attached", guard: hasVerdict },
  // Re-scoping appends a new verdict version without a phase change; handled
  // by recordProjectEvent. A verdict attached mid-drafting is an event, not
  // a transition backwards (Article 9: history accretes, phases do not bounce).
  { from: ["scoped"], to: "drafted", event: "rfp.generated", guard: hasSections },
  { from: ["scoped"], to: "drafting", event: "rfp.edited" },
  { from: ["drafting"], to: "drafted", event: "rfp.generated", guard: hasSections },
  { from: ["drafted"], to: "published", event: "publish.live", guard: hasPublishConsent },
  { from: ["published"], to: "qa", event: "clarification.asked" },
  { from: ["published", "qa"], to: "evaluation", event: "evaluation.opened", guard: evaluationOpen },
  { from: ["evaluation"], to: "awarded", event: "award.decided", guard: hasPreferredSupplier },
  // Supplier declined: back to evaluation for re-award (spec 6).
  { from: ["awarded"], to: "evaluation", event: "award.declined" },
  { from: ["awarded"], to: "transacting", event: "transaction.introduced", guard: awardAccepted },
  { from: ["transacting"], to: "complete", event: "transaction.complete", guard: awardAccepted },
  { from: PRE_AWARD, to: "closed", event: "project.closed", guard: closeReason },
];

/** Events that legally occur without a phase change, per phase. Everything
 *  else during a phase is either a transition (table above) or illegal. */
const NON_TRANSITION_EVENTS: Record<string, ProjectPhase[]> = {
  "project.created": ["scoping"],
  "requirement.updated": ["scoping", "scoped", "drafting", "drafted"],
  "verdict.attached": ["scoped", "drafting", "drafted"], // re-scope: new version, no bounce
  "rfp.edited": ["drafting", "drafted"],
  "rfp.generated": ["drafted"], // regeneration to v(n+1)
  "publish.consented": ["drafted"],
  "publish.approved": ["drafted"],
  "invite.sent": ["published", "qa", "evaluation"],
  "nda.accepted": ["published", "qa", "evaluation"],
  "clarification.asked": ["qa", "evaluation"],
  "clarification.answered": ["published", "qa", "evaluation"],
  "response.started": ["published", "qa"],
  "response.submitted": ["published", "qa"],
  "comparison.generated": ["evaluation"],
  "comparison.adjusted": ["evaluation"],
  "award.accepted": ["awarded"],
  "transaction.milestone": ["transacting"],
};

/* ------------------------------------------------------------------ */
/* Event validation                                                    */
/* ------------------------------------------------------------------ */

function validateEvent(e: ProjectHistoryEvent): void {
  if (!e || typeof e.at !== "number" || e.at <= 0) throw new ProjectHistoryError("event.at required");
  if (!e.actor) throw new ProjectHistoryError("event.actor required");
  if (!e.via) throw new ProjectHistoryError("event.via required");
  if (!e.event || !e.event.includes(".")) throw new ProjectHistoryError("event.event must be dot-namespaced");
  // Corrections reference, never rewrite (Article 9).
  if (e.event.endsWith(".corrected") && typeof e.detail?.corrects_index !== "number") {
    throw new ProjectHistoryError("*.corrected events require detail.corrects_index");
  }
}

/* ------------------------------------------------------------------ */
/* The two write paths                                                 */
/* ------------------------------------------------------------------ */

/**
 * Advance a Project through exactly one legal transition. Returns a NEW
 * record with the phase set, the legacy status synced, `updated` touched
 * and exactly one history event appended. Throws ProjectTransitionError
 * (appending nothing) for anything the table does not permit.
 */
export function advanceProject(p: ProjectDetails, e: ProjectHistoryEvent): ProjectDetails {
  validateEvent(e);
  const from = projectPhase(p);
  const t = PROJECT_TRANSITIONS.find(
    (x) => x.event === e.event && x.from.includes(from),
  );
  if (!t) {
    throw new ProjectTransitionError(
      `No legal transition for event "${e.event}" from phase "${from}"`,
    );
  }
  if (t.guard) {
    const reason = t.guard(p, e);
    if (reason) throw new ProjectTransitionError(reason);
  }
  return {
    ...p,
    phase: t.to,
    status: STATUS_FOR_PHASE[t.to],
    updated: e.at,
    history: [...(p.history ?? []), e],
  };
}

/**
 * Record a non-transition event: appends history without changing phase.
 * The event must be legal in the current phase; unknown or out-of-phase
 * events throw, because an auditable record cannot contain impossible
 * entries (Article 11).
 */
export function recordProjectEvent(p: ProjectDetails, e: ProjectHistoryEvent): ProjectDetails {
  validateEvent(e);
  const from = projectPhase(p);
  const allowedPhases = NON_TRANSITION_EVENTS[e.event];
  const isCorrection = e.event.endsWith(".corrected");
  if (!isCorrection && (!allowedPhases || !allowedPhases.includes(from))) {
    throw new ProjectTransitionError(
      `Event "${e.event}" is not recordable in phase "${from}"`,
    );
  }
  return { ...p, updated: e.at, history: [...(p.history ?? []), e] };
}

/**
 * The append-only tamper test used by saveProject (spec 1.4): the next
 * history must extend the previous one exactly. Shorter, or divergent in
 * the shared prefix, is a violation and the write is refused.
 */
export function assertHistoryExtends(
  prev: ProjectHistoryEvent[] | undefined,
  next: ProjectHistoryEvent[] | undefined,
): void {
  const a = prev ?? [];
  const b = next ?? [];
  if (b.length < a.length) {
    throw new ProjectHistoryError(
      `history shrank from ${a.length} to ${b.length} entries; the record is append-only (Article 9)`,
    );
  }
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      throw new ProjectHistoryError(
        `history entry ${i} was altered; corrections append *.corrected events, they never edit the past (Article 9)`,
      );
    }
  }
}
