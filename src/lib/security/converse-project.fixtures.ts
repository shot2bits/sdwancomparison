/**
 * Milestone 3 — FIRST CUT test suite (Robert's build prompt, 9 Aug 2026),
 * covering test matrix A-L plus the implementation's own additional cases
 * (M-O). Tests the PURE layer directly — computeFirstTurn/computeNextTurn
 * (extraction + ledger + completeness, no I/O) and buildSecurityProject/
 * buildRescopedProject/buildRegeneratedProject called directly with the
 * new flags (also pure) — exactly the same split, and the same reason for
 * it, as create-project.fixtures.ts and rescope-project.fixtures.ts: "The
 * I/O wrapper (persistence, test-mode expiry, no emails) is verified live
 * after deploy; it contains no logic." continueSecurityConversation's own
 * I/O half (getProject/saveProject/createSecurityProject) requires a real
 * KV store this sandbox does not have configured, so it is exercised the
 * same way every other engine capability's I/O wrapper already is in this
 * codebase: live, during the (not-yet-run, pending approval) preview
 * acceptance pass — not here.
 */

import { computeFirstTurn, computeNextTurn } from "./converse-project";
import { buildSecurityProject } from "./create-project";
import { buildRescopedProject } from "./rescope-project";
import { buildRegeneratedProject } from "./regenerate-project";
import { recordProjectEvent } from "@/lib/project-machine";

export interface ConverseTestResult { pass: number; fail: number; failures: string[] }

const IDS = { id: "rfp_convfix01", shareToken: "tok_convfix01", manageToken: "mtok_convfix01" };
const NOW = 1_700_000_000_000;

