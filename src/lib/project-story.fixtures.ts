/**
 * D3 acceptance suite: the Story is a pure view over the record, verbatim
 * where the record is verbatim, correct in its diffs, chronological in
 * its timeline, and leak-free in its export.
 */

import { buildStory, artefactDiff, timelineEntries, buildStoryMarkdown } from "@/lib/project-story";
import { buildSecurityProject, CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { SECURITY_FIXTURES } from "@/lib/security/fixtures";
import type { SecurityScopeVerdict } from "@/lib/security/rulebook";
import type { ProjectDetails, RfpSection } from "@/lib/rfp-types";

export interface StoryTestResult { pass: number; fail: number; failures: string[] }

const IDS = { id: "rfp_storyfix01", shareToken: "tok_storyfix01", manageToken: "mtok_storyfix01" };
const NOW = 1_700_000_000_000;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

async function f2Project(): Promise<{ project: ProjectDetails; verdict: SecurityScopeVerdict }> {
  const fx = SECURITY_FIXTURES.find((x) => x.id === "F2");
  if (!fx) throw new Error("F2 missing");
  return buildSecurityProject({ requirement: fx.input, via: "web", ids: IDS, now: NOW });
}

export async function runProjectStoryTests(): Promise<StoryTestResult> {
  const r: StoryTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = async (name: string, fn: () => Promise<void> | void) => {
    try { await fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };

  await ok("story renders the record verbatim: consent, exclusions, against-interest", async () => {
    const { project, verdict } = await f2Project();
    const s = buildStory(project);
    if (s.origin.consentText !== CREATE_CONSENT_TEXT) throw new Error("origin consent not verbatim");
    if (s.verdictChapters.length !== 1) throw new Error("expected one verdict chapter");
    const ch = s.verdictChapters[0];
    for (const n of verdict.summary.not_recommended) {
      const got = ch.excluded.find((e) => e.reason === n.reason);
      if (!got) throw new Error(`exclusion reason for ${n.capabilityId} not verbatim`);
    }
    for (const a of verdict.againstInterest) {
      if (!ch.againstInterest.includes(a.statement)) throw new Error("against-interest statement not verbatim");
    }
    if (ch.digest !== verdict.inputDigest) throw new Error("chapter digest wrong");
    if (s.documentVersions.length !== 1 || s.documentVersions[0].version !== 1) throw new Error("document version chapter missing");
    if (!s.provenance.rulebookVersion) throw new Error("provenance missing rulebook version");
  });

  await ok("artefact diff reports exactly what changed and nothing else", async () => {
    const { project } = await f2Project();
    const v1 = project.engine_data!.artefacts[0].sections_snapshot;
    // Identical regeneration: an empty diff.
    const same = artefactDiff(v1, clone(v1));
    if (same.sectionsAdded.length || same.sectionsRemoved.length || same.questionsAdded.length || same.questionsRemoved.length || same.questionsReworded.length) {
      throw new Error("identical snapshots produced a non-empty diff");
    }
    // A crafted v2: reword one, remove one, add a section.
    const v2: RfpSection[] = clone(v1);
    const bankSection = v2.find((s) => s.questions.some((q) => q.priority !== "optional"))!;
    const reworded = bankSection.questions.find((q) => q.priority !== "optional")!;
    const rewordedId = reworded.id;
    const before = reworded.text;
    reworded.text = `${before} (amended)`;
    const removed = bankSection.questions.filter((q) => q.priority !== "optional")[1];
    const removedId = removed?.id;
    if (removedId) bankSection.questions = bankSection.questions.filter((q) => q.id !== removedId);
    v2.push({ category: "Custom requirements", included: true, questions: [{ id: "cq_new", feature_id: "custom", text: "New question.", evidence_requested: "", rationale: "", priority: "recommended", source: "custom", buyer_lens: "", supplier_lens: "", mandatory: false, weight: 3 }] });
    const d = artefactDiff(v1, v2);
    if (!d.sectionsAdded.includes("Custom requirements")) throw new Error("added section missed");
    if (d.sectionsRemoved.length) throw new Error("phantom removed section");
    if (!d.questionsReworded.some((x) => x.id === rewordedId && x.before === before)) throw new Error("reword missed or before-text wrong");
    if (removedId && !d.questionsRemoved.some((x) => x.id === removedId)) throw new Error("removal missed");
    if (!d.questionsAdded.some((x) => x.id === "cq_new")) throw new Error("addition missed");
  });

  await ok("timeline is strictly chronological and de-duplicates consent-backed events", async () => {
    const { project } = await f2Project();
    // Add a gap-acceptance exactly as the accept-gap route records it:
    // consent + event at the same timestamp.
    let p: ProjectDetails = {
      ...project,
      consents: [...(project.consents ?? []), { at: NOW + 50, action: "accept_gap:test.field", granted_by: "b@x.com", via: "web" as const, text: "I accept proceeding without answering: \"Test?\"" }],
      history: [...(project.history ?? []), { at: NOW + 50, actor: "buyer" as const, actor_ref: "b@x.com", via: "web" as const, event: "requirement.updated", detail: { gap_field: "test.field", accepted: true }, consent: true }],
    };
    const entries = timelineEntries(p);
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].at < entries[i - 1].at) throw new Error("timeline out of order");
    }
    const acceptLines = entries.filter((e) => e.text.includes("test.field"));
    if (acceptLines.length !== 1) throw new Error(`gap acceptance rendered ${acceptLines.length} times, want 1`);
    if (!acceptLines[0].consent) throw new Error("acceptance not marked as consented");
    const texts = entries.map((e) => e.text);
    const orderIdx = ["Project created", "Verdict v1 attached", "RFP generated"].map((t) => texts.findIndex((x) => x.startsWith(t)));
    if (orderIdx.some((i) => i < 0) || orderIdx[0] > orderIdx[1] || orderIdx[1] > orderIdx[2]) throw new Error("creation chain out of order");
    // A consent with no matching event still gets a decision line.
    p = { ...p, consents: [...(p.consents ?? []), { at: NOW + 99, action: "example:orphan", granted_by: "b@x.com", via: "web" as const, text: "Orphan decision." }] };
    if (!timelineEntries(p).some((e) => e.kind === "decision" && e.text.includes("example:orphan"))) throw new Error("orphan consent invisible");
  });

  await ok("markdown export carries the story and leaks no credentials", async () => {
    const { project, verdict } = await f2Project();
    const md = buildStoryMarkdown(project);
    if (!md.includes("Scoping verdict v1")) throw new Error("verdict chapter missing");
    if (!verdict.againstInterest.every((a) => md.includes(a.statement))) throw new Error("against-interest not exported verbatim");
    if (!md.includes(CREATE_CONSENT_TEXT)) throw new Error("consent wording not exported");
    if (!md.includes("## Timeline") || !md.includes("## Provenance")) throw new Error("sections missing");
    if (md.includes(IDS.manageToken) || md.includes(IDS.shareToken)) throw new Error("credential leaked into the export");
  });

  await ok("legacy records render a thin story without error", async () => {
    const legacy = {
      id: "rfp_legacy01", created: NOW, updated: NOW, status: "draft", title: "Legacy",
      buyer: {}, rfp_sections: [], invited_vendors: [],
      share_token: "tokL", manage_token: "mtokL", source: "wizard", owner_email: "",
      methodology_version: "2026.1", history: [], consents: [],
    } as unknown as ProjectDetails;
    const s = buildStory(legacy);
    if (s.verdictChapters.length !== 0 || s.documentVersions.length !== 0) throw new Error("legacy story invented chapters");
    if (timelineEntries(legacy).length !== 0) throw new Error("legacy timeline invented events");
    if (!buildStoryMarkdown(legacy).includes("Project story")) throw new Error("legacy export failed");
  });

  return r;
}
