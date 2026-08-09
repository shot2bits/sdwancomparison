/**
 * Milestone 3 — FIRST CUT: "Conversation Creates a First-Class Project"
 * (Robert's build prompt, 9 Aug 2026).
 *
 * ONE capability: "continue this procurement conversation." The caller
 * (today: the continue_security_conversation MCP tool) never sequences
 * extract/assess/create/rescope itself — this composes the existing,
 * proven capabilities exactly as they already stand:
 *  - extractRequirement (workspace/extract.ts): the SAME extraction engine
 *    workspace_cycle uses, model-first with the deterministic rail.
 *  - mergeUpdates/requirementFrom/standing (workspace/draft.ts): the SAME
 *    fact ledger and correction/resurrection semantics the page uses,
 *    given a starting ledger loaded from the persisted Project instead of
 *    from React state.
 *  - buildSecurityProject / buildRescopedProject (security/create-project,
 *    rescope-project): the SAME twin-gated core the existing MCP tools
 *    call, with the two gates this milestone added (skipConfidenceGate,
 *    skipRfpGeneration) now switched on for this path only.
 *  - earnedQuestions (workspace/questions.ts): the SAME earned-question
 *    engine, unmodified.
 *
 * No second extraction engine, no second Project-update mechanism, no
 * second question engine. What is new is the ORCHESTRATION: reconciling a
 * persisted Understanding ledger across turns and keeping the Project at
 * phase "scoped" — verdict attached, no RFP — until an explicit later step.
 *
 * Split like every other engine capability in this codebase (create-
 * project.ts, rescope-project.ts): a PURE computation half (computeFirstTurn
 * / computeNextTurn — extraction, ledger merge, completeness; no I/O, fully
 * unit-testable without KV) and a thin I/O half (continueSecurityConversation
 * — reads/writes the Project through the existing store and engine cores).
 */

import { extractRequirement } from "@/lib/workspace/extract";
import type { BuyingId, OperatingModelId } from "@/lib/workspace/extract";
import { mergeUpdates, requirementFrom, standing, type WorkspaceFact } from "@/lib/workspace/draft";
import { earnedQuestions, type EarnedQuestion } from "@/lib/workspace/questions";
import {
  computeCompleteness,
  mergeObjectives,
  type Understanding,
  type UnderstandingObjective,
} from "@/lib/workspace/understanding";
import type { SecurityRequirementInput, SecurityScopeVerdict } from "@/lib/security/rulebook";
import { createSecurityProject } from "@/lib/security/persist-project";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { buildRescopedProject } from "@/lib/security/rescope-project";
import { getProject, saveProject } from "@/lib/rfp-store";
import { recordProjectEvent } from "@/lib/project-machine";
import type { ProjectDetails } from "@/lib/rfp-types";

/** Thrown for every refusal this capability can produce; carries the
 *  consent wording when the refusal is "you haven't consented yet",
 *  matching create_security_project's existing error/consent_text shape. */
export class ConverseError extends Error {
  readonly consentText?: string;
  constructor(message: string, consentText?: string) {
    super(message);
    this.name = "ConverseError";
    this.consentText = consentText;
  }
}

/* ------------------------------------------------------------------ */
/* PURE half: extraction + ledger + completeness. No I/O.              */
/* ------------------------------------------------------------------ */

export interface TurnComputation {
  facts: WorkspaceFact[];
  /** Fact ids this turn added or changed (mergeUpdates' own ripple set). */
  changed: string[];
  /** Facts this turn superseded (Test H): the earlier value, replaced by
   *  the new one. Empty on the first turn and on any later turn that only
   *  added or confirmed facts. */
  corrections: Array<{ path: string; from: unknown; to: unknown }>;
  requirement: SecurityRequirementInput;
  understanding: Understanding;
  earnedQuestions: EarnedQuestion[];
}

/** Last standing value for a scalar path, or null. Same lookup draft.ts's
 *  own briefModel() uses internally, kept local here rather than exported
 *  from draft.ts to avoid growing that module's public surface for a
 *  single caller. */
function lastStandingValue(facts: WorkspaceFact[], path: string): unknown {
  const xs = standing(facts).filter((f) => f.path === path);
  return xs.length ? xs[xs.length - 1].value : null;
}

