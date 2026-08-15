/**
 * Re-scoping (Phase D4): the buyer's estate changes; the record accretes,
 * never rewrites. A re-scope attaches verdict v(n+1), regenerates the
 * document as artefact v(m+1), and leaves every earlier version in the
 * record. The confirmation the buyer agrees to states exactly that, with
 * the real version numbers: confirmationSentence() is exported so the
 * page, the consent wording and the fixtures all read the same string
 * (spec D4 acceptance 2: the sentence matches what actually happened).
 *
 * PURE core (no I/O): the route and the MCP tool both call
 * buildRescopedProject and persist through saveProject, so web and agent
 * re-scopes cannot diverge (Article 17). Refusals are thrown with the
 * same wording for every client: low confidence returns the gap
 * questions; an edited document requires the explicit replace-edits
 * consent (the buyer's work is never silently discarded; earlier
 * versions stay recoverable either way).
 */

import {
  assessSecurityRequirement,
  type SecurityRequirementInput,
  type SecurityScopeVerdict,
} from "@/lib/security/rulebook";
import { generateRfpSections } from "@/lib/security/generate-rfp";
import { advanceProject, recordProjectEvent, projectPhase } from "@/lib/project-machine";
import type { ProjectDetails } from "@/lib/rfp-types";
import type { Understanding } from "@/lib/workspace/understanding";
import { mergeSourceLedger, type SourceLedgerEntry } from "@/lib/workspace/source-ledger";
import { mergeDecisionLedger, type DecisionLedgerEntry } from "@/lib/workspace/decision-ledger";

/** True when the live document differs from the latest generated snapshot:
 *  the same rule the generate_security_rfp tool applies. */
export function documentEdited(p: ProjectDetails): boolean {
  const arts = p.engine_data?.artefacts ?? [];
  if (arts.length === 0) return false;
  return JSON.stringify(p.rfp_sections) !== JSON.stringify(arts[arts.length - 1].sections_snapshot);
}

export function nextVersions(p: ProjectDetails): { verdict: number; artefact: number } {
  const v = (p.engine_data?.verdicts ?? []).slice(-1)[0]?.version ?? 0;
  const a = (p.engine_data?.artefacts ?? []).slice(-1)[0]?.version ?? 0;
  return { verdict: v + 1, artefact: a + 1 };
}

/** Robert's sentence, with the real numbers, shown before consent and
 *  recorded verbatim inside it. */
export function confirmationSentence(p: ProjectDetails): string {
  const n = nextVersions(p);
  return `This will attach Verdict v${n.verdict} and regenerate the RFP as version ${n.artefact}. Version ${n.verdict - 1} and version ${n.artefact - 1} stay in the project record.`;
}

export function rescopeConsentText(p: ProjectDetails): string {
  return `Re-scope this project: ${confirmationSentence(p)}`;
}

export function replaceEditsConsentText(p: ProjectDetails): string {
  return `${rescopeConsentText(p)} I understand my edits to the current draft will be replaced; earlier versions remain recoverable in the record.`;
}

export interface RescopeInput {
  project: ProjectDetails;
  requirement: SecurityRequirementInput;
  via: "web" | "mcp";
  actorRef?: string;
  replaceEdits?: boolean;
  now?: number;
  /** Milestone 3 (Gap B/D rulings, 9 Aug 2026): the same twin-gate bypasses
   *  create-project.ts takes, for the conversational capability's
   *  subsequent-turn updates only. Absent/false for every existing caller
   *  (the existing rescope_security_project MCP tool), which is byte-for-
   *  byte unchanged. See create-project.ts's CreateSecurityProjectInput for
   *  the full rationale. */
  skipConfidenceGate?: boolean;
  skipRfpGeneration?: boolean;
  /** Milestone 3 (Gap A/C): the updated Understanding this turn produced,
   *  stored at the Project's top level (see rfp-types.ts), not inside
   *  engine_data. Omitted (undefined) means "leave the Project's existing
   *  Understanding exactly as it was" — so an existing rescope call that
   *  knows nothing about Understanding can never wipe it. */
  understanding?: Understanding;
  /** Fourth amendment (13 Aug 2026), gap 2: this is the ONLY route a
   *  Security Sourcing project's Save (after the first) or pre-publish
   *  refresh ever takes — round 4 threaded source turns into
   *  create-project.ts's first save but never into re-scope, so wording
   *  typed after that first save was silently never persisted. Merged
   *  idempotently by stable turn id (mergeSourceLedger) into the project's
   *  existing source_ledger below; omitted/empty is a no-op, so an existing
   *  caller that knows nothing about turns (the rescope_security_project
   *  MCP tool) leaves the ledger exactly as it was, same as `understanding`
   *  above. */
  sourceTurns?: SourceLedgerEntry[];
  /** Living Procurement UK Decision-Maker Blueprint, correction pass
   *  (Robert, 15 Aug 2026), defects 3 and 4: this route is the ONLY save
   *  path a Security Sourcing project takes after its first save, exactly
   *  like sourceTurns above -- so this is what makes a NextQuestion answer
   *  clicked after the first save durable too. Merged idempotently by
   *  stable entry id (mergeDecisionLedger) into the project's existing
   *  decision_ledger below; omitted/empty is a no-op. */
  decisionTurns?: DecisionLedgerEntry[];
}

export interface RescopedProject {
  project: ProjectDetails;
  verdict: SecurityScopeVerdict;
}

