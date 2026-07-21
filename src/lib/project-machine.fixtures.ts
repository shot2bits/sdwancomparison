/**
 * Project state machine test suite (Phase B step 1). The repo has no test
 * runner, so this follows the estate's fixtures pattern: pure vectors plus
 * an exported runner, executed by the verification harness on every change
 * and callable by any future runner unchanged.
 *
 * Coverage, per the approval: every legal transition, every illegal
 * transition from every phase, every guard failure, the append-only tamper
 * test, non-transition event legality, correction events, legacy
 * back-compat and status sync.
 */

import {
  advanceProject,
  recordProjectEvent,
  assertHistoryExtends,
  projectPhase,
  PROJECT_TRANSITIONS,
  STATUS_FOR_PHASE,
} from "./project-machine";
import { PROJECT_PHASE } from "./rfp-types";
import type { ProjectDetails, ProjectHistoryEvent, ProjectPhase } from "./rfp-types";

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

let clock = 1_700_000_000_000;
const ev = (event: string, detail: Record<string, unknown> = {}): ProjectHistoryEvent => ({
  at: (clock += 1000),
  actor: "buyer",
  actor_ref: "test",
  via: "web",
  event,
  detail,
});

function baseProject(overrides: Partial<ProjectDetails> = {}): ProjectDetails {
  return {
    id: "rfp_test1",
    created: clock,
    updated: clock,
    status: "draft",
    title: "Test project",
    buyer: {} as ProjectDetails["buyer"],
    rfp_sections: [],
    invited_vendors: [],
    share_token: "tok_share",
    manage_token: "tok_manage",
    source: "wizard",
    owner_email: "buyer@test.co",
    methodology_version: "2026.1",
    nda: { required: false, source: "template", text: "", link: "", version: 1, updated: 0 },
    history: [],
    consents: [],
    engine: "security_sourcing",
    engine_data: { verdicts: [], requirement: undefined },
    phase: "scoping",
    ...overrides,
  } as ProjectDetails;
}

const withVerdict = (p: ProjectDetails): ProjectDetails => ({
  ...p,
  engine_data: {
    verdicts: [{ version: 1, verdict: { ok: true }, input_digest: "d".repeat(64), created_at: clock, via: "web" }],
    requirement: {},
  },
});

const withSections = (p: ProjectDetails): ProjectDetails => ({
  ...p,
  rfp_sections: [{ category: "Scope", included: true, questions: [] } as unknown as ProjectDetails["rfp_sections"][number]],
});

const withPublishConsent = (p: ProjectDetails): ProjectDetails => ({
  ...p,
  consents: [{ at: clock, action: "publish", granted_by: "buyer@test.co", via: "web", text: "I agree to publish." }],
});

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

export interface MachineTestResult {
  pass: number;
  fail: number;
  failures: string[];
}

