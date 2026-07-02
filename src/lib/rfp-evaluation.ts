/**
 * Independent evidence cross-check. The defensible bit: because Netify
 * already grades these vendors against the same 40 features the RFP
 * questions map to, a supplier's self-reported answer can be checked
 * against Netify's independent grade. A generic RFP tool cannot do this.
 */

import { getShortlistDataset, getAllVendorSlugs } from "@/lib/vendors";
import { STATUS_LABELS, type CapabilityStatus } from "@/lib/shortlist-core";
import { saseExtendedQuestions } from "@/lib/rfp-question-bank";
import type { ProjectDetails, RfpResponse } from "@/lib/rfp-types";

/** Loose match a supplier-entered org name to a known matrix vendor slug. */
export function matchVendorSlug(name: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(name);
  if (!target) return null;
  const ds = getShortlistDataset();
  for (const v of ds) {
    const vn = norm(v.name);
    if (vn === target || vn.includes(target) || target.includes(norm(v.slug)) || target.includes(vn)) return v.slug;
  }
  // token overlap fallback
  const tokens = name.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  for (const v of ds) {
    const vl = v.name.toLowerCase();
    if (tokens.some((t) => vl.includes(t))) return v.slug;
  }
  return null;
}

const ASSERTS_CAPABILITY = /\b(yes|fully|native|supported|we (do|support|provide|offer)|included|out of the box|standard|certified)\b/i;
const STRONG_GRADES: CapabilityStatus[] = ["yes"];

export type AnswerCheck = {
  question_id: string;
  feature_id: string;
  question: string;
  answer: string;
  independent_grade: CapabilityStatus | "unknown";
  grade_label: string;
  flag: "supported" | "claim_exceeds_evidence" | "no_answer" | "not_graded" | "red_flag" | "missing_evidence";
  note: string;
};

export type ResponseEvaluation = {
  vendor: string;
  vendor_slug: string | null;
  answered: number;
  total: number;
  flags: number;           // total concerns (claim-vs-grade + red flags + missing evidence)
  red_flags: number;       // answers matching a known red-flag pattern from the bank
  missing_evidence: number; // answered questions that never reference the requested evidence
  weighted_coverage: number; // 0..1: weight of cleanly answered questions / total weight
  checks: AnswerCheck[];
};

/* ---- Extended-bank metadata checks (recovered Base44 bank, 2026-07-02) ---- */

const extendedById = new Map(saseExtendedQuestions().map((q) => [q.question_id, q]));

/**
 * Does the answer match a known red-flag pattern for this question?
 * Deliberately conservative to avoid false accusations: both sides are
 * normalised (lowercase, punctuation collapsed to spaces) and the whole
 * phrase must appear contiguously. "VPN-only access model" therefore matches
 * "our vpn only access model", but an answer that merely contains the common
 * words "access" and "model" somewhere does not. A red flag is a prompt for
 * the buyer to dig, never an automatic disqualification.
 */
function normalisePhrase(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchRedFlag(answer: string, redFlags: string[]): string | null {
  const a = ` ${normalisePhrase(answer)} `;
  for (const rf of redFlags) {
    const phrase = normalisePhrase(rf);
    if (phrase && a.includes(` ${phrase} `)) return rf;
  }
  return null;
}

/** Does the answer reference any of the evidence artefacts the question asked for? */
function referencesEvidence(answer: string, evidenceRequested: string): boolean {
  const a = answer.toLowerCase();
  const generic = ["diagram", "attach", "appendix", "enclosed", "document", "report", "matrix", "schedule", "runbook", "policy", "sample", "list", "extract", "reference", "case study", "certification", "rate card", "see our", "provided in"];
  if (generic.some((g) => a.includes(g))) return true;
  // Or any significant token from the specific evidence items.
  const tokens = evidenceRequested.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 4);
  return tokens.some((t) => a.includes(t));
}

export function evaluateResponse(project: ProjectDetails, response: RfpResponse): ResponseEvaluation {
  const slug = response.vendor_slug ?? matchVendorSlug(response.vendor);
  const vendor = slug ? getShortlistDataset().find((v) => v.slug === slug) : undefined;
  const activeQs = project.rfp_sections
    .filter((s) => s.included)
    .flatMap((s) => s.questions.filter((q) => q.priority !== "optional"));

  const checks: AnswerCheck[] = [];
  for (const q of activeQs) {
    const answer = (response.answers[q.id] ?? "").trim();
    const grade = (vendor && q.feature_id !== "custom" ? vendor.capabilities[q.feature_id] : undefined) as CapabilityStatus | undefined;
    const gradeLabel = grade ? STATUS_LABELS[grade] : "no independent grade";
    const ext = extendedById.get(q.id);
    let flag: AnswerCheck["flag"];
    let note = "";
    if (!answer) {
      flag = "no_answer";
      note = "No response provided.";
    } else if ((() => {
      // Bank red-flag patterns first: a known weak answer outranks grade consistency.
      const rf = ext ? matchRedFlag(answer, ext.red_flag_answers) : null;
      if (rf) { note = `Matches a known red-flag pattern from the Netify question bank: "${rf}". ${ext?.follow_up_questions[0] ?? "Ask for specifics before accepting."}`; return true; }
      return false;
    })()) {
      flag = "red_flag";
    } else if (!vendor || !grade) {
      flag = "not_graded";
      note = "No Netify independent grade for this vendor or feature; verify via the requested evidence.";
    } else if (ASSERTS_CAPABILITY.test(answer) && !STRONG_GRADES.includes(grade)) {
      flag = "claim_exceeds_evidence";
      note = `Response asserts capability, but Netify's independent grade is "${gradeLabel}". Request the supporting evidence before accepting.`;
    } else {
      flag = "supported";
      note = grade ? `Consistent with Netify grade "${gradeLabel}".` : "";
    }
    // Evidence reference check on answered questions that asked for artefacts.
    if (answer && q.evidence_requested && (flag === "supported" || flag === "not_graded") && !referencesEvidence(answer, q.evidence_requested)) {
      flag = "missing_evidence";
      note = `${note ? note + " " : ""}The answer never references the requested evidence (${q.evidence_requested}). Ask for the artefacts before scoring.`;
    }
    checks.push({
      question_id: q.id,
      feature_id: q.feature_id,
      question: q.text,
      answer,
      independent_grade: grade ?? "unknown",
      grade_label: gradeLabel,
      flag,
      note,
    });
  }

  const redFlags = checks.filter((c) => c.flag === "red_flag").length;
  const missingEvidence = checks.filter((c) => c.flag === "missing_evidence").length;
  const claimFlags = checks.filter((c) => c.flag === "claim_exceeds_evidence").length;
  // Weighted coverage: weight of cleanly answered questions over total weight.
  const weightById = new Map(activeQs.map((q) => [q.id, q.weight]));
  const totalWeight = activeQs.reduce((n, q) => n + q.weight, 0) || 1;
  const cleanWeight = checks
    .filter((c) => c.flag === "supported" || c.flag === "not_graded")
    .reduce((n, c) => n + (weightById.get(c.question_id) ?? 0), 0);

  return {
    vendor: response.vendor,
    vendor_slug: slug,
    answered: checks.filter((c) => c.flag !== "no_answer").length,
    total: activeQs.length,
    flags: claimFlags + redFlags + missingEvidence,
    red_flags: redFlags,
    missing_evidence: missingEvidence,
    weighted_coverage: cleanWeight / totalWeight,
    checks,
  };
}

export function knownVendorSlugs(): string[] {
  return getAllVendorSlugs();
}
