/**
 * Regeneration (Project Foundation Piece 2, 7 Aug 2026): rebuild the RFP
 * document from the LATEST verdict already on record, without re-scoping
 * (no new estate/requirement, no new verdict version - only a new document
 * artefact version). Previously this logic lived only inside the
 * generate_security_rfp MCP tool (mcp-security-tools.ts); the writer audit
 * flagged that as the one place where MCP owned business logic instead of
 * calling a shared domain capability (Article 17 / Agent-first principle).
 * Extracted here, mirroring rescope-project.ts's pure-core pattern, so any
 * future caller - browser, ChatGPT, an internal agent - can invoke the same
 * capability without duplicating it.
 *
 * PURE core (no I/O): like buildRescopedProject, this does not call
 * saveProject. The caller persists the returned project with
 * saveProject(result.project, { engineWrite: true }) - the same write gate
 * creation and re-scope use (Piece 2 closed the one gap where an
 * unauthorised write could otherwise introduce or change engine_data).
 *
 * No behaviour change from the code this replaces: `via` and `actorRef` are
 * threaded through exactly as the MCP tool already passed them ("mcp" /
 * "generate_security_rfp"), so today's only caller produces an identical
 * event and artefact record to before the extraction.
 */

import type { SecurityScopeVerdict } from "@/lib/security/rulebook";
import { generateRfpSections } from "@/lib/security/generate-rfp";
import { documentEdited } from "@/lib/security/rescope-project";
import { advanceProject, recordProjectEvent, projectPhase } from "@/lib/project-machine";
import type { ProjectDetails, ProjectHistoryEvent } from "@/lib/rfp-types";

export interface RegenerateInput {
  project: ProjectDetails;
  via: "web" | "mcp";
  actorRef?: string;
  /** Confirms the buyer's explicit agreement to replace edits made since
   *  the last generation. Same semantics as rescope's replaceEdits. */
  force?: boolean;
  now?: number;
}

export interface RegeneratedProject {
  project: ProjectDetails;
  verdict: SecurityScopeVerdict;
  version: number;
  regenerated: boolean; // true when this replaced an earlier artefact version
}

export function buildRegeneratedProject(input: RegenerateInput): RegeneratedProject {
  const { project } = input;
  const now = input.now ?? Date.now();

  const latest = project.engine_data?.verdicts?.slice(-1)[0];
  if (project.engine !== "security_sourcing" || !latest) {
    throw new Error("Not a Security Sourcing project: no verdict on record to generate from.");
  }
  const verdict = latest.verdict;

  const arts = project.engine_data?.artefacts ?? [];
  const edited = documentEdited(project);
  if (edited && input.force !== true) {
    throw new Error(
      "The document has been edited since the last generation; regenerating would replace those edits (earlier versions stay recoverable in the project record). Confirm the buyer's explicit agreement to proceed.",
    );
  }

  const sections = generateRfpSections(verdict);
  const version = (arts.length ? arts[arts.length - 1].version : 0) + 1;

  let p: ProjectDetails = {
    ...project,
    rfp_sections: sections,
    engine_data: {
      verdicts: project.engine_data!.verdicts,
      requirement: project.engine_data!.requirement,
      artefacts: [
        ...arts,
        { version, kind: "rfp_sections" as const, input_digest: verdict.inputDigest, created_at: now, via: input.via, sections_snapshot: sections },
      ],
    },
    // Milestone 3 (9 Aug 2026): Understanding now lives at the top level of
    // ProjectDetails, not inside engine_data (see rfp-types.ts) — the
    // `...project` spread above already carries it through unchanged.
    // (An earlier version of this fix patched engine_data directly, from
    // when Understanding was still nested there; no longer needed now that
    // it sits alongside engine_data instead of inside it.)
  };

  const event: ProjectHistoryEvent = {
    at: now,
    actor: input.via === "mcp" ? "assistant" : "buyer",
    actor_ref: input.actorRef ?? "",
    via: input.via,
    event: "rfp.generated",
    detail: {
      artefact_version: version,
      regenerated: arts.length > 0,
      forced: input.force === true,
      verdict_digest: verdict.inputDigest,
      open_gaps: verdict.gaps.length,
    },
  };

  // At drafted, regeneration is a recorded event (v n+1, no phase change); a
  // pre-generation record advances scoped -> drafted. After publication the
  // machine refuses: published documents do not silently change under
  // suppliers (one truth, Article 17) - identical to the pre-extraction code.
  p = projectPhase(p) === "drafted" ? recordProjectEvent(p, event) : advanceProject(p, event);

  return { project: p, verdict, version, regenerated: arts.length > 0 };
}
