/**
 * The Project Story (Phase D3): the record, explained.
 *
 * Most procurement software records activity. The Story answers WHY:
 * why it was scoped this way, why things were excluded, who accepted
 * which risk, what changed between versions, and who approved what.
 * The Constitution already forced everything needed onto the record
 * (verdicts, history, consents, artefact snapshots), so this module is
 * PURE RENDERING HELPERS: no writes, no new fields, no model. Deleting
 * it would change nothing about the platform (spec D3 acceptance 1).
 *
 * Two projections of the same record (Robert's amendment): CHAPTERS
 * (people who think in artefacts) and a chronological TIMELINE (people
 * who think in events). Verbatim fields (consent wording, against-
 * interest statements, exclusion reasons) are passed through untouched
 * and callers must render them clearly separated from narration.
 */

import type { ProjectDetails, ProjectHistoryEvent, ProjectConsent, ProjectArtefact, RfpSection } from "@/lib/rfp-types";
import type { SecurityScopeVerdict, CapabilityId } from "@/lib/security/rulebook";
import { CAPABILITY_LABELS } from "@/lib/security/generate-rfp";

/* ---------------- shared event humanisation (one truth) ---------------- */

const EVENT_LABELS: Record<string, (d: Record<string, unknown> | undefined) => string> = {
  "project.created": () => "Project created",
  "verdict.attached": (d) => `Verdict v${d?.version ?? "?"} attached`,
  "rfp.generated": (d) => `RFP generated (version ${d?.artefact_version ?? "?"}${typeof d?.questions === "number" ? `, ${d.questions} questions` : ""})`,
  "rfp.edited": () => "RFP edited",
  "requirement.updated": (d) => (d?.accepted === true ? `Gap accepted: ${d?.gap_field ?? ""}` : "Requirement updated"),
  "publish.consented": () => "Publish consent recorded",
  "publish.approved": () => "Approval recorded",
  "approval.requested": () => "Approval requested",
  "approval.declined": () => "Approval declined",
  "publish.live": () => "Published to the marketplace",
  "invite.sent": () => "Suppliers invited",
  "nda.accepted": () => "NDA accepted",
  "clarification.asked": () => "Clarification asked",
  "clarification.answered": () => "Clarification answered",
  "response.started": () => "Supplier response started",
  "response.submitted": () => "Supplier response submitted",
  "evaluation.opened": () => "Evaluation opened",
  "award.decided": () => "Award decided",
  "award.accepted": () => "Award accepted",
  "award.declined": () => "Award declined",
  "project.closed": (d) => `Project closed${d?.reason ? ` (${d.reason})` : ""}`,
};

export function humaniseEvent(event: string, detail?: Record<string, unknown>): string {
  const base = event.endsWith(".corrected") ? `Correction recorded (${event.replace(".corrected", "")})` : undefined;
  return base ?? EVENT_LABELS[event]?.(detail) ?? event.replace(/[._]/g, " ");
}

/* ---------------------------- chapters ---------------------------- */

export interface VerdictChapter {
  version: number;
  at: number;
  via: string;
  confidence: string;
  digest: string;
  rulebookVersion: string;
  required: string[];
  conditional: string[];
  excluded: Array<{ label: string; reason: string; alternative?: string }>; // verbatim reasons
  againstInterest: string[]; // verbatim statements
  assumptions: string[];
  gaps: Array<{ field: string; question: string }>;
}

export interface DocumentVersion {
  version: number;
  at: number;
  via: string;
  digest: string;
  sections: number;
  questions: number;
  diff: ArtefactDiff | null; // vs the previous version; null for v1
}

export interface ArtefactDiff {
  sectionsAdded: string[];
  sectionsRemoved: string[];
  questionsAdded: Array<{ id: string; text: string }>;
  questionsRemoved: Array<{ id: string; text: string }>;
  questionsReworded: Array<{ id: string; before: string; after: string }>;
}

export interface ProjectStory {
  origin: { at: number; actor: string; via: string; consentText: string | null };
  verdictChapters: VerdictChapter[];
  documentVersions: DocumentVersion[];
  decisions: ProjectConsent[]; // the ledger, verbatim, in order
  events: ProjectHistoryEvent[];
  provenance: { rulebookVersion?: string; latestDigest?: string; methodologyVersion: string };
}

const label = (id: string) => CAPABILITY_LABELS[id as CapabilityId] ?? id;