function buildUnderstanding(
  facts: WorkspaceFact[],
  objectives: UnderstandingObjective[],
  cycle: number,
  now: number,
): Understanding {
  return {
    facts: facts as Understanding["facts"],
    objectives,
    completeness: computeCompleteness(standing(facts), objectives),
    cycle,
    updated_at: now,
  };
}

function earnedFor(requirement: SecurityRequirementInput, facts: WorkspaceFact[]): EarnedQuestion[] {
  const buying = lastStandingValue(facts, "procurement.buying") as BuyingId | null;
  const operatingModel = lastStandingValue(facts, "procurement.operatingModel") as OperatingModelId | null;
  // Same call shape workspace_cycle makes (notedIds/dismissed empty: this
  // capability, like workspace_cycle, holds no separate answered-question
  // ledger of its own — reusing the engine exactly, not extending it).
  return earnedQuestions(requirement, buying ?? null, operatingModel ?? null, [], []);
}

/** First turn: no prior Understanding to reconcile against. */
export async function computeFirstTurn(text: string, now: number): Promise<TurnComputation> {
  const extracted = await extractRequirement(text, {});
  const { facts } = mergeUpdates([], extracted.updates, 1, "extract");
  const requirement = requirementFrom(facts);
  const objectives = mergeObjectives([], text);
  const understanding = buildUnderstanding(facts, objectives, 1, now);
  return {
    facts,
    changed: facts.map((f) => f.id),
    corrections: [],
    requirement,
    understanding,
    earnedQuestions: earnedFor(requirement, facts),
  };
}

/**
 * A later turn: the new text is reconciled against the STANDING facts
 * already on record (Robert's subsequent-turn law — a new contribution
 * updates the existing Project, it never starts over). Correction/
 * supersession (Test H, 40 sites -> 46 sites): a changed fact id that
 * already existed before this cycle, with a different value, is a
 * correction rather than a fresh fact. mergeUpdates() already applies the
 * ledger-level supersession (the standing fact shows only the new value);
 * this just names what changed so the caller can record it in the audit
 * trail — the earlier value is never left simultaneously active.
 */
export async function computeNextTurn(
  prevFacts: WorkspaceFact[],
  prevObjectives: UnderstandingObjective[],
  prevCycle: number,
  baseRequirement: SecurityRequirementInput,
  text: string,
  now: number,
): Promise<TurnComputation> {
  const nextCycle = prevCycle + 1;
  const extracted = await extractRequirement(text, baseRequirement);
  const { facts, changed } = mergeUpdates(prevFacts, extracted.updates, nextCycle, "extract");

  const prevById = new Map(prevFacts.map((f) => [f.id, f] as const));
  const corrections: Array<{ path: string; from: unknown; to: unknown }> = [];
  for (const id of changed) {
    const before = prevById.get(id);
    const after = facts.find((f) => f.id === id);
    if (!before || !after) continue; // a genuinely new fact, not a correction
    if (String(before.value).toLowerCase() !== String(after.value).toLowerCase()) {
      corrections.push({ path: after.path, from: before.value, to: after.value });
    }
  }

  const requirement = requirementFrom(facts);
  const objectives = mergeObjectives(prevObjectives, text);
  const understanding = buildUnderstanding(facts, objectives, nextCycle, now);
  return {
    facts,
    changed,
    corrections,
    requirement,
    understanding,
    earnedQuestions: earnedFor(requirement, facts),
  };
}

/* ------------------------------------------------------------------ */
/* I/O half: persistence through the existing store and engine cores.  */
/* ------------------------------------------------------------------ */

export interface ConverseInput {
  /** The buyer's words this turn: a first sentence, an answer or a
   *  correction. */
  text: string;
  /** Omit on the first turn. Present on every later turn. */
  projectId?: string;
  manageToken?: string;
  /** Required (must be true) only on the first turn. */
  consent?: boolean;
  ownerEmail?: string;
  contactEmail?: string;
  via: "web" | "mcp";
  /** First turn only: integration testing, self-expiring project. */
  test?: boolean;
  now?: number;
}

export interface ConverseResult {
  project: ProjectDetails;
  verdict: SecurityScopeVerdict;
  understanding: Understanding;
  earnedQuestions: EarnedQuestion[];
  turn: "created" | "updated";
  corrections: Array<{ path: string; from: unknown; to: unknown }>;
}

export async function continueSecurityConversation(input: ConverseInput): Promise<ConverseResult> {
  const now = input.now ?? Date.now();
  const text = String(input.text ?? "").trim();
  if (text.length < 3) {
    throw new ConverseError("text is required: the buyer's words, a sentence or a correction.");
  }

  if (input.projectId) {
    return continueTurn(input, text, now);
  }
  return firstTurn(input, text, now);
}

