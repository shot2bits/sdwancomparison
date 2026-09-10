/**
 * D4 acceptance suite: re-scoping accretes, never rewrites. The record
 * grows by one verdict and one artefact; the confirmation sentence's
 * version numbers equal what actually lands on the record; buyer edits
 * are never silently discarded; the guard follows the newest verdict;
 * and the Story renders the change without any further work.
 */

import { buildRescopedProject, confirmationSentence, rescopeConsentText, documentEdited } from "./rescope-project";
import { buildSecurityProject } from "./create-project";
import { assertEngineArtefactsIntact } from "./generate-rfp";
import { openSecurityGaps } from "@/lib/project-machine";
import { buildStory } from "@/lib/project-story";
import type { SecurityRequirementInput } from "./rulebook";

export interface RescopeTestResult { pass: number; fail: number; failures: string[] }

const IDS = { id: "rfp_rescopefix1", shareToken: "tok_rescopefix1", manageToken: "mtok_rescopefix1" };
const NOW = 1_700_000_000_000;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** F2 variant with an open compliance gap at creation. */
const GAPPY: SecurityRequirementInput = {
  organisation: { sector: "finance", sizeBand: "large" },
  estate: { users: 300, sites: 4, devices: { computers: 280, mobiles: 150, servers: 20 }, cloud: ["m365", "aws"], existingSecurity: ["Microsoft Defender P2"], existingNetwork: ["internet"] },
  drivers: ["incident", "compliance"],
  constraints: { inHouseSocCapacity: "none" },
};

/** The same estate with the gap answered. */
const ANSWERED: SecurityRequirementInput = {
  ...GAPPY,
  constraints: { inHouseSocCapacity: "none", complianceRequirements: ["iso27001"] },
};

