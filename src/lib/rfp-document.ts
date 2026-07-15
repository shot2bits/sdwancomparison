/**
 * RFP document assembly: turns a ProjectDetails draft into the full,
 * procurement-ready document — cover, buyer profile, sections with evidence
 * and weighting, evidence checklist, scoring matrix, submission instructions
 * and the citations/assumptions appendix. Pure functions, shared by the
 * server-rendered preview page and the gated markdown download.
 */

import type { ProjectDetails, RfpSection } from "@/lib/rfp-types";
import { BANK_VERSION, SASE_EXTENDED_BANK } from "@/lib/rfp-question-bank";

export type SectionStats = {
  category: string;
  questionCount: number;
  mandatoryCount: number;
  totalWeight: number;
  weightShare: number; // 0..1 of the whole RFP
};

const SCOPE_LABELS: Record<string, string> = {
  full_sase: "Full SASE (no vendor-approach preference)",
  single_vendor_sase: "SASE — unified single vendor",
  best_of_breed: "SASE — best-of-breed",
  sse_only: "SSE (security service edge)",
  sdwan_only: "SD-WAN",
};

const MODEL_LABELS: Record<string, string> = {
  any: "No preference",
  managed: "Fully managed",
  co_managed: "Co-managed",
  diy: "Self-managed",
};

export function includedSections(p: ProjectDetails): RfpSection[] {
  // The document carries the ACTIVE question set: the same rule as the
  // builder's count chip (included sections, questions not marked optional).
  // The synthesised bank seeds every RFP with an invisible priority-optional
  // pool for the browser UI; exporting it made the downloaded document say
  // 40 questions while the builder said 12 (Harry's retest, 15 July 2026).
  return p.rfp_sections
    .map((s) => ({ ...s, questions: s.questions.filter((q) => q.priority !== "optional") }))
    .filter((s) => s.included && s.questions.length > 0);
}

export function sectionStats(p: ProjectDetails): SectionStats[] {
  const sections = includedSections(p);
  const grand = sections.reduce((n, s) => n + s.questions.reduce((m, q) => m + q.weight, 0), 0) || 1;
  return sections.map((s) => {
    const totalWeight = s.questions.reduce((m, q) => m + q.weight, 0);
    return {
      category: s.category,
      questionCount: s.questions.length,
      mandatoryCount: s.questions.filter((q) => q.mandatory).length,
      totalWeight,
      weightShare: totalWeight / grand,
    };
  });
}

/** Aggregated, de-duplicated evidence checklist across every included question. */
export function evidenceChecklist(p: ProjectDetails): { item: string; questionIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const s of includedSections(p)) {
    for (const q of s.questions) {
      for (const raw of q.evidence_requested.split(";")) {
        const item = raw.trim();
        if (!item) continue;
        const key = item.toLowerCase();
        const existing = map.get(key);
        if (existing) existing.push(q.id);
        else map.set(key, [q.id]);
      }
    }
  }
  const pretty = new Map<string, string>();
  for (const s of includedSections(p)) {
    for (const q of s.questions) {
      for (const raw of q.evidence_requested.split(";")) {
        const item = raw.trim();
        if (item && !pretty.has(item.toLowerCase())) pretty.set(item.toLowerCase(), item);
      }
    }
  }
  return [...map.entries()]
    .map(([key, ids]) => ({ item: pretty.get(key) ?? key, questionIds: ids }))
    .sort((a, b) => b.questionIds.length - a.questionIds.length);
}

export function scopeLabel(p: ProjectDetails): string {
  return SCOPE_LABELS[p.buyer.product_scope] ?? p.buyer.product_scope;
}

export function modelLabel(p: ProjectDetails): string {
  return MODEL_LABELS[p.buyer.operating_model] ?? p.buyer.operating_model;
}

/**
 * A synthesised buyer-profile sentence for the background section, so the
 * document always reflects the stated sector, estate and obligations even
 * when the buyer wrote no free-text notes (Harry's testing feedback,
 * 03/07/2026: "the generated RFP doesn't mention my sector").
 */
export function buyerProfileSentence(p: ProjectDetails): string {
  const b = p.buyer;
  const bits: string[] = [];
  const sector = b.sector ? b.sector.replace(/_/g, " ") : "";
  bits.push(sector ? `The buyer is a ${sector} organisation` : "The buyer is an organisation");
  if (b.site_count != null) bits.push(`operating ${b.site_count} site${b.site_count === 1 ? "" : "s"}`);
  if (b.regions.length) bits.push(`across ${b.regions.join(", ").replace(/_/g, " ")}`);
  let s = bits.join(" ") + ".";
  s += ` The requirement covers ${scopeLabel(p)}, delivered as ${modelLabel(p).toLowerCase()}.`;
  if (b.compliance.length) s += ` Responses must address the buyer's stated obligations: ${b.compliance.join(", ").replace(/_/g, " ").toUpperCase()}.`;
  if (sector) s += ` Suppliers should tailor answers, references and evidence to the ${sector} sector.`;
  return s;
}

