/**
 * Procurement health (Phase D, Robert's amendment, 21 July 2026): the one
 * thing a busy buyer looks at instead of interpreting six widgets.
 *
 * Refined after the D1 review (Robert): health expresses the CURRENT
 * PROJECT STATE through the whole lifecycle, not only publication
 * readiness. Action required, Ready for publication, Awaiting supplier
 * responses, Evaluating bids, Procurement complete.
 *
 * PURE function of the record; never a stored field. One truth for the
 * Project Home, My Projects and any future surface (Article 17): health
 * derives from projectPhase(), openSecurityGaps() (the same helper the
 * publish guard uses, so the tile and the gate can never disagree), the
 * latest verdict's confidence, approval state and response count.
 */

import type { ProjectDetails } from "@/lib/rfp-types";
import { projectPhase, openSecurityGaps } from "@/lib/project-machine";

export type HealthTone = "green" | "amber" | "red" | "yellow" | "blue" | "purple" | "neutral";

export interface ProjectHealth {
  tone: HealthTone;
  label: string;
  detail: string;
}

export interface HealthContext {
  responseCount?: number;
  /** D5 wires this from the approvals sub-collection; absent until then. */
  approvals?: Array<{ decision?: "approved" | "declined" }>;
}

export function projectHealth(p: ProjectDetails, ctx: HealthContext = {}): ProjectHealth {
  const phase = projectPhase(p);
  const responses = ctx.responseCount ?? 0;

  // Terminal and late phases first: they say everything.
  if (phase === "closed") return { tone: "neutral", label: "Closed", detail: "This project was closed; the record stays readable." };
  if (phase === "complete") return { tone: "green", label: "Procurement complete", detail: "The full story is in the record." };
  if (phase === "transacting") return { tone: "green", label: "Transacting", detail: "Award accepted; the engagement is underway." };
  if (phase === "awarded") return { tone: "green", label: "Awarded", detail: "A vendor has been selected; awaiting acceptance." };
  if (phase === "evaluation") return { tone: "purple", label: "Evaluating bids", detail: `${responses} response${responses === 1 ? "" : "s"} to compare.` };
  if (phase === "qa") return { tone: "yellow", label: "Clarifications open", detail: "Vendors are asking questions; answers go to everyone." };
  if (phase === "published") {
    return responses > 0
      ? { tone: "green", label: "Responses arriving", detail: `${responses} response${responses === 1 ? "" : "s"} so far.` }
      : { tone: "blue", label: "Awaiting vendor responses", detail: "Published; invited vendors have the response link." };
  }

  // Pre-publication: the engine states that need the buyer's attention.
  if (p.engine === "security_sourcing") {
    const latest = (p.engine_data?.verdicts ?? []).slice(-1)[0]?.verdict as { confidence?: string } | undefined;
    if (latest?.confidence === "low") {
      return { tone: "red", label: "Re-scope recommended", detail: "The latest assessment could not reach a confident verdict. Re-scope with more detail." };
    }
    const gaps = openSecurityGaps(p);
    if (gaps.length > 0 && (phase === "drafted" || phase === "drafting" || phase === "scoped")) {
      return { tone: "amber", label: "Action required", detail: `${gaps.length} scoping gap${gaps.length === 1 ? "" : "s"} to answer or accept before publication.` };
    }
  }

  // Approval state (D5): declined forces an intentional decision; pending waits.
  const approvals = ctx.approvals ?? [];
  if (approvals.some((a) => a.decision === "declined")) {
    return { tone: "amber", label: "Approval declined", detail: "Publishing now requires an explicit decision, recorded on the project." };
  }
  if (approvals.some((a) => !a.decision)) {
    return { tone: "yellow", label: "Awaiting approval", detail: "An approval request is outstanding." };
  }

  if (phase === "drafted") return { tone: "green", label: "Ready for publication", detail: "The document is drafted and every gate is clear." };
  if (phase === "drafting") return { tone: "yellow", label: "Drafting", detail: "The document is being edited." };
  if (phase === "scoped") return { tone: "yellow", label: "Scoped", detail: "The verdict is attached; the document comes next." };
  return { tone: "yellow", label: "Scoping", detail: "The requirement is being assessed." };
}
