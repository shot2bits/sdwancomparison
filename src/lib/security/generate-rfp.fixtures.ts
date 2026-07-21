/**
 * Step 3 acceptance suite: the generated RFP artefact itself, held to
 * Robert's eight checks (21 July 2026) plus the two approval conditions
 * (informational inertness; narrow recoverable protection). Runs on the
 * approved SEC-RULES fixtures: F1 (SMB baseline), F2 (the keep-Defender
 * denial surviving into the document), F5 (MSP estate).
 */

import { SECURITY_FIXTURES } from "./fixtures";
import { assessSecurityRequirement, type SecurityScopeVerdict } from "./rulebook";
import { generateRfpSections, protectedTransparencyItems, assertEngineArtefactsIntact, TRANSPARENCY_CATEGORY } from "./generate-rfp";
import { buildSecurityProject } from "./create-project";
import { advanceProject, recordProjectEvent } from "@/lib/project-machine";
import { includedSections, documentSections, sectionStats } from "@/lib/rfp-document";
import { QUESTION_BANK } from "@/lib/rfp-question-bank";
import type { ProjectDetails } from "@/lib/rfp-types";

export interface GenerateTestResult { pass: number; fail: number; failures: string[] }

const fixture = (id: string) => {
  const f = SECURITY_FIXTURES.find((x) => x.id === id);
  if (!f) throw new Error(`fixture ${id} missing`);
  return f;
};

const IDS = { id: "rfp_genfix01", shareToken: "tok_genfix01", manageToken: "mtok_genfix01" };
const NOW = 1_700_000_000_000;