/** The full RFP as markdown — used by the gated download. */
export function buildRfpMarkdown(p: ProjectDetails): string {
  const sections = includedSections(p);
  const stats = sectionStats(p);
  const evidence = evidenceChecklist(p);
  const generated = new Date().toISOString().slice(0, 10);
  const L: string[] = [];

  // Cover
  L.push(`# ${p.title}`, "");
  L.push(`Request for Proposal · Generated ${generated} via the Netify RFP Builder`, "");
  L.push(`| Field | Value |`, `| --- | --- |`);
  L.push(`| Scope | ${scopeLabel(p)} |`);
  L.push(`| Delivery model | ${modelLabel(p)} |`);
  if (p.buyer.sector) L.push(`| Sector | ${p.buyer.sector.replace(/_/g, " ")} |`);
  if (p.buyer.site_count != null) L.push(`| Sites | ${p.buyer.site_count} |`);
  if (p.buyer.regions.length) L.push(`| Regions | ${p.buyer.regions.join(", ").replace(/_/g, " ")} |`);
  if (p.buyer.compliance.length) L.push(`| Compliance | ${p.buyer.compliance.join(", ").replace(/_/g, " ").toUpperCase()} |`);
  L.push(`| Methodology | Netify SASE Methodology v${p.methodology_version} |`);
  L.push(`| Question bank | Netify question bank v${BANK_VERSION} / ${SASE_EXTENDED_BANK.question_bank_version} |`, "");

  // Background: always present — the synthesised buyer profile keeps the
  // sector/estate context in the document even without free-text notes.
  L.push(`## Project background`, "", buyerProfileSentence(p), "");
  if (p.buyer.notes.trim()) {
    L.push(p.buyer.notes.trim(), "");
  }

  // Sections
  for (const s of sections) {
    L.push(`## ${s.category}`, "");
    s.questions.forEach((q, i) => {
      L.push(`${i + 1}. ${q.mandatory ? "**[MANDATORY]** " : ""}${q.text}`);
      if (q.evidence_requested) L.push(`   - Evidence required: ${q.evidence_requested}`);
      if (q.rationale) L.push(`   - Why this matters: ${q.rationale}`);
      L.push(`   - Weighting: ${q.weight}/5${q.priority === "required" ? " (required)" : ""}`);
      L.push("");
    });
  }

  // Evidence checklist
  if (evidence.length) {
    L.push(`## Evidence checklist`, "", `Suppliers should return the following artefacts with their response:`, "");
    for (const e of evidence) L.push(`- [ ] ${e.item} (${e.questionIds.length} ${e.questionIds.length === 1 ? "question" : "questions"})`);
    L.push("");
  }

  // Scoring
  L.push(`## Scoring approach`, "");
  L.push(`Responses are scored per question (1–5) multiplied by the question weighting. Mandatory questions are pass/fail gates: a failed mandatory excludes the response regardless of score. Section weighting below reflects the sum of question weights.`, "");
  L.push(`| Section | Questions | Mandatory | Weight share |`, `| --- | --- | --- | --- |`);
  for (const st of stats) L.push(`| ${st.category} | ${st.questionCount} | ${st.mandatoryCount} | ${(st.weightShare * 100).toFixed(0)}% |`);
  L.push("");

  // Submission
  L.push(`## Submission instructions`, "");
  L.push(`- Respond through the Netify marketplace response link provided with this RFP (structured answers per question, evidence uploads, private pricing).`);
  L.push(`- Answer every question; mark any exception explicitly rather than omitting it.`);
  L.push(`- Pricing submitted through the marketplace stays private to the buyer.`);
  if (p.nda.required) L.push(`- An NDA must be accepted before the full requirement detail and response form unlock.`);
  L.push("");

  // Appendix
  L.push(`## Appendix: provenance and review`, "");
  L.push(`- Question sources: Netify question bank v${BANK_VERSION} and the extended SASE canonical bank (${SASE_EXTENDED_BANK.question_bank_version}), plus buyer-specific questions generated from the context above. Question rationale lines carry per-question provenance.`);
  L.push(`- Buyer inputs: scope, sector, estate profile, compliance and notes as recorded in the project background.`);
  L.push(`- Canonical methodology: https://netify.co.uk/methodology/ · Question bank: https://netify.co.uk/sase/rfp-builder/questions/`);
  L.push(`- **Human review required.** This document was assembled with AI assistance. Review every question, weighting and mandatory flag against your actual requirement before issuing to suppliers.`);
  L.push("");

  return L.join("\n");
}
