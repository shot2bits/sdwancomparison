/**
 * Curated Netify question bank (v2026.1): 386 analyst-written questions.
 * A SASE canonical set plus four sector packs, each question carrying the
 * buyer lens and supplier lens that make it usable in a real procurement.
 * This is the content source for the RFP builder, distinct from the
 * 40-feature methodology that powers compliance coverage and scoring.
 *
 * Plus: the extended SASE canonical bank (43 questions), recovered on
 * 2026-07-02 from the retired Base44 app. The 27-question `canonical` set is
 * a condensed port of it; the extended set restores the procurement metadata
 * the port dropped — evidence required, sector applicability (mandatory_for /
 * optional_for), weighting hints, red-flag answers and follow-up questions.
 */

import bank from "@data/rfp-question-bank.json";
import extended from "@data/sase-question-bank-extended-v1.json";

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

/**
 * Extended SASE canonical question.
 * TODO(phase 4): surface these in the RfpBuilder question browser and use
 * evidence_required / red_flag_answers in AI question generation and
 * supplier-response review.
 */
export type ExtendedSaseQuestion = {
  question_id: string;
  category_id: string;
  question: string;
  answer_type: string;
  evidence_required: string[];
  mandatory_for: string[];
  optional_for: string[];
  weighting_hint: string;
  why_it_matters: string;
  red_flag_answers: string[];
  follow_up_questions: string[];
};

export const EXTENDED_CATEGORY_LABELS: Record<string, string> = {
  identity_ztna: "Identity / ZTNA",
  swg_casb_dlp: "SWG / CASB / DLP",
  fwaas_threat: "FWaaS / Threat",
  sdwan_integration: "SD-WAN Integration",
  logging_siem: "Logging / SIEM",
  data_residency: "Data Residency",
  service_model: "Service Model",
  deployment: "Deployment",
  commercials: "Commercials",
  vendor_evidence: "Vendor Evidence",
};

type ExtendedBank = {
  question_bank_version: string;
  methodology_version: string;
  last_reviewed: string;
  provenance: string;
  questions: ExtendedSaseQuestion[];
  citation_note: string;
};

export const SASE_EXTENDED_BANK = extended as unknown as ExtendedBank;

export function saseExtendedQuestions(): ExtendedSaseQuestion[] {
  return SASE_EXTENDED_BANK.questions;
}

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
    sase_extended_count: SASE_EXTENDED_BANK.questions.length,
    sase_extended_version: SASE_EXTENDED_BANK.question_bank_version,
    sector_packs: Object.fromEntries(
      Object.entries(QUESTION_BANK.sector_packs).map(([k, v]) => [k, { label: v.label, count: v.count, sections: v.sections.length }]),
    ),
    total: QUESTION_BANK.canonical.length + Object.values(QUESTION_BANK.sector_packs).reduce((n, p) => n + p.count, 0),
  };
}
