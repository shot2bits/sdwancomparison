/**
 * Independent evidence cross-check. The defensible bit: because Netify
 * already grades these vendors against the same 40 features the RFP
 * questions map to, a supplier's self-reported answer can be checked
 * against Netify's independent grade. A generic RFP tool cannot do this.
 */

import { getShortlistDataset, getAllVendorSlugs } from "@/lib/vendors";
import { STATUS_LABELS, type CapabilityStatus } from "@/lib/shortlist-core";
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
  flag: "supported" | "claim_exceeds_evidence" | "no_answer" | "not_graded";
  note: string;
};

export type ResponseEvaluation = {
  vendor: string;
  vendor_slug: string | null;
  answered: number;
  total: number;
  flags: number;
  checks: AnswerCheck[];
};

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
    let flag: AnswerCheck["flag"];
    let note = "";
    if (!answer) {
      flag = "no_answer";
      note = "No response provided.";
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

  return {
    vendor: response.vendor,
    vendor_slug: slug,
    answered: checks.filter((c) => c.flag !== "no_answer").length,
    total: activeQs.length,
    flags: checks.filter((c) => c.flag === "claim_exceeds_evidence").length,
    checks,
  };
}

export function knownVendorSlugs(): string[] {
  return getAllVendorSlugs();
}
