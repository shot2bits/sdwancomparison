import type { OutlineRow } from "@/lib/workspace/procurement-outline";

export type SectionQuestionStatus = "completed" | "required" | "suggested" | "custom";

export type SectionQuestionItem = {
  id: string;
  text: string;
  status: SectionQuestionStatus;
  answer?: string;
};

export type SectionQuestionProgress = {
  answered: number;
  required: number;
  optional: number;
};

export const CORE_SECTION_QUESTIONS: Record<string, string> = {
  organisation_scale: "Confirm the organisation, locations and users in scope",
  solution_scope: "Confirm whether the requirement is SASE, SD-WAN, SSE or managed security",
  current_estate: "Describe the network, cloud or security estate in place today",
  resilience_availability: "Confirm the required availability and failover approach",
  security_identity_data: "Confirm which security, identity, data and compliance controls are in scope",
  operating_model_support: "Confirm who will operate the service and the support model required",
  migration_implementation: "Confirm the delivery scope and target timeline",
  commercial_contractual: "Confirm the commercial and contractual requirements",
  success_evaluation: "Confirm how supplier responses and project success will be evaluated",
};

type Evidence = { id: string; sectionKey: string; text: string; answer: string };
type OpenQuestion = { id: string; sectionKey: string; text: string; suggested?: boolean };
type CustomQuestion = { id: string; sectionKey: string; text: string };

/**
 * The single projection used by both the section rail and the active
 * checklist. It deliberately treats a confirmed row as authoritative:
 * additional missing detail is optional refinement, never a hidden reason
 * for the same row to look incomplete elsewhere in the interface.
 */
export function buildSectionQuestionRegister(input: {
  rows: readonly OutlineRow[];
  evidence: readonly Evidence[];
  openQuestions: readonly OpenQuestion[];
  customQuestions: readonly CustomQuestion[];
  requiredQuestions?: Readonly<Record<string, string>>;
}): Record<string, SectionQuestionItem[]> {
  const requiredQuestions = input.requiredQuestions ?? CORE_SECTION_QUESTIONS;
  const byKey: Record<string, SectionQuestionItem[]> = {};

  for (const row of input.rows) {
    const items: SectionQuestionItem[] = input.evidence
      .filter((entry) => entry.sectionKey === row.key)
      .map((entry) => ({ id: `answered:${entry.id}`, text: entry.text, status: "completed", answer: entry.answer }));

    for (const question of input.openQuestions.filter((entry) => entry.sectionKey === row.key)) {
      if (items.some((item) => item.id === `open:${question.id}`)) continue;
      items.push({
        id: `open:${question.id}`,
        text: question.text,
        status: question.suggested ? "suggested" : "required",
      });
    }

    for (const missing of row.missing ?? []) {
      if (items.some((item) => item.status !== "completed" && item.text.toLowerCase().includes(missing.toLowerCase()))) continue;
      items.push({
        id: `missing:${row.key}:${missing}`,
        text: `Confirm ${missing}`,
        status: row.state === "confirmed" ? "suggested" : "required",
      });
    }

    for (const question of input.customQuestions.filter((entry) => entry.sectionKey === row.key)) {
      items.push({ id: question.id, text: question.text, status: "custom" });
    }

    const completed = items.filter((item) => item.status === "completed").length;
    const required = items.filter((item) => item.status === "required").length;
    if (row.state === "confirmed" && completed === 0) {
      items.unshift({
        id: `completed:${row.key}`,
        text: requiredQuestions[row.key] ?? row.title,
        status: "completed",
        answer: row.detail,
      });
    } else if (row.state !== "confirmed" && row.state !== "later" && required === 0) {
      items.push({
        id: `required:${row.key}`,
        text: requiredQuestions[row.key] ?? `Complete ${row.title}`,
        status: "required",
      });
    }

    byKey[row.key] = items;
  }

  return byKey;
}

export function questionProgressBySection(
  rows: readonly OutlineRow[],
  register: Readonly<Record<string, readonly SectionQuestionItem[]>>,
): Record<string, SectionQuestionProgress> {
  return Object.fromEntries(rows.map((row) => {
    const items = register[row.key] ?? [];
    return [row.key, {
      answered: items.filter((item) => item.status === "completed").length,
      required: items.filter((item) => item.status === "required").length,
      optional: items.filter((item) => item.status === "suggested" || item.status === "custom").length,
    }];
  }));
}