export async function buildRescopedProject(input: RescopeInput): Promise<RescopedProject> {
  const { project } = input;
  const now = input.now ?? Date.now();
  if (project.engine !== "security_sourcing") {
    throw new Error("Only Security Sourcing projects can be re-scoped through this engine.");
  }

  const verdict = await assessSecurityRequirement(input.requirement);
  // One behaviour for every client (Article 17), same as creation: a
  // re-scope is not recorded on guesswork. Milestone 3 (Gap B): the
  // conversational capability's subsequent turns opt out with
  // skipConfidenceGate; every existing caller leaves it unset.
  if (verdict.confidence === "low" && !input.skipConfidenceGate) {
    throw new Error(
      "Confidence is low: answer the assessment's gap questions before re-scoping. " +
        verdict.gaps.map((g) => g.question).join(" "),
    );
  }

  // Milestone 3 (Gap D): when the conversational capability skips document
  // generation, there is no document to protect from being overwritten, so
  // the edited-document check (and its consent requirement) does not apply.
  const edited = input.skipRfpGeneration ? false : documentEdited(project);
  if (edited && input.replaceEdits !== true) {
    throw new Error(
      "The document has been edited since the last generation; re-scoping regenerates it and would replace those edits. Confirm the replace-edits consent to proceed (earlier versions stay recoverable in the record).",
    );
  }

  const versions = nextVersions(project);
  const actorRef = input.actorRef ?? "";
  const consentText = edited ? replaceEditsConsentText(project) : rescopeConsentText(project);

  let p: ProjectDetails = {
    ...project,
    // Fourth amendment, gap 2 fix: accretes exactly like every other part
    // of this record already does — never reorders, edits or removes an
    // existing entry, and a repeat of the same batch (a Save with nothing
    // newly typed) is a no-op by construction (mergeSourceLedger's own
    // idempotency), so calling this on every Save/refresh, not just once,
    // cannot duplicate anything.
    source_ledger: mergeSourceLedger(project.source_ledger ?? [], input.sourceTurns ?? []),
    // Defects 3/4: the same accretion-only merge, for the same reason,
    // into the decision ledger.
    decision_ledger: mergeDecisionLedger(project.decision_ledger ?? [], input.decisionTurns ?? []),
    consents: [
      ...(project.consents ?? []),
      {
        at: now,
        action: edited ? "rescope_replace_edits" : "rescope",
        granted_by: actorRef || "anonymous",
        via: input.via,
        text: consentText, // the wording shown, recorded verbatim (Article 13)
      },
    ],
  };

  p = recordProjectEvent(p, {
    at: now,
    actor: input.via === "mcp" ? "assistant" : "buyer",
    actor_ref: actorRef,
    via: input.via,
    event: "requirement.updated",
    detail: { rescope: true, verdict_version: versions.verdict },
    consent: true,
  });

  p = {
    ...p,
    engine_data: {
      verdicts: [
        ...(p.engine_data?.verdicts ?? []),
        { version: versions.verdict, verdict, input_digest: verdict.inputDigest, created_at: now, via: input.via },
      ],
      requirement: input.requirement,
      artefacts: p.engine_data?.artefacts ?? [],
    },
    // Milestone 3 (9 Aug 2026, corrected same-day after an architecture
    // check): Understanding is canonical Project state, set at the SAME
    // level as engine_data, never nested inside it. Explicit
    // input.understanding wins (a conversational turn updating it);
    // otherwise the `...p` spread above already carries the project's
    // existing top-level Understanding through unchanged, so a caller
    // that knows nothing about it (every existing rescope caller) can
    // never wipe it.
    ...(input.understanding ? { understanding: input.understanding } : {}),
  };

  p = recordProjectEvent(p, {
    at: now + 1,
    actor: input.via === "mcp" ? "assistant" : "buyer",
    actor_ref: actorRef,
    via: input.via,
    event: "verdict.attached",
    detail: { version: versions.verdict, rulebookVersion: verdict.rulebookVersion, confidence: verdict.confidence },
  });

  // Milestone 3 (Gap D): the conversational capability's subsequent turns
  // skip document (re)generation entirely — the project's phase and
  // rfp_sections are left exactly as they were (for a project this
  // capability created, that means still "scoped", still no document).
  // Every existing caller leaves skipRfpGeneration unset, so this block
  // runs for them exactly as before.
  if (!input.skipRfpGeneration) {
    const sections = generateRfpSections(verdict);
    p = {
      ...p,
      rfp_sections: sections,
      engine_data: {
        ...p.engine_data!,
        artefacts: [
          ...(p.engine_data!.artefacts ?? []),
          { version: versions.artefact, kind: "rfp_sections" as const, input_digest: verdict.inputDigest, created_at: now + 1, via: input.via, sections_snapshot: sections },
        ],
      },
    };

    const genEvent = {
      at: now + 2,
      actor: "system" as const,
      actor_ref: "rescope",
      via: input.via,
      event: "rfp.generated",
      detail: {
        artefact_version: versions.artefact,
        rescope: true,
        replaced_edits: edited,
        verdict_digest: verdict.inputDigest,
        open_gaps: verdict.gaps.length,
      },
    };
    p = projectPhase(p) === "drafted" ? recordProjectEvent(p, genEvent) : advanceProject(p, genEvent);
  }

  return { project: p, verdict };
}
