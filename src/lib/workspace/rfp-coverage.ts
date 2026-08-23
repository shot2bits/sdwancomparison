import type { OutlineRow } from "@/lib/workspace/procurement-outline";
import type { SectionQuestionProgress } from "@/lib/workspace/section-question-register";

export const RFP_SECTION_QUESTION_TARGET = 5;

export type RfpSectionCoverage = {
  key: string;
  title: string;
  answered: number;
  target: number;
  remaining: number;
  ready: boolean;
};

export type RfpCoverage = {
  sections: RfpSectionCoverage[];
  readySections: number;
  totalSections: number;
  remainingAnswers: number;
  ready: boolean;
};

/**
 * The RFP quality threshold. This is intentionally independent from the
 * concise-opportunity publish gate: a buyer can enter the market early,
 * while only a document with five populated question records in every
 * included section may call itself RFP-ready.
 */
export function buildRfpCoverage(
  rows: readonly OutlineRow[],
  progressByKey: Readonly<Record<string, SectionQuestionProgress>>,
): RfpCoverage {
  const sections = rows.map((row) => {
    const answered = progressByKey[row.key]?.answered ?? 0;
    const remaining = Math.max(0, RFP_SECTION_QUESTION_TARGET - answered);
    return {
      key: row.key,
      title: row.title,
      answered,
      target: RFP_SECTION_QUESTION_TARGET,
      remaining,
      ready: remaining === 0,
    };
  });
  const readySections = sections.filter((section) => section.ready).length;
  const remainingAnswers = sections.reduce((total, section) => total + section.remaining, 0);
  return {
    sections,
    readySections,
    totalSections: sections.length,
    remainingAnswers,
    ready: sections.length > 0 && readySections === sections.length,
  };
}
