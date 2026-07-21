/**
 * D5 acceptance suite: approval lite. The gate blocks only a declined
 * approval without the explicit confirmation; the approval events are
 * legal exactly where the spec says; and the engine publish path (the
 * pilot bridge) reaches published through the machine with its guards.
 */

import { publishDecisionGate, declinedConfirmationText, approveConsentText, requestApprovalConsentText, PUBLISH_DESPITE_DECLINED_ACTION, ENGINE_PUBLISH_CONSENT_TEXT } from "@/lib/project-approvals";
import { advanceProject, recordProjectEvent, openSecurityGaps } from "@/lib/project-machine";
import { buildSecurityProject } from "@/lib/security/create-project";
import { SECURITY_FIXTURES } from "@/lib/security/fixtures";
import type { ProjectDetails, ProjectSignoff } from "@/lib/rfp-types";

export interface ApprovalTestResult { pass: number; fail: number; failures: string[] }

const IDS = { id: "rfp_apprfix01", shareToken: "tok_apprfix01", manageToken: "mtok_apprfix01" };
const NOW = 1_700_000_000_000;

const signoff = (decision?: "approved" | "declined"): ProjectSignoff => ({
  token: "aptok_x", name: "Sam Patel", role: "CISO", email: "sam@example.com", requested_at: NOW,
  ...(decision ? { decided_at: NOW + 1, decision } : {}),
});

async function f2Drafted(): Promise<ProjectDetails> {
  const fx = SECURITY_FIXTURES.find((x) => x.id === "F2");
  if (!fx) throw new Error("F2 missing");
  const { project } = await buildSecurityProject({ requirement: fx.input, via: "web", ids: IDS, now: NOW });
  // Clear any gaps exactly as acceptance records them, so publication
  // exercises the approval gate rather than the gap gate.
  const gaps = openSecurityGaps(project);
  return {
    ...project,
    consents: [
      ...(project.consents ?? []),
      ...gaps.map((g) => ({ at: NOW + 5, action: `accept_gap:${g.field}`, granted_by: "b@x.com", via: "web" as const, text: `I accept proceeding without answering: "${g.question}"` })),
    ],
  };
}

export async function runApprovalTests(): Promise<ApprovalTestResult> {
  const r: ApprovalTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };

  await ok("gate: absent and pending approvals never block; declined blocks until confirmed", () => {
    if (publishDecisionGate([], []).blocked) throw new Error("no approvals blocked publication");
    if (publishDecisionGate([signoff()], []).blocked) throw new Error("a pending approval blocked publication");
    const declined = publishDecisionGate([signoff("declined")], []);
    if (!declined.blocked) throw new Error("declined approval did not require confirmation");
    if (!declined.confirmationText.includes("CISO (Sam Patel)")) throw new Error("confirmation does not name the decliner");
    if (!declined.confirmationText.includes("publish anyway")) throw new Error("confirmation does not state the choice");
    const confirmed = publishDecisionGate([signoff("declined")], [{ at: NOW, action: PUBLISH_DESPITE_DECLINED_ACTION, granted_by: "b@x.com", via: "web", text: declinedConfirmationText([signoff("declined")]) }]);
    if (confirmed.blocked) throw new Error("recorded confirmation did not open the gate");
    if (publishDecisionGate([signoff("approved")], []).blocked) throw new Error("an approval blocked publication");
  });

  await ok("approval events are legal at drafted and refused after publication", async () => {
    let p = await f2Drafted();
    p = recordProjectEvent(p, { at: NOW + 10, actor: "buyer", actor_ref: "b@x.com", via: "web", event: "approval.requested", detail: { role: "CISO" }, consent: true });
    p = recordProjectEvent(p, { at: NOW + 11, actor: "buyer", actor_ref: "sam@example.com", via: "web", event: "approval.declined", detail: { role: "CISO" } });
    p = recordProjectEvent(p, { at: NOW + 12, actor: "buyer", actor_ref: "sam@example.com", via: "web", event: "publish.approved", detail: { role: "CISO" }, consent: true });
    // Publish, then the same events must be refused.
    p = { ...p, consents: [...(p.consents ?? []), { at: NOW + 13, action: "publish", granted_by: "b@x.com", via: "web" as const, text: ENGINE_PUBLISH_CONSENT_TEXT }] };
    p = advanceProject(p, { at: NOW + 14, actor: "buyer", actor_ref: "b@x.com", via: "web", event: "publish.live", detail: {} });
    try {
      recordProjectEvent(p, { at: NOW + 15, actor: "buyer", actor_ref: "b@x.com", via: "web", event: "approval.requested", detail: {} });
      throw new Error("approval.requested allowed after publication");
    } catch (e) {
      if (!(e as Error).message.includes("not legal") && !(e as Error).message.includes("No legal")) {
        if ((e as Error).message === "approval.requested allowed after publication") throw e;
      }
    }
  });

  await ok("the engine publish path reaches published through the machine", async () => {
    let p = await f2Drafted();
    if ((p.consents ?? []).some((c) => c.action === "publish")) throw new Error("precondition: publish consent already present");
    p = { ...p, consents: [...(p.consents ?? []), { at: NOW + 20, action: "publish", granted_by: "b@x.com", via: "web" as const, text: ENGINE_PUBLISH_CONSENT_TEXT }] };
    p = recordProjectEvent(p, { at: NOW + 20, actor: "buyer", actor_ref: "b@x.com", via: "web", event: "publish.consented", detail: {}, consent: true });
    p = advanceProject(p, { at: NOW + 21, actor: "buyer", actor_ref: "b@x.com", via: "web", event: "publish.live", detail: { invited: 8 } });
    if (p.phase !== "published") throw new Error(`phase ${p.phase}`);
    if (p.status !== "published") throw new Error(`legacy status ${p.status} not synced`);
    const events = (p.history ?? []).map((h) => h.event);
    if (!events.includes("publish.consented") || events[events.length - 1] !== "publish.live") throw new Error(`history tail wrong: ${events.slice(-2)}`);
  });

  await ok("wording: consents carry role, name and the recorded choice", () => {
    if (!approveConsentText("CISO", "Sam Patel").includes("As CISO, I (Sam Patel)")) throw new Error("approve wording wrong");
    if (!requestApprovalConsentText("Legal", "l@x.com").includes("l@x.com (Legal)")) throw new Error("request wording wrong");
    if (!declinedConfirmationText([signoff("declined")]).includes("permanent project record")) throw new Error("declination wording wrong");
  });

  return r;
}
