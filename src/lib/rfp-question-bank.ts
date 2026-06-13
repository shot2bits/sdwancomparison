/**
 * Curated Netify question bank (v2026.1): 386 analyst-written questions.
 * A SASE canonical set plus four sector packs, each question carrying the
 * buyer lens and supplier lens that make it usable in a real procurement.
 * This is the content source for the RFP builder, distinct from the
 * 40-feature methodology that powers compliance coverage and scoring.
 */

import bank from "@data/rfp-question-bank.json";

export type BankCanonicalQuestion = { id: string; category: string; text: string };
export type BankSectorQuestion = { id: string; text: string; buyer_lens: string; supplier_lens: string; netify_note: string };
export type BankSection = { title: string; questions: BankSectorQuestion[] };
export type BankSectorPack = { label: string; sections: BankSection[]; count: number };

type Bank = {
  version: string;
  canonical: BankCanonicalQuestion[];
  sector_packs: Record<string, BankSectorPack>;
};

export const QUESTION_BANK = bank as Bank;
export const BANK_VERSION = QUESTION_BANK.version;

export function canonicalQuestions(): BankCanonicalQuestion[] {
  return QUESTION_BANK.canonical;
}

export function sectorPack(sectorKey: string): BankSectorPack | null {
  return QUESTION_BANK.sector_packs[sectorKey] ?? null;
}

export function bankSummary() {
  return {
    version: QUESTION_BANK.version,
    canonical_count: QUESTION_BANK.canonical.length,
    sector_packs: Object.fromEntries(
      Object.entries(QUESTION_BANK.sector_packs).map(([k, v]) => [k, { label: v.label, count: v.count, sections: v.sections.length }]),
    ),
    total: QUESTION_BANK.canonical.length + Object.values(QUESTION_BANK.sector_packs).reduce((n, p) => n + p.count, 0),
  };
}
