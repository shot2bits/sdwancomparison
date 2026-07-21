/**
 * Creation-core test suite (Phase B step 2), covering Robert's review
 * targets 2 and 3 at the pure layer: creation records the verdict, digest,
 * consent wording and history correctly, and the project reaches its phase
 * only through the machine. The I/O wrapper (persistence, test-mode
 * expiry, no emails) is verified live after deploy; it contains no logic.
 */

import { buildSecurityProject, CREATE_CONSENT_TEXT } from "./create-project";
import { assessSecurityRequirement, type SecurityRequirementInput } from "./rulebook";

const F1_REQUIREMENT: SecurityRequirementInput = {
  organisation: { sector: "professional services" },
  estate: {
    users: 35, sites: 1,
    devices: { computers: 40, mobiles: 10 },
    cloud: ["m365"],
    existingSecurity: [],
  },
  drivers: ["audit"],
  constraints: { inHouseSocCapacity: "none", complianceRequirements: [] },
};

const IDS = { id: "rfp_fixture01", shareToken: "tok_fixture01", manageToken: "mtok_fixture01" };

export interface CreateTestResult { pass: number; fail: number; failures: string[] }

export async function runCreateProjectTests(): Promise<CreateTestResult> {
  const r: CreateTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const throws = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); r.fail += 1; r.failures.push(`${name}: expected throw`); } catch { r.pass += 1; }
  };

  await ok("creation records verdict, digest, consent and history correctly", async () => {
    const { project, verdict } = await buildSecurityProject({
      requirement: F1_REQUIREMENT, via: "web", ids: IDS, now: 1_700_000_000_000,
    });
    // Step 3: generation happens inside creation, so the project arrives in
    // the existing builder at drafted with the document populated.
    if (project.phase !== "drafted") throw new Error(`phase ${project.phase}, want drafted`);
    if (project.status !== "review") throw new Error("legacy status not synced to review");
    if ((project.rfp_sections?.length ?? 0) === 0) throw new Error("no generated sections");
    const events = (project.history ?? []).map((h) => h.event);
    if (events.join(",") !== "project.created,verdict.attached,rfp.generated") throw new Error(`history [${events}]`);
    if (project.consents?.[0]?.text !== CREATE_CONSENT_TEXT) throw new Error("consent wording not recorded verbatim");
    if (project.consents?.[0]?.action !== "create") throw new Error("consent action wrong");
    const stored = project.engine_data?.verdicts?.[0];
    if (!stored || stored.version !== 1) throw new Error("verdict artefact missing");
    if (stored.input_digest !== verdict.inputDigest) throw new Error("stored digest differs from verdict digest");
    // Provable identity (Article 3): recomputing from the stored requirement
    // yields the same digest the page preview and the MCP tool would produce.
    const recomputed = await assessSecurityRequirement(project.engine_data?.requirement as SecurityRequirementInput);
    if (recomputed.inputDigest !== stored.input_digest) throw new Error("recomputed digest differs: page and tool could disagree");
  });

  await ok("mcp-originated creation stamps assistant actor and mcp source", async () => {
    const { project } = await buildSecurityProject({
      requirement: F1_REQUIREMENT, via: "mcp", ids: IDS, now: 1_700_000_000_000,
    });
    if (project.source !== "mcp") throw new Error("source not mcp");
    if (project.history?.[0]?.actor !== "assistant") throw new Error("actor not assistant");
    if (project.history?.[0]?.via !== "mcp") throw new Error("via not mcp");
  });

  await ok("test flag propagates and nothing else changes shape", async () => {
    const { project } = await buildSecurityProject({
      requirement: F1_REQUIREMENT, via: "mcp", ids: IDS, test: true, now: 1_700_000_000_000,
    });
    if (project.test !== true) throw new Error("test flag missing");
    if (project.phase !== "drafted") throw new Error("test project not drafted");
  });

  await throws("low-confidence input is refused identically for every client", async () => {
    await buildSecurityProject({ requirement: { drivers: ["audit"] }, via: "web", ids: IDS });
  });

  await ok("phase is reached only through the machine: the transition event is the record", async () => {
    const { project } = await buildSecurityProject({
      requirement: F1_REQUIREMENT, via: "web", ids: IDS, now: 1_700_000_000_000,
    });
    const attach = project.history?.find((h) => h.event === "verdict.attached");
    if (!attach) throw new Error("no verdict.attached transition event: phase was not set by advanceProject");
    const gen = project.history?.find((h) => h.event === "rfp.generated");
    if (!gen) throw new Error("no rfp.generated transition event: drafted was not reached via the machine");
    if ((project.history ?? []).length !== 3) throw new Error("unexpected extra history");
  });

  return r;
}
