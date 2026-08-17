/**
 * Netify Security Sourcing: the I/O half of Project creation (step 2).
 * Persists what buildSecurityProject assembled, through the single write
 * gate. Sends no emails in any mode (the existing wizard and magic-link
 * flows own all buyer email). TEST MODE leaves no durable side effects:
 * both keys expire in two hours and the buyer index is never touched.
 */

import { saveProject, newId, indexRfpForBuyer, kvRaw } from "@/lib/rfp-store";
import { getAllVendorSlugs } from "@/lib/vendors";
import { buildSecurityProject, type CreateSecurityProjectInput } from "@/lib/security/create-project";
import { buildEnvelopeUpdate } from "@/lib/workspace/envelope";
import type { ProjectDetails } from "@/lib/rfp-types";
import type { SecurityScopeVerdict } from "@/lib/security/rulebook";

const TEST_TTL_SECONDS = 2 * 60 * 60;

export interface CreatedSecurityProject {
  project: ProjectDetails;
  verdict: SecurityScopeVerdict;
  builderPath: string; // in-app path; callers prefix the site URL
}

export type CreateEnvelopeParticipation =
  | { ok: true; error?: undefined }
  | { ok: false; status: 409 | 422; error: string };

/**
 * Overloaded deliberately (17 Aug 2026): every EXISTING caller (the
 * create_security_project MCP tool via mcp-security-tools.ts, the
 * conversational entry point via converse-project.ts) calls this with a
 * single argument and has always destructured `{project, verdict,
 * builderPath}` directly -- neither is touched by, or aware of, this pass
 * (per this pass's own explicit scope boundary: "do not start MCP action
 * execution... during this pass"). The single-argument overload keeps
 * their return type EXACTLY `CreatedSecurityProject`, unchanged; only a
 * caller that explicitly opts in with a second argument (the web route,
 * updated this pass) sees the wider union that can carry a rejection.
 */
export async function createSecurityProject(input: Omit<CreateSecurityProjectInput, "ids">): Promise<CreatedSecurityProject>;
export async function createSecurityProject(
  input: Omit<CreateSecurityProjectInput, "ids">,
  envelopeBody: Record<string, unknown> | undefined,
  coveredSections?: string[],
): Promise<CreatedSecurityProject | { rejected: CreateEnvelopeParticipation & { ok: false } }>;
export async function createSecurityProject(
  input: Omit<CreateSecurityProjectInput, "ids">,
  /**
   * Full-unification CLOSURE pass (17 Aug 2026): the raw request body's
   * canonical-envelope fields (facts/receipts/instrument/compiled_document),
   * verified/recomputed here -- AFTER `buildSecurityProject()` (which stays
   * pure and unaware of the envelope) has built `project.source_ledger`/
   * `decision_ledger`, BEFORE the single `saveProject()` write gate below --
   * so the FIRST save a Security Sourcing project ever takes can already
   * carry a genuine canonical envelope, not just the wizard's. `undefined`
   * (the caller sent no `facts`) is the ordinary, unaffected case.
   */
  envelopeBody?: Record<string, unknown>,
  coveredSections?: string[],
): Promise<CreatedSecurityProject | { rejected: CreateEnvelopeParticipation & { ok: false } }> {
  const ids = { id: newId("rfp"), shareToken: newId("tok"), manageToken: newId("mtok") };
  // Pins must be real marketplace vendors; anything else is dropped, cap 5
  // (the same rule the wizard's create route applies).
  const valid = new Set(getAllVendorSlugs());
  const preferredVendors = (input.preferredVendors ?? []).filter((s) => valid.has(s)).slice(0, 5);
  const { project, verdict } = await buildSecurityProject({ ...input, ids, preferredVendors });

  let projectToSave = project;
  if (envelopeBody && envelopeBody.facts !== undefined) {
    const outcome = await buildEnvelopeUpdate({
      existing: null,
      body: envelopeBody,
      mergedSourceLedger: project.source_ledger,
      mergedDecisionLedger: project.decision_ledger,
      coveredSections: coveredSections ?? [],
      savedBy: input.ownerEmail || "unauthenticated",
    });
    if (outcome.participates && !outcome.ok) return { rejected: outcome };
    if (outcome.participates && outcome.ok) {
      projectToSave = {
        ...project,
        facts: outcome.facts,
        receipts: outcome.receipts,
        procurement_document: outcome.procurement_document,
        envelope_revision: outcome.envelope_revision,
        envelope: outcome.envelope,
      };
    }
  }
  const saved = await saveProject(projectToSave);

  if (saved.test) {
    // Two-hour self-destruct; no index, no moderation, no telemetry funnels.
    await kvRaw(["EXPIRE", `rfp:${saved.id}`, TEST_TTL_SECONDS]).catch(() => {});
    await kvRaw(["EXPIRE", `rfp:token:${saved.share_token}`, TEST_TTL_SECONDS]).catch(() => {});
  } else if (saved.owner_email) {
    try {
      await indexRfpForBuyer(saved.owner_email, saved.id);
    } catch {
      /* best effort, matching the existing creation route */
    }
  }

  return { project: saved, verdict, builderPath: `/rfp-builder/${saved.id}` };
}