export async function runRescopeTests(): Promise<RescopeTestResult> {
  const r: RescopeTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const throws = async (name: string, fn: () => Promise<void>, includes: string) => {
    try { await fn(); r.fail += 1; r.failures.push(`${name}: expected throw`); }
    catch (e) { if ((e as Error).message.includes(includes)) r.pass += 1; else { r.fail += 1; r.failures.push(`${name}: wrong message: ${(e as Error).message}`); } }
  };

  await ok("re-scope accretes: verdicts and artefacts grow, history extends, phase holds", async () => {
    const { project } = await buildSecurityProject({ requirement: GAPPY, via: "web", ids: IDS, now: NOW });
    if (openSecurityGaps(project).length === 0) throw new Error("precondition: gappy creation has no gaps");
    const sentence = confirmationSentence(project);
    if (!sentence.includes("Verdict v2") || !sentence.includes("version 2")) throw new Error(`sentence versions wrong: ${sentence}`);

    const { project: p2 } = await buildRescopedProject({ project, requirement: ANSWERED, via: "web", actorRef: "b@x.com", now: NOW + 100 });
    const verdicts = p2.engine_data?.verdicts ?? [];
    const artefacts = p2.engine_data?.artefacts ?? [];
    if (verdicts.length !== 2 || verdicts[1].version !== 2) throw new Error("verdict v2 not appended");
    if (artefacts.length !== 2 || artefacts[1].version !== 2) throw new Error("artefact v2 not appended");
    if (verdicts[0].version !== 1 || artefacts[0].version !== 1) throw new Error("v1 disturbed");
    if (p2.phase !== "drafted") throw new Error(`phase moved to ${p2.phase}`);
    const events = (p2.history ?? []).map((h) => h.event);
    const tail = events.slice(-3).join(",");
    if (tail !== "requirement.updated,verdict.attached,rfp.generated") throw new Error(`history tail [${tail}]`);
    // The write gate accepts the accreted record on the ENGINE path, and
    // refuses the same growth on the client path (D4 hardening: verdicts
    // are attached by the engine, never by editing).
    assertEngineArtefactsIntact(project, p2, { engineWrite: true });
    try { assertEngineArtefactsIntact(project, p2); throw new Error("client-path verdict append was not refused"); }
    catch (e) { if (!(e as Error).message.includes("Security Sourcing engine")) throw new Error(`wrong refusal: ${(e as Error).message}`); }
    // The answered gap is gone: gate, health and home all read this helper.
    if (openSecurityGaps(p2).length !== 0) throw new Error("answered gap still open on v2");
    // The consent carries the sentence with the real numbers (check 2).
    const consent = (p2.consents ?? []).find((c) => c.action === "rescope");
    if (!consent || !consent.text.includes("Verdict v2") || !consent.text.includes(sentence)) throw new Error("consent does not carry the version sentence verbatim");
  });

  await throws("edited document without replace-edits consent is refused", async () => {
    const { project } = await buildSecurityProject({ requirement: GAPPY, via: "web", ids: IDS, now: NOW });
    const edited = clone(project);
    edited.rfp_sections[1].questions[0].text += " (buyer edit)";
    if (!documentEdited(edited)) throw new Error("precondition: edit not detected");
    await buildRescopedProject({ project: edited, requirement: ANSWERED, via: "web", now: NOW + 100 }).then(() => {});
  }, "replace-edits consent");

  await ok("edited document with consent proceeds; v1 snapshot keeps the pre-edit generation", async () => {
    const { project } = await buildSecurityProject({ requirement: GAPPY, via: "web", ids: IDS, now: NOW });
    const edited = clone(project);
    edited.rfp_sections[1].questions[0].text += " (buyer edit)";
    const { project: p2 } = await buildRescopedProject({ project: edited, requirement: ANSWERED, via: "web", replaceEdits: true, now: NOW + 100 });
    const consent = (p2.consents ?? []).find((c) => c.action === "rescope_replace_edits");
    if (!consent || !consent.text.includes("my edits to the current draft will be replaced")) throw new Error("replace-edits consent not recorded verbatim");
    // Snapshots are the Record: v1 keeps the GENERATED baseline (the live
    // edit was never generated content), v2 is the regeneration.
    const arts = p2.engine_data?.artefacts ?? [];
    if (arts.length !== 2) throw new Error("artefacts wrong length");
    if (JSON.stringify(arts[0].sections_snapshot).includes("(buyer edit)")) throw new Error("v1 snapshot mutated by the edit");
    if (JSON.stringify(p2.rfp_sections) !== JSON.stringify(arts[1].sections_snapshot)) throw new Error("live document is not the v2 generation");
  });

  await throws("low-confidence re-scope is refused with the gap questions", async () => {
    const { project } = await buildSecurityProject({ requirement: GAPPY, via: "web", ids: IDS, now: NOW });
    await buildRescopedProject({ project, requirement: { drivers: ["audit"] }, via: "web", now: NOW + 100 }).then(() => {});
  }, "gap questions");

  await ok("the transparency guard follows the newest verdict after re-scope", async () => {
    const { project } = await buildSecurityProject({ requirement: GAPPY, via: "web", ids: IDS, now: NOW });
    const { project: p2 } = await buildRescopedProject({ project, requirement: ANSWERED, via: "web", now: NOW + 100 });
    // Deleting a v2 protected item is refused by name.
    const del = clone(p2);
    for (const s of del.rfp_sections) s.questions = s.questions.filter((q) => q.id !== "tr_ai_endpoint");
    try { assertEngineArtefactsIntact(p2, del); throw new Error("v2 protected deletion not refused"); }
    catch (e) { if (!(e as Error).message.includes("tr_ai_endpoint")) throw new Error(`refusal does not name the item: ${(e as Error).message}`); }
  });

  await ok("the story shows the re-scope without any further work", async () => {
    const { project } = await buildSecurityProject({ requirement: GAPPY, via: "web", ids: IDS, now: NOW });
    const { project: p2 } = await buildRescopedProject({ project, requirement: ANSWERED, via: "web", now: NOW + 100 });
    const s = buildStory(p2);
    if (s.verdictChapters.length !== 2) throw new Error("story missing the v2 chapter");
    if (s.documentVersions.length !== 2) throw new Error("story missing the v2 document");
    if (s.documentVersions[1].diff === null) throw new Error("v2 diff not computed");
    if (!s.decisions.some((c) => c.action === "rescope")) throw new Error("re-scope decision missing from the ledger");
  });

  await ok("consent preview text matches the sentence shown", async () => {
    const { project } = await buildSecurityProject({ requirement: GAPPY, via: "web", ids: IDS, now: NOW });
    const text = rescopeConsentText(project);
    if (!text.includes(confirmationSentence(project))) throw new Error("consent text does not embed the sentence");
  });

  return r;
}
