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
import type { ProjectDetails } from "@/lib/rfp-types";
import type { SecurityScopeVerdict } from "@/lib/security/rulebook";

const TEST_TTL_SECONDS = 2 * 60 * 60;

export interface CreatedSecurityProject {
  project: ProjectDetails;
  verdict: SecurityScopeVerdict;
  builderPath: string; // in-app path; callers prefix the site URL
}

export async function createSecurityProject(
  input: Omit<CreateSecurityProjectInput, "ids">,
): Promise<CreatedSecurityProject> {
  const ids = { id: newId("rfp"), shareToken: newId("tok"), manageToken: newId("mtok") };
  // Pins must be real marketplace vendors; anything else is dropped, cap 5
  // (the same rule the wizard's create route applies).
  const valid = new Set(getAllVendorSlugs());
  const preferredVendors = (input.preferredVendors ?? []).filter((s) => valid.has(s)).slice(0, 5);
  const { project, verdict } = await buildSecurityProject({ ...input, ids, preferredVendors });
  const saved = await saveProject(project);

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