function flatten(sections: RfpSection[]): Map<string, { text: string; category: string }> {
  const m = new Map<string, { text: string; category: string }>();
  for (const s of sections) for (const q of s.questions) m.set(q.id, { text: q.text, category: s.category });
  return m;
}

export function artefactDiff(prev: RfpSection[], next: RfpSection[]): ArtefactDiff {
  const a = flatten(prev);
  const b = flatten(next);
  const prevCats = new Set(prev.map((s) => s.category));
  const nextCats = new Set(next.map((s) => s.category));
  const diff: ArtefactDiff = {
    sectionsAdded: [...nextCats].filter((c) => !prevCats.has(c)),
    sectionsRemoved: [...prevCats].filter((c) => !nextCats.has(c)),
    questionsAdded: [],
    questionsRemoved: [],
    questionsReworded: [],
  };
  for (const [id, q] of b) {
    const was = a.get(id);
    if (!was) diff.questionsAdded.push({ id, text: q.text });
    else if (was.text !== q.text) diff.questionsReworded.push({ id, before: was.text, after: q.text });
  }
  for (const [id, q] of a) if (!b.has(id)) diff.questionsRemoved.push({ id, text: q.text });
  return diff;
}

export function buildStory(p: ProjectDetails): ProjectStory {
  const history = p.history ?? [];
  const consents = p.consents ?? [];
  const created = history.find((h) => h.event === "project.created");
  const createConsent = consents.find((c) => c.action === "create");

  const verdictChapters: VerdictChapter[] = (p.engine_data?.verdicts ?? []).map((entry) => {
    const v = entry.verdict as SecurityScopeVerdict;
    return {
      version: entry.version,
      at: entry.created_at,
      via: entry.via,
      confidence: v?.confidence ?? "unknown",
      digest: entry.input_digest,
      rulebookVersion: v?.rulebookVersion ?? "",
      required: (v?.summary?.recommended ?? []).map(label),
      conditional: (v?.summary?.conditional ?? []).map(label),
      excluded: (v?.summary?.not_recommended ?? []).map((n) => ({ label: label(n.capabilityId), reason: n.reason, ...(n.alternative ? { alternative: n.alternative } : {}) })),
      againstInterest: (v?.againstInterest ?? []).map((e) => e.statement),
      assumptions: v?.assumptions ?? [],
      gaps: v?.gaps ?? [],
    };
  });

  const artefacts = p.engine_data?.artefacts ?? [];
  const documentVersions: DocumentVersion[] = artefacts.map((art: ProjectArtefact, i: number) => ({
    version: art.version,
    at: art.created_at,
    via: art.via,
    digest: art.input_digest,
    sections: art.sections_snapshot.length,
    questions: art.sections_snapshot.reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0),
    diff: i === 0 ? null : artefactDiff(artefacts[i - 1].sections_snapshot, art.sections_snapshot),
  }));

  const latestVerdict = verdictChapters[verdictChapters.length - 1];
  return {
    origin: {
      at: created?.at ?? p.created,
      actor: created?.actor ?? "buyer",
      via: created?.via ?? p.source ?? "web",
      consentText: createConsent?.text ?? null,
    },
    verdictChapters,
    documentVersions,
    decisions: consents,
    events: history,
    provenance: {
      ...(latestVerdict ? { rulebookVersion: latestVerdict.rulebookVersion, latestDigest: latestVerdict.digest } : {}),
      methodologyVersion: p.methodology_version ?? "2026.1",
    },
  };
}

/* ---------------------------- timeline ---------------------------- */

export interface TimelineEntry {
  at: number;
  text: string;
  actor?: string;
  via?: string;
  consent?: boolean;
  kind: "event" | "decision";
}

/** Chronological projection: the history is the spine (Article 9 makes it
 *  the authoritative chronology); consent decisions that have no history
 *  event of their own (gap acceptances carry one; approvals will) appear
 *  as decision entries so nothing recorded is invisible. */