export function runProjectMachineTests(): MachineTestResult {
  const r: MachineTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = (name: string, fn: () => void) => {
    try { fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const throws = (name: string, fn: () => void) => {
    try { fn(); r.fail += 1; r.failures.push(`${name}: expected throw, none thrown`); }
    catch { r.pass += 1; }
  };

  /* ---- The full legal happy path, scoping to complete ---- */
  ok("happy path walks scoping to complete with exact history", () => {
    let p = baseProject();
    p = advanceProject(withVerdict(p), ev("verdict.attached"));
    if (projectPhase(p) !== "scoped") throw new Error("not scoped");
    p = advanceProject(withSections(p), ev("rfp.generated"));
    if (projectPhase(p) !== "drafted") throw new Error("not drafted");
    p = advanceProject(withPublishConsent(p), ev("publish.live"));
    if (projectPhase(p) !== "published" || p.status !== "published") throw new Error("not published/synced");
    p = advanceProject(p, ev("clarification.asked"));
    if (projectPhase(p) !== "qa" || p.status !== "qa") throw new Error("not qa");
    p = advanceProject(p, ev("evaluation.opened", { submitted_responses: 2 }));
    if (projectPhase(p) !== "evaluation") throw new Error("not evaluation");
    p = advanceProject(p, ev("award.decided", { preferred_vendor_slug: "acme-mssp" }));
    if (projectPhase(p) !== "awarded") throw new Error("not awarded");
    p = recordProjectEvent(p, ev("award.accepted", { name: "Sam Supplier", role: "Director" }));
    p = advanceProject(p, ev("transaction.introduced"));
    if (projectPhase(p) !== "transacting") throw new Error("not transacting");
    p = recordProjectEvent(p, ev("transaction.milestone", { label: "contracting" }));
    p = advanceProject(p, ev("transaction.complete", { outcome: "proceeded" }));
    if (projectPhase(p) !== "complete") throw new Error("not complete");
    if (p.history.length !== 10) throw new Error(`history length ${p.history.length}, want 10`);
  });

  ok("manual drafting path: scoped to drafting on rfp.edited, then drafted", () => {
    let p = advanceProject(withVerdict(baseProject()), ev("verdict.attached"));
    p = advanceProject(p, ev("rfp.edited", { sectionId: "s1" }));
    if (projectPhase(p) !== "drafting") throw new Error("not drafting");
    p = advanceProject(withSections(p), ev("rfp.generated"));
    if (projectPhase(p) !== "drafted") throw new Error("not drafted");
  });

  ok("award.declined returns awarded to evaluation for re-award", () => {
    let p = baseProject({ phase: "evaluation", status: "evaluation" });
    p = advanceProject(p, ev("award.decided", { preferred_vendor_slug: "acme" }));
    p = advanceProject(p, ev("award.declined", { reason: "capacity" }));
    if (projectPhase(p) !== "evaluation") throw new Error("not back in evaluation");
  });

  ok("published straight to evaluation on deadline without questions", () => {
    const p = baseProject({ phase: "published", status: "published" });
    const next = advanceProject(p, ev("evaluation.opened", { deadline_passed: true }));
    if (projectPhase(next) !== "evaluation") throw new Error("not evaluation");
  });

  ok("closed reachable from every pre-award phase, status syncs", () => {
    for (const phase of ["scoping", "scoped", "drafting", "drafted", "published", "qa", "evaluation"] as ProjectPhase[]) {
      const p = baseProject({ phase, status: STATUS_FOR_PHASE[phase] });
      const next = advanceProject(p, ev("project.closed", { reason: "withdrawn" }));
      if (projectPhase(next) !== "closed") throw new Error(`${phase} did not close`);
    }
  });

  /* ---- Exactly one append per advance; input untouched ---- */
  ok("advance appends exactly one event and does not mutate its input", () => {
    const p = withVerdict(baseProject());
    const before = p.history.length;
    const next = advanceProject(p, ev("verdict.attached"));
    if (next.history.length !== before + 1) throw new Error("appended != 1");
    if (p.history.length !== before) throw new Error("input mutated");
    if (p.phase !== "scoping") throw new Error("input phase mutated");
  });

  /* ---- The illegal transition matrix: every transition event from every
          phase it is not legal in must throw and append nothing ---- */
  const transitionEvents = [...new Set(PROJECT_TRANSITIONS.map((t) => t.event))];
  for (const phase of PROJECT_PHASE) {
    for (const event of transitionEvents) {
      const legal = PROJECT_TRANSITIONS.some((t) => t.event === event && t.from.includes(phase));
      if (legal) continue;
      throws(`illegal: ${event} from ${phase}`, () => {
        // Satisfy every guard so only the table itself can reject.
        const p = withPublishConsent(withSections(withVerdict(
          baseProject({ phase, status: STATUS_FOR_PHASE[phase] }),
        )));
        advanceProject(p, ev(event, {
          submitted_responses: 5, deadline_passed: true,
          preferred_vendor_slug: "acme", reason: "withdrawn",
        }));
      });
    }
  }

  /* ---- Guard failures ---- */
  throws("scoped requires a verdict", () =>
    advanceProject(baseProject(), ev("verdict.attached")));
  throws("drafted requires sections", () =>
    advanceProject(baseProject({ phase: "scoped" }), ev("rfp.generated")));
  throws("published requires consent", () =>
    advanceProject(withSections(baseProject({ phase: "drafted", status: "review" })), ev("publish.live")));
  ok("legacy single consent object also satisfies the publish guard", () => {
    const p = withSections(baseProject({ phase: "drafted", status: "review" }));
    const legacy = { ...p, consent: { version: "v3", agreed_at: clock, flow: "wizard" } } as ProjectDetails;
    advanceProject(legacy, ev("publish.live"));
  });
  throws("evaluation requires responses or deadline", () =>
    advanceProject(baseProject({ phase: "published", status: "published" }), ev("evaluation.opened")));
  throws("award requires preferred_vendor_slug", () =>
    advanceProject(baseProject({ phase: "evaluation", status: "evaluation" }), ev("award.decided")));
  throws("transacting requires award.accepted in history", () =>
    advanceProject(baseProject({ phase: "awarded", status: "evaluation" }), ev("transaction.introduced")));
  throws("close requires a known reason", () =>
    advanceProject(baseProject(), ev("project.closed", { reason: "bored" })));
  throws("close is not available post-award", () =>
    advanceProject(baseProject({ phase: "awarded", status: "evaluation" }), ev("project.closed", { reason: "withdrawn" })));

  /* ---- Non-transition events ---- */
  ok("rfp.edited records in drafted without a phase change", () => {
    const p = baseProject({ phase: "drafted", status: "review" });
    const next = recordProjectEvent(p, ev("rfp.edited", { sectionId: "s1" }));
    if (projectPhase(next) !== "drafted" || next.history.length !== 1) throw new Error("wrong");
  });
  ok("re-scope appends a verdict event mid-drafting without bouncing back", () => {
    const p = baseProject({ phase: "drafted", status: "review" });
    const next = recordProjectEvent(p, ev("verdict.attached", { version: 2 }));
    if (projectPhase(next) !== "drafted") throw new Error("phase bounced");
  });
  throws("comparison.adjusted is not recordable while drafting", () =>
    recordProjectEvent(baseProject({ phase: "drafting" }), ev("comparison.adjusted")));
  throws("unknown events are not recordable", () =>
    recordProjectEvent(baseProject(), ev("something.weird")));
  ok("corrections are recordable in any phase with a reference", () => {
    recordProjectEvent(baseProject({ phase: "complete", status: "evaluation" }),
      ev("award.corrected", { corrects_index: 3, note: "typo in rationale" }));
  });
  throws("corrections without corrects_index are rejected", () =>
    recordProjectEvent(baseProject(), ev("award.corrected", { note: "no ref" })));

  /* ---- Event validation ---- */
  throws("events without actor are rejected", () => {
    const bad = { ...ev("verdict.attached"), actor: "" } as unknown as ProjectHistoryEvent;
    advanceProject(withVerdict(baseProject()), bad);
  });
  throws("events without dot namespace are rejected", () =>
    advanceProject(withVerdict(baseProject()), ev("published")));

  /* ---- Append-only tamper test (the saveProject guard) ---- */
  ok("history extension passes", () => {
    const a = [ev("project.created")];
    assertHistoryExtends(a, [...a, ev("verdict.attached")]);
    assertHistoryExtends(a, a);
    assertHistoryExtends(undefined, []);
  });
  throws("history shrink is refused", () => {
    const a = [ev("project.created"), ev("verdict.attached")];
    assertHistoryExtends(a, [a[0]]);
  });
  throws("history prefix mutation is refused", () => {
    const e1 = ev("project.created");
    const a = [e1, ev("verdict.attached")];
    const tampered = [{ ...e1, detail: { edited: true } }, a[1], ev("rfp.edited")];
    assertHistoryExtends(a, tampered);
  });

  /* ---- Legacy back-compat ---- */
  ok("pre-engine records derive phase from status and can advance", () => {
    const legacy = { ...baseProject(), phase: undefined, engine: undefined, engine_data: undefined, status: "qa" } as ProjectDetails;
    if (projectPhase(legacy) !== "qa") throw new Error("derivation wrong");
    const next = advanceProject(legacy, ev("evaluation.opened", { submitted_responses: 1 }));
    if (projectPhase(next) !== "evaluation" || next.history.length !== 1) throw new Error("legacy advance failed");
  });
  ok("status stays in sync for every phase", () => {
    for (const phase of PROJECT_PHASE) {
      if (!STATUS_FOR_PHASE[phase]) throw new Error(`no status mapping for ${phase}`);
    }
  });

  return r;
}