async function firstTurn(input: ConverseInput, text: string, now: number): Promise<ConverseResult> {
  // Consent (Article 13): required once, up front, exactly as
  // create_security_project requires it. Subsequent turns do not re-ask —
  // they evolve a Project the buyer has already consented to Netify
  // storing, the same way answering a follow-up question on the existing
  // wizard never re-shows the submit-agreement screen.
  if (input.consent !== true) {
    throw new ConverseError(
      "Consent is required: pass consent: true only with the buyer's explicit agreement in this conversation.",
      CREATE_CONSENT_TEXT,
    );
  }

  const turn = await computeFirstTurn(text, now);

  let created;
  try {
    created = await createSecurityProject({
      requirement: turn.requirement,
      via: input.via,
      ownerEmail: input.ownerEmail,
      contactEmail: input.contactEmail,
      test: input.test,
      now,
      skipConfidenceGate: true,
      skipRfpGeneration: true,
      understanding: turn.understanding,
    });
  } catch (e) {
    throw new ConverseError((e as Error).message);
  }

  const withEvent = recordProjectEvent(created.project, {
    at: now + 3,
    actor: input.via === "mcp" ? "assistant" : "buyer",
    actor_ref: input.ownerEmail || input.contactEmail || "",
    via: input.via,
    event: "understanding.updated",
    detail: {
      cycle: 1,
      facts_captured: standing(turn.facts).length,
      completeness_score: turn.understanding.completeness.score,
      missing_sections: turn.understanding.completeness.sections_missing,
    },
  });
  const saved = await saveProject(withEvent, { engineWrite: true });

  return {
    project: saved,
    verdict: created.verdict,
    understanding: turn.understanding,
    earnedQuestions: turn.earnedQuestions,
    turn: "created",
    corrections: [],
  };
}

async function continueTurn(input: ConverseInput, text: string, now: number): Promise<ConverseResult> {
  if (!input.manageToken) {
    throw new ConverseError("manage_token is required alongside project_id.");
  }
  const project = await getProject(input.projectId!);
  if (!project || project.manage_token !== input.manageToken) {
    throw new ConverseError("Unknown project or wrong credential.");
  }
  if (project.engine !== "security_sourcing") {
    throw new ConverseError("Only Security Sourcing projects can be continued through this capability.");
  }

  // Milestone 3 correction (9 Aug 2026): Understanding is canonical
  // Project state — read from the top level, not from inside engine_data
  // (see rfp-types.ts's ProjectDetailsSchema for the architecture note).
  const prevUnderstanding = project.understanding;
  const prevFacts = (prevUnderstanding?.facts as WorkspaceFact[] | undefined) ?? [];
  const prevObjectives = prevUnderstanding?.objectives ?? [];
  const prevCycle = prevUnderstanding?.cycle ?? 0;

  const turn = await computeNextTurn(
    prevFacts,
    prevObjectives,
    prevCycle,
    project.engine_data?.requirement ?? {},
    text,
    now,
  );

  let result;
  try {
    result = await buildRescopedProject({
      project,
      requirement: turn.requirement,
      via: input.via,
      actorRef: input.ownerEmail || input.contactEmail || "",
      now,
      skipConfidenceGate: true,
      skipRfpGeneration: true,
      understanding: turn.understanding,
    });
  } catch (e) {
    throw new ConverseError((e as Error).message);
  }

  const withEvent = recordProjectEvent(result.project, {
    at: now + 3,
    actor: input.via === "mcp" ? "assistant" : "buyer",
    actor_ref: input.ownerEmail || input.contactEmail || "",
    via: input.via,
    event: "understanding.updated",
    detail: {
      cycle: turn.understanding.cycle,
      facts_changed: turn.changed.length,
      completeness_score: turn.understanding.completeness.score,
      missing_sections: turn.understanding.completeness.sections_missing,
      ...(turn.corrections.length ? { corrections: turn.corrections } : {}),
    },
  });
  const saved = await saveProject(withEvent, { engineWrite: true });

  return {
    project: saved,
    verdict: result.verdict,
    understanding: turn.understanding,
    earnedQuestions: turn.earnedQuestions,
    turn: "updated",
    corrections: turn.corrections,
  };
}