async function projectFor(id: string): Promise<{ project: ProjectDetails; verdict: SecurityScopeVerdict }> {
  return buildSecurityProject({ requirement: fixture(id).input, via: "web", ids: IDS, now: NOW });
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const flatQ = (p: ProjectDetails) => p.rfp_sections.flatMap((s) => s.questions);

export async function runGenerateRfpTests(): Promise<GenerateTestResult> {
  const r: GenerateTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };

  /* 1. Determinism: same verdict, same document, always. */
  await ok("1. determinism: identical verdict yields the identical document", async () => {
    for (const id of ["F1", "F2", "F5"]) {
      const v = await assessSecurityRequirement(fixture(id).input);
      const a = JSON.stringify(generateRfpSections(v));
      const b = JSON.stringify(generateRfpSections(v));
      if (a !== b) throw new Error(`${id}: two generations differ`);
    }
    const p1 = await projectFor("F2");
    const p2 = await projectFor("F2");
    if (JSON.stringify(p1.project.rfp_sections) !== JSON.stringify(p2.project.rfp_sections)) {
      throw new Error("F2: creation-time generation not deterministic");
    }
  });

  /* 2. Required capabilities become required questions with the trail. */
  await ok("2. required capabilities drive required questions carrying reasoning and evidence", async () => {
    const { project, verdict } = await projectFor("F2");
    const mdr = verdict.capabilities.find((c) => c.id === "mdr_soc");
    if (!mdr || mdr.needed !== "required") throw new Error("precondition: F2 mdr_soc not required");
    const qs = flatQ(project).filter((q) => q.priority === "required" && q.source === "bank");
    if (!qs.length) throw new Error("no required bank questions generated");
    if (!qs.some((q) => q.rationale.includes("mdr_soc"))) throw new Error("no question traces to mdr_soc");
    if (qs.some((q) => !q.evidence_requested)) throw new Error("a required question lacks its evidence request");
    if (qs.some((q) => q.mandatory)) throw new Error("engine set mandatory: that flag is the buyer's alone");
    const scope = flatQ(project).find((q) => q.id === "tr_scope");
    if (!scope || !scope.rationale.includes("rules:")) throw new Error("scope statement does not carry the fired rules");
  });

  /* 3. Recommended capabilities remain visibly conditional. */
  await ok("3. recommended capabilities are visibly conditional in the document", async () => {
    for (const id of ["F1", "F2", "F5"]) {
      const v = await assessSecurityRequirement(fixture(id).input);
      const rec = v.capabilities.filter((c) => c.needed === "recommended");
      if (!rec.length) continue;
      const sections = generateRfpSections(v);
      const all = sections.flatMap((s) => s.questions);
      for (const c of rec) {
        const cond = all.find((q) => q.id === `tr_cond_${c.id}`);
        if (!cond) throw new Error(`${id}: no conditional statement for ${c.id}`);
        if (!cond.text.startsWith("Conditional capability:")) throw new Error(`${id}: conditional not labelled`);
      }
      const recQs = all.filter((q) => q.priority === "recommended" && q.source === "bank");
      if (recQs.some((q) => !q.rationale.includes("Conditional (recommended)"))) {
        throw new Error(`${id}: a recommended question's rationale does not say it is conditional`);
      }
      return;
    }
    throw new Error("no fixture produced a recommended capability: check the rulebook fixtures");
  });

  /* 4. Exclusions travel with their reasons (F2 keep-Defender). */
  await ok("4. F2: the keep-Defender exclusion survives into the document with its reason", async () => {
    const { project, verdict } = await projectFor("F2");
    const denied = verdict.summary.not_recommended.find((n) => n.capabilityId === "endpoint");
    if (!denied) throw new Error("precondition: F2 endpoint not in not_recommended");
    const item = flatQ(project).find((q) => q.id === "tr_excl_endpoint");
    if (!item) throw new Error("exclusion item missing from document");
    if (!item.text.includes(denied.reason)) throw new Error("exclusion reason not carried verbatim");
    const ai = flatQ(project).find((q) => q.id === "tr_ai_endpoint");
    if (!ai) throw new Error("against-interest record missing from document");
    const aiSource = verdict.againstInterest.find((e) => e.capabilityId === "endpoint");
    if (!aiSource || !ai.text.includes(aiSource.statement)) throw new Error("against-interest statement not verbatim");
  });

  /* 5. Against-interest reasoning is protected: narrow, loud, recoverable. */
  await ok("5. protection: delete/reword/hide refused by name; ordinary edits pass", async () => {
    const { project } = await projectFor("F2");
    const existing = project;

    const del = clone(project);
    for (const s of del.rfp_sections) s.questions = s.questions.filter((q) => q.id !== "tr_ai_endpoint");
    try { assertEngineArtefactsIntact(existing, del); throw new Error("deletion was not refused"); }
    catch (e) { if (!(e as Error).message.includes("tr_ai_endpoint")) throw new Error(`refusal does not name the item: ${(e as Error).message}`); }

    const reword = clone(project);
    for (const s of reword.rfp_sections) for (const q of s.questions) if (q.id === "tr_ai_endpoint") q.text = "We recommend our own product after all.";
    try { assertEngineArtefactsIntact(existing, reword); throw new Error("rewording was not refused"); }
    catch (e) { if (!(e as Error).message.includes("reworded")) throw new Error("refusal does not say reworded"); }

    const hide = clone(project);
    for (const s of hide.rfp_sections) if (s.category === TRANSPARENCY_CATEGORY) s.included = false;
    try { assertEngineArtefactsIntact(existing, hide); throw new Error("hiding the section was not refused"); }
    catch (e) { if (!(e as Error).message.includes("hidden")) throw new Error("refusal does not say hidden"); }

    // Ordinary edits stay free (narrow scope): annotate alongside, reword a
    // bank question, delete another, reweight, add a custom section.
    const edit = clone(project);
    for (const s of edit.rfp_sections) {
      if (s.category === TRANSPARENCY_CATEGORY) {
        s.questions.push({ id: "note_buyer_1", feature_id: "custom", text: "Buyer note: we accept the Defender position.", evidence_requested: "", rationale: "", priority: "optional", source: "custom", buyer_lens: "", supplier_lens: "", mandatory: false, weight: 1 });
      } else if (s.questions.length > 1) {
        s.questions[0].text = `${s.questions[0].text} (edited by the buyer)`;
        s.questions[0].weight = 5;
        s.questions[0].mandatory = true;
        s.questions = s.questions.slice(0, s.questions.length - 1);
      }
    }
    edit.rfp_sections.push({ category: "Custom requirements", included: true, questions: [{ id: "cq1", feature_id: "custom", text: "Describe your onboarding plan.", evidence_requested: "", rationale: "", priority: "recommended", source: "custom", buyer_lens: "", supplier_lens: "", mandatory: false, weight: 3 }] });
    assertEngineArtefactsIntact(existing, edit); // must NOT throw

    // The Record is append-only: shrinking verdicts or artefacts is refused.
    const shrink = clone(project);
    shrink.engine_data = { ...shrink.engine_data!, verdicts: [] };
    try { assertEngineArtefactsIntact(existing, shrink); throw new Error("verdict shrink was not refused"); }
    catch (e) { if (!(e as Error).message.includes("append-only")) throw new Error("shrink refusal wrong"); }
  });

  /* 6. Questions are traceable to the bank. */
  await ok("6. every bank question traces to the canonical bank; every item carries provenance", async () => {
    const bankIds = new Set(QUESTION_BANK.canonical.map((q) => q.id));
    for (const id of ["F1", "F2", "F5"]) {
      const v = await assessSecurityRequirement(fixture(id).input);
      for (const s of generateRfpSections(v)) {
        for (const q of s.questions) {
          if (q.source === "bank" && !bankIds.has(q.id)) throw new Error(`${id}: ${q.id} not in the canonical bank`);
          if (!q.rationale) throw new Error(`${id}: ${q.id} has no rationale`);
          if (q.source === "bank" && !q.evidence_requested) throw new Error(`${id}: ${q.id} has no evidence request`);
        }
      }
    }
  });

  /* 7. Gap handling: draft proceeds; publication refuses until each gap is
        answered or individually accepted with recorded consent. */
  await ok("7. open gaps block publication until individually accepted with consent", async () => {
    let picked: { project: ProjectDetails; verdict: SecurityScopeVerdict } | null = null;
    for (const id of ["F2", "F5", "F1"]) {
      const v = await assessSecurityRequirement(fixture(id).input);
      if (v.confidence !== "low" && v.gaps.length > 0) { picked = await projectFor(id); break; }
    }
    if (!picked) {
      // Fall back to a crafted requirement that is creatable but gappy.
      const req = { ...fixture("F2").input, constraints: { inHouseSocCapacity: "none" as const } };
      const v = await assessSecurityRequirement(req);
      if (v.confidence === "low" || v.gaps.length === 0) throw new Error("could not construct a creatable requirement with open gaps");
      picked = await buildSecurityProject({ requirement: req, via: "web", ids: IDS, now: NOW });
    }
    const { project, verdict } = picked;
    if (project.phase !== "drafted") throw new Error("draft did not proceed despite gaps");
    if (!flatQ(project).some((q) => q.id === "tr_gaps")) throw new Error("gap statement missing from document");

    // Publish consent recorded, gaps still open: the machine must refuse.
    let p: ProjectDetails = {
      ...project,
      consents: [...(project.consents ?? []), { at: NOW + 10, action: "publish", granted_by: "buyer@example.com", via: "web" as const, text: "Publish to marketplace." }],
    };
    p = recordProjectEvent(p, { at: NOW + 11, actor: "buyer", actor_ref: "buyer@example.com", via: "web", event: "publish.consented", detail: {} });
    try {
      advanceProject(p, { at: NOW + 12, actor: "buyer", actor_ref: "buyer@example.com", via: "web", event: "publish.live", detail: {} });
      throw new Error("publication proceeded with open gaps");
    } catch (e) {
      if (!(e as Error).message.includes("gap")) throw new Error(`refusal does not mention gaps: ${(e as Error).message}`);
    }

    // Accept each gap individually (Article 13: one consent per action).
    for (const g of verdict.gaps) {
      p = { ...p, consents: [...(p.consents ?? []), { at: NOW + 13, action: `accept_gap:${g.field}`, granted_by: "buyer@example.com", via: "web" as const, text: `I accept proceeding without: ${g.question}` }] };
    }
    const published = advanceProject(p, { at: NOW + 14, actor: "buyer", actor_ref: "buyer@example.com", via: "web", event: "publish.live", detail: {} });
    if (published.phase !== "published") throw new Error("publication did not proceed after acceptance");
  });

  /* 8. Versions remain recoverable. */
  await ok("8. every generation is snapshotted; snapshots are append-only", async () => {
    const { project, verdict } = await projectFor("F2");
    const art = project.engine_data?.artefacts?.[0];
    if (!art || art.version !== 1) throw new Error("artefact v1 missing");
    if (JSON.stringify(art.sections_snapshot) !== JSON.stringify(project.rfp_sections)) throw new Error("snapshot differs from the live document at generation");
    if (art.input_digest !== verdict.inputDigest) throw new Error("artefact does not record its verdict digest");

    // Regeneration appends v2 (as the tool does); the guard accepts it.
    const regen = clone(project);
    regen.engine_data = { ...regen.engine_data!, artefacts: [...(regen.engine_data!.artefacts ?? []), { ...clone(art), version: 2, created_at: NOW + 20 }] };
    assertEngineArtefactsIntact(project, regen);

    // Rewriting v1 in place is refused.
    const tamper = clone(project);
    tamper.engine_data = { ...tamper.engine_data!, artefacts: [{ ...clone(art), input_digest: "sha256:forged" }] };
    try { assertEngineArtefactsIntact(project, tamper); throw new Error("artefact rewrite was not refused"); }
    catch (e) { if (!(e as Error).message.includes("append-only")) throw new Error("artefact tamper refusal wrong"); }
  });

  /* Condition 1 (approval): informational entries are provably inert. */
  await ok("condition 1: information items carry only inert fields and stay out of counts", async () => {
    const { project, verdict } = await projectFor("F2");
    const info = flatQ(project).filter((q) => q.priority === "optional");
    if (!info.length) throw new Error("no information items generated");
    for (const q of info) {
      // These four fields are what every existing consumer keys on: the
      // respond form and rfp-evaluation filter priority optional; bid-review
      // counts only required/mandatory; nothing weights unanswered optional.
      if (q.source !== "custom") throw new Error(`${q.id}: information item must be source custom`);
      if (q.mandatory) throw new Error(`${q.id}: information item marked mandatory`);
      if (q.evidence_requested) throw new Error(`${q.id}: information item requests evidence`);
      if (q.weight !== 1) throw new Error(`${q.id}: information item weighted`);
    }
    // Scoring view excludes them; rendered document includes them.
    const scored = includedSections(project).flatMap((s) => s.questions);
    if (scored.some((q) => q.priority === "optional")) throw new Error("scoring view includes optional items");
    const rendered = documentSections(project).flatMap((s) => s.questions);
    for (const p of protectedTransparencyItems(verdict)) {
      if (!rendered.some((q) => q.id === p.id)) throw new Error(`${p.id} missing from the rendered document`);
    }
    // Weight-share table sums only scored questions.
    const stats = sectionStats(project);
    if (stats.some((st) => st.category === TRANSPARENCY_CATEGORY)) throw new Error("transparency section entered the scoring table");
  });

  /* Condition 2 (approval): protected set is exactly the constitutional set. */
  await ok("condition 2: protection is narrow: only against-interest, exclusions and provenance", async () => {
    const { verdict } = await projectFor("F2");
    const ids = protectedTransparencyItems(verdict).map((i) => i.id);
    for (const id of ids) {
      if (!id.startsWith("tr_ai_") && !id.startsWith("tr_excl_") && id !== "tr_versions") {
        throw new Error(`unexpected protected id ${id}: scope, conditionals and gap notes must stay editable`);
      }
    }
    if (!ids.includes("tr_versions")) throw new Error("provenance line not protected");
  });

  return r;
}
