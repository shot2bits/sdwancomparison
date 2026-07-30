/**
 * Approval lite (Phase D5): request, decide, record. No comments, no
 * assignments, no roles admin; anything richer waits for a pilot buyer
 * to ask (Article 23, applied to the roadmap).
 *
 * Code entities are named SIGNOFF (rfp:{id}:approvals and listApprovals
 * already belong to the agent proposal queue from deal room slice 1);
 * every buyer-facing word remains "approval".
 *
 * PURE helpers shared by the routes, the publish flow, the pages and the
 * fixtures, so the wording shown, the wording recorded and the gate
 * applied can never disagree (Articles 13 and 17).
 *
 * Robert's amendment, encoded: a declined approval does not veto, it
 * forces an INTENTIONAL decision. Publishing after a declination
 * requires a second explicit confirmation whose wording becomes part of
 * the permanent record; the deterrent is the Story, not a lock.
 */

import type { ProjectSignoff, ProjectConsent } from "@/lib/rfp-types";

export function requestApprovalConsentText(role: string, email: string): string {
  return `Request approval before publishing: send one email to ${email} (${role}) with a private link to read this RFP and approve or decline. Their decision is recorded on the project.`;
}

export function approveConsentText(role: string, name: string): string {
  return `As ${role}, I (${name}) have read this RFP and approve its publication. This approval is recorded on the project.`;
}

export function declinedConfirmationText(signoffs: ProjectSignoff[]): string {
  const declined = signoffs.filter((a) => a.decision === "declined");
  const who = declined.map((a) => `${a.role} (${a.name})`).join(" and ") || "An approver";
  return `${who} declined approval. You are choosing to publish anyway. This decision will become part of the permanent project record.`;
}

export const PUBLISH_DESPITE_DECLINED_ACTION = "publish_despite_declined_approval";

/** The engine publish consent (Article 13), recorded verbatim when an
 *  engine project publishes through the machine. */
export const ENGINE_PUBLISH_CONSENT_TEXT =
  "Publish this RFP to the Netify marketplace and invite the matched vendors. Responses arrive side by side; pricing stays private to me; no further vendor is contacted without my action.";

/**
 * The publication decision gate. Blocked only when an approval was
 * declined AND the buyer has not yet recorded the explicit
 * publish-despite-declination consent. Never blocked by absent or
 * pending approvals: requesting approval is optional, and a lock is not
 * the deterrent, the record is.
 */
export function publishDecisionGate(
  signoffs: ProjectSignoff[],
  consents: ProjectConsent[] | undefined,
): { blocked: boolean; confirmationText: string } {
  const declined = signoffs.some((a) => a.decision === "declined");
  if (!declined) return { blocked: false, confirmationText: "" };
  const acknowledged = (consents ?? []).some((c) => c.action === PUBLISH_DESPITE_DECLINED_ACTION);
  return acknowledged
    ? { blocked: false, confirmationText: "" }
    : { blocked: true, confirmationText: declinedConfirmationText(signoffs) };
}

/** Health context adapter: the ProjectHealth approvals field, fed from
 *  signoffs (same concept, collision-free name). */
export function signoffHealthContext(signoffs: ProjectSignoff[]): Array<{ decision?: "approved" | "declined" }> {
  return signoffs.map((a) => (a.decision ? { decision: a.decision } : {}));
}