export function timelineEntries(p: ProjectDetails): TimelineEntry[] {
  const entries: TimelineEntry[] = (p.history ?? []).map((h) => ({
    at: h.at,
    text: humaniseEvent(h.event, h.detail as Record<string, unknown> | undefined),
    actor: h.actor,
    via: h.via,
    ...(h.consent ? { consent: true } : {}),
    kind: "event" as const,
  }));
  const eventTimes = new Set(entries.map((e) => e.at));
  for (const c of p.consents ?? []) {
    // The create and accept_gap consents ride alongside their events; a
    // consent with no event at its timestamp still deserves a line.
    if (!eventTimes.has(c.at)) {
      entries.push({ at: c.at, text: `Decision recorded: ${c.action}`, actor: "buyer", via: c.via, consent: true, kind: "decision" });
    }
  }
  return entries.sort((a, b) => a.at - b.at);
}

/* ---------------------------- export ---------------------------- */

const dt = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function buildStoryMarkdown(p: ProjectDetails): string {
  const s = buildStory(p);
  const L: string[] = [];
  L.push(`# Project story: ${p.title || p.id}`, "");
  L.push(`Generated from the project record on ${dt(Date.now())}. Verbatim quotations are marked; everything else is a rendering of recorded data.`, "");

  L.push(`## Origin`, "");
  L.push(`Created ${dt(s.origin.at)} by ${s.origin.actor} via ${s.origin.via}.`);
  if (s.origin.consentText) L.push(`Consent recorded verbatim: "${s.origin.consentText}"`);
  L.push("");

  for (const v of s.verdictChapters) {
    L.push(`## Scoping verdict v${v.version} (${dt(v.at)})`, "");
    L.push(`${v.rulebookVersion}, confidence ${v.confidence}, input digest ${v.digest}.`, "");
    if (v.required.length) L.push(`Required: ${v.required.join("; ")}.`);
    if (v.conditional.length) L.push(`Conditional: ${v.conditional.join("; ")}.`);
    for (const e of v.excluded) L.push(`Excluded: ${e.label}. Reason (verbatim): "${e.reason}"${e.alternative ? ` Alternative: "${e.alternative}"` : ""}`);
    for (const a of v.againstInterest) L.push(`Against interest (verbatim): "${a}"`);
    if (v.assumptions.length) L.push(`Assumptions: ${v.assumptions.join("; ")}.`);
    if (v.gaps.length) L.push(`Gaps at this version: ${v.gaps.map((g) => g.question).join(" ")}`);
    L.push("");
  }

  for (const d of s.documentVersions) {
    L.push(`## RFP version ${d.version} (${dt(d.at)})`, "");
    L.push(`${d.sections} sections, ${d.questions} questions. Generated from verdict ${d.digest}.`);
    if (d.diff) {
      const { sectionsAdded, sectionsRemoved, questionsAdded, questionsRemoved, questionsReworded } = d.diff;
      if (sectionsAdded.length) L.push(`Sections added: ${sectionsAdded.join("; ")}.`);
      if (sectionsRemoved.length) L.push(`Sections removed: ${sectionsRemoved.join("; ")}.`);
      if (questionsAdded.length) L.push(`Questions added: ${questionsAdded.map((q) => q.id).join(", ")}.`);
      if (questionsRemoved.length) L.push(`Questions removed: ${questionsRemoved.map((q) => q.id).join(", ")}.`);
      for (const r of questionsReworded) L.push(`Reworded ${r.id}: "${r.before}" -> "${r.after}"`);
      if (!sectionsAdded.length && !sectionsRemoved.length && !questionsAdded.length && !questionsRemoved.length && !questionsReworded.length) {
        L.push(`No content changes against version ${d.version - 1}.`);
      }
    }
    L.push("");
  }

  if (s.decisions.length) {
    L.push(`## Decisions (the consent ledger, verbatim)`, "");
    for (const c of s.decisions) L.push(`- ${dt(c.at)} · ${c.action} · ${c.granted_by} via ${c.via}: "${c.text}"`);
    L.push("");
  }

  L.push(`## Timeline`, "");
  for (const e of timelineEntries(p)) L.push(`- ${dt(e.at)} · ${e.text}${e.actor ? ` (${e.actor}${e.via ? ` · ${e.via}` : ""})` : ""}${e.consent ? " [consented]" : ""}`);
  L.push("");

  L.push(`## Provenance`, "");
  L.push(`Methodology ${s.provenance.methodologyVersion}${s.provenance.rulebookVersion ? `; ${s.provenance.rulebookVersion}` : ""}${s.provenance.latestDigest ? `; latest verdict digest ${s.provenance.latestDigest}` : ""}. The history is append-only; corrections appear as corrections, never as replacements.`);
  return L.join("\n");
}