export async function runConverseProjectTests(): Promise<ConverseTestResult> {
  const r: ConverseTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const throws = async (name: string, fn: () => Promise<void>, includes?: string) => {
    try { await fn(); r.fail += 1; r.failures.push(`${name}: expected throw`); }
    catch (e) {
      if (!includes || (e as Error).message.includes(includes)) r.pass += 1;
      else { r.fail += 1; r.failures.push(`${name}: wrong message: ${(e as Error).message}`); }
    }
  };
  type FactLike = { path: string; value: unknown; provenance: string; quote?: string; reason?: string };
  const has = (facts: FactLike[], path: string) => facts.some((f) => f.path === path);
  const factsOn = (facts: FactLike[], path: string) => facts.filter((f) => f.path === path);

  /* ---- A: rich first message -> Project created immediately, every
     supported fact persisted with provenance ---- */
  await ok("A: rich first message extracts every supported field with provenance", async () => {
    const text =
      "We have 300 users across 4 sites in the UK. This is prompted by an audit; " +
      "our current provider is Fortinet, and we are considering Cato Networks for this. " +
      "Manchester HQ is business-critical. We need ISO 27001 certification. " +
      "We also need threat protection for our remote workers.";
    const turn = await computeFirstTurn(text, NOW);
    for (const path of [
      "estate.users", "estate.sites", "organisation.regions", "drivers",
      "estate.existingProviders", "procurement.vendorsUnderConsideration",
      "estate.namedLocations", "estate.locationCriticality",
      "constraints.complianceRequirements", "requirements.bespoke",
    ]) {
      if (!has(turn.facts, path)) throw new Error(`missing fact for ${path}`);
    }
    for (const f of turn.facts) {
      if (f.provenance !== "stated" && f.provenance !== "inferred") throw new Error(`fact ${f.path} has no valid provenance`);
      if (f.provenance === "stated" && !f.quote) throw new Error(`stated fact ${f.path} has no quote`);
    }
    const provider = factsOn(turn.facts, "estate.existingProviders")[0];
    if (!String(provider.value).includes("Fortinet")) throw new Error("provider value lost Fortinet");
  });

  await ok("A: those facts persist onto the Project unchanged, at phase scoped, no document", async () => {
    const text = "We have 300 users across 4 sites in the UK. This is prompted by an audit.";
    const turn = await computeFirstTurn(text, NOW);
    const { project } = await buildSecurityProject({
      requirement: turn.requirement, via: "mcp", ids: IDS, now: NOW,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: turn.understanding,
    });
    if (project.phase !== "scoped") throw new Error(`phase ${project.phase}, want scoped`);
    if ((project.rfp_sections?.length ?? 0) !== 0) throw new Error("rfp_sections should stay empty");
    if ((project.engine_data?.artefacts?.length ?? 0) !== 0) throw new Error("artefacts should stay empty");
    const stored = project.understanding;
    if (!stored) throw new Error("understanding not stored on the Project");
    if (stored.facts.length !== turn.facts.length) throw new Error("stored fact count differs from computed");
    if (!has(stored.facts, "estate.users")) throw new Error("a captured fact went missing on the Project itself");
    // Robert's final architecture ruling (9 Aug 2026): Understanding is
    // Project-owned, not engine-owned — assert the negative directly rather
    // than relying only on ProjectEngineDataSchema's .strict() to reject it.
    if (project.engine_data && "understanding" in project.engine_data) {
      throw new Error("understanding leaked into engine_data — it must live only at the Project's top level");
    }
  });

  /* ---- B: sparse first message -> Project still created; completeness
     low; missing information and earned questions returned ---- */
  await ok("B: sparse message still yields a created Project with low completeness", async () => {
    const turn = await computeFirstTurn("We need SASE.", NOW);
    if (turn.understanding.completeness.score >= 0.5) throw new Error(`completeness ${turn.understanding.completeness.score} not sparse`);
    if (turn.understanding.completeness.missing_information.length === 0) throw new Error("missing_information empty for a sparse message");

    const { project, verdict } = await buildSecurityProject({
      requirement: turn.requirement, via: "mcp", ids: IDS, now: NOW,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: turn.understanding,
    });
    if (project.phase !== "scoped") throw new Error("sparse project did not reach scoped");
    // The verdict itself is untouched by the bypass: it is whatever the
    // rulebook honestly computed (very likely low here), never upgraded.
    if (!["low", "medium", "high"].includes(verdict.confidence)) throw new Error("verdict shape broken");
  });

  await throws("B: the SAME low-confidence input is refused for every OTHER caller (gate unchanged)", async () => {
    const turn = await computeFirstTurn("We need SASE.", NOW);
    await buildSecurityProject({ requirement: turn.requirement, via: "web", ids: IDS, now: NOW });
  }, "Confidence is low");

  /* ---- C: named incumbent survives ---- */
  await ok("C: named incumbent provider persists with provenance", async () => {
    const turn = await computeFirstTurn("We have 40 sites; our current provider is Fortinet.", NOW);
    const f = factsOn(turn.facts, "estate.existingProviders")[0];
    if (!f) throw new Error("existingProviders fact missing");
    if (f.provenance !== "stated") throw new Error("incumbent should be stated, not inferred");
  });

  /* ---- D: vendor under consideration survives without being treated as
     selected, and never reaches the rulebook's own contract ---- */
  await ok("D: vendor under consideration is captured but never enters the rulebook requirement", async () => {
    const turn = await computeFirstTurn("We are considering Cato Networks for this.", NOW);
    const f = factsOn(turn.facts, "procurement.vendorsUnderConsideration")[0];
    if (!f) throw new Error("vendorsUnderConsideration fact missing");
    if (JSON.stringify(turn.requirement).includes("Cato")) {
      throw new Error("vendor-under-consideration leaked into SecurityRequirementInput");
    }
  });

  /* ---- E: named location/geography persisted, not dropped ---- */
  await ok("E: named location and its criticality both persist", async () => {
    const turn = await computeFirstTurn("Manchester HQ is business-critical.", NOW);
    if (!has(turn.facts, "estate.namedLocations")) throw new Error("namedLocations missing");
    if (!has(turn.facts, "estate.locationCriticality")) throw new Error("locationCriticality missing");
  });

  /* ---- F: constraint persisted with provenance ---- */
  await ok("F: a compliance constraint persists with provenance and reaches the requirement too", async () => {
    const turn = await computeFirstTurn("We need ISO 27001 certification.", NOW);
    const f = factsOn(turn.facts, "constraints.complianceRequirements")[0];
    if (!f) throw new Error("complianceRequirements fact missing");
    if (f.provenance !== "stated") throw new Error("should be stated");
    if (!(turn.requirement.constraints?.complianceRequirements ?? []).includes("iso27001")) {
      throw new Error("compliance did not reach SecurityRequirementInput (it is meant to — unlike the PKM paths)");
    }
  });

  /* ---- G: follow-up turn adds estate detail; same Project updated, no
     duplicate of the first turn's facts ---- */
  await ok("G: a later turn adds a fact without duplicating earlier ones", async () => {
    const t1 = await computeFirstTurn("We have 300 users across 4 sites.", NOW);
    const t2 = await computeNextTurn(t1.facts, t1.understanding.objectives, t1.understanding.cycle, t1.requirement, "We also run Microsoft 365.", NOW + 1000);
    if (factsOn(t2.facts, "estate.users").length !== 1) throw new Error("estate.users duplicated across turns");
    if (factsOn(t2.facts, "estate.sites").length !== 1) throw new Error("estate.sites duplicated across turns");
    if (!has(t2.facts, "estate.cloud")) throw new Error("second turn's new fact missing");
    if (t2.understanding.cycle !== 2) throw new Error("cycle did not advance");
  });

  /* ---- H: correction (40 -> 46 sites): current Understanding becomes 46;
     the earlier value is named as superseded, not left simultaneously
     active ---- */
  await ok("H: a correction supersedes the earlier value instead of duplicating it", async () => {
    const t1 = await computeFirstTurn("We have 40 sites.", NOW);
    const before = factsOn(t1.facts, "estate.sites")[0];
    if (Number(before.value) !== 40) throw new Error("precondition: first turn did not read 40");

    const t2 = await computeNextTurn(t1.facts, t1.understanding.objectives, t1.understanding.cycle, t1.requirement, "Actually, we have 46 sites.", NOW + 1000);
    const siteFacts = factsOn(t2.facts, "estate.sites");
    if (siteFacts.length !== 1) throw new Error(`expected exactly one standing estate.sites fact, got ${siteFacts.length}`);
    if (Number(siteFacts[0].value) !== 46) throw new Error(`current value ${siteFacts[0].value}, want 46`);
    const correction = t2.corrections.find((c) => c.path === "estate.sites");
    if (!correction) throw new Error("correction not recorded");
    if (Number(correction.from) !== 40 || Number(correction.to) !== 46) throw new Error("correction from/to wrong");
  });

  /* ---- I: no RFP generation, no supplier/publication side effects, on
     either the first or a subsequent turn ---- */
  await ok("I: no RFP document and no phase advance past scoped, across two turns", async () => {
    const t1 = await computeFirstTurn("We have 40 sites and 300 users, prompted by an audit.", NOW);
    const { project: p1, verdict: v1 } = await buildSecurityProject({
      requirement: t1.requirement, via: "mcp", ids: IDS, now: NOW,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: t1.understanding,
    });
    if (p1.phase !== "scoped" || p1.rfp_sections.length !== 0) throw new Error("turn 1 already produced a document");
    if (p1.invited_vendors.length !== 0) throw new Error("turn 1 invited a vendor");

    const t2 = await computeNextTurn(t1.facts, t1.understanding.objectives, t1.understanding.cycle, t1.requirement, "Actually, we have 46 sites.", NOW + 1000);
    const { project: p2 } = await buildRescopedProject({
      project: p1, requirement: t2.requirement, via: "mcp", now: NOW + 1000,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: t2.understanding,
    });
    if (p2.phase !== "scoped" || p2.rfp_sections.length !== 0) throw new Error("turn 2 already produced a document");
    if ((p2.engine_data?.verdicts?.length ?? 0) !== 2) throw new Error("verdict did not version");
    if ((p2.engine_data?.artefacts?.length ?? 0) !== 0) throw new Error("an artefact appeared with no generation");
    void v1;
  });

  /* ---- J/K (unit-level; live MCP round-trip is verified in the preview
     acceptance pass, not here — see this file's header): the transport
     and actor stamping the MCP tool depends on is correct on both a
     creating call and an updating call. ---- */
  await ok("J: an mcp-via creation stamps assistant actor and mcp source (never mcp itself as actor)", async () => {
    const t1 = await computeFirstTurn("We have 40 sites.", NOW);
    const { project } = await buildSecurityProject({
      requirement: t1.requirement, via: "mcp", ids: IDS, now: NOW,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: t1.understanding,
    });
    if (project.source !== "mcp") throw new Error("source not mcp");
    if (project.history[0]?.actor !== "assistant") throw new Error("actor not assistant");
    if (project.history[0]?.via !== "mcp") throw new Error("via not mcp");
    if ((project.history as unknown[]).some((h) => (h as { actor: string }).actor === "mcp")) {
      throw new Error("mcp used as an actor value, not transport");
    }
  });

  await ok("K: an mcp-via subsequent turn updates the SAME Project, versioning correctly", async () => {
    const t1 = await computeFirstTurn("We have 40 sites.", NOW);
    const { project: p1 } = await buildSecurityProject({
      requirement: t1.requirement, via: "mcp", ids: IDS, now: NOW,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: t1.understanding,
    });
    const t2 = await computeNextTurn(t1.facts, t1.understanding.objectives, t1.understanding.cycle, t1.requirement, "Actually, we have 46 sites.", NOW + 1000);
    const { project: p2 } = await buildRescopedProject({
      project: p1, requirement: t2.requirement, via: "mcp", now: NOW + 1000,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: t2.understanding,
    });
    if (p2.id !== p1.id) throw new Error("second turn produced a different Project");
    if ((p2.history?.length ?? 0) <= (p1.history?.length ?? 0)) throw new Error("history did not grow");
    if (p2.history?.slice(0, p1.history!.length).some((h, i) => JSON.stringify(h) !== JSON.stringify(p1.history![i]))) {
      throw new Error("earlier history was rewritten, not extended");
    }
  });

  /* ---- L: existing browser/MCP creation and re-scope behaviour is
     unaffected when the new flags are simply never passed (mechanical
     spot-check here; the full existing suites are run unmodified in the
     verify script alongside this one, per Robert's instruction). ---- */
  await ok("L: omitting the new flags reproduces the original, unmodified behaviour", async () => {
    const { project } = await buildSecurityProject({
      requirement: { organisation: { sector: "finance" }, estate: { users: 50, sites: 2 }, drivers: ["audit"] },
      via: "web", ids: IDS, now: NOW,
    });
    if (project.phase !== "drafted") throw new Error("default behaviour changed: expected drafted");
    if ((project.rfp_sections?.length ?? 0) === 0) throw new Error("default behaviour changed: expected a generated document");
    if (project.understanding !== undefined) throw new Error("understanding appeared without being asked for");
  });

  /* ---- M: a later, ordinary generate_security_rfp-style regeneration
     never discards the captured Understanding (the regenerate-project.ts
     defensive fix this milestone made). ---- */
  await ok("M: regenerating the document later preserves the captured Understanding", async () => {
    const t1 = await computeFirstTurn("We have 40 sites; our current provider is Fortinet. We need ISO 27001 certification.", NOW);
    const { project } = await buildSecurityProject({
      requirement: t1.requirement, via: "mcp", ids: IDS, now: NOW,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: t1.understanding,
    });
    const regenerated = buildRegeneratedProject({ project, via: "mcp", now: NOW + 2000 });
    if (regenerated.project.phase !== "drafted") throw new Error("regeneration did not advance scoped -> drafted");
    if ((regenerated.project.rfp_sections?.length ?? 0) === 0) throw new Error("regeneration produced no sections");
    if (!regenerated.project.understanding) throw new Error("Understanding was dropped by regeneration");
    if (regenerated.project.understanding.facts.length !== t1.facts.length) {
      throw new Error("Understanding fact count changed across regeneration");
    }
  });

  /* ---- N: the new event type is legal at "scoped" and the machine's own
     append-only/event-vocabulary rules still apply to it. ---- */
  await ok("N: understanding.updated is recordable at phase scoped", async () => {
    const t1 = await computeFirstTurn("We have 40 sites.", NOW);
    const { project } = await buildSecurityProject({
      requirement: t1.requirement, via: "mcp", ids: IDS, now: NOW,
      skipConfidenceGate: true, skipRfpGeneration: true, understanding: t1.understanding,
    });
    const withEvent = recordProjectEvent(project, {
      at: NOW + 5, actor: "assistant", actor_ref: "", via: "mcp",
      event: "understanding.updated", detail: { cycle: 1 },
    });
    if (withEvent.history[withEvent.history.length - 1]?.event !== "understanding.updated") {
      throw new Error("event not appended");
    }
  });

  await throws("N: understanding.updated is refused once a document exists (published)", async () => {
    const { project } = await buildSecurityProject({
      requirement: { organisation: { sector: "finance" }, estate: { users: 50, sites: 2 }, drivers: ["audit"] },
      via: "web", ids: IDS, now: NOW,
    });
    // A drafted (not yet published) project is a legal phase for this
    // event; force an out-of-vocabulary phase to prove the guard is real.
    const forced = { ...project, phase: "published" as const, status: "published" as const };
    recordProjectEvent(forced, { at: NOW + 5, actor: "assistant", actor_ref: "", via: "mcp", event: "understanding.updated", detail: {} });
  }, "not recordable in phase");

  return r;
}
