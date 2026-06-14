/**
 * Reactive bid review (Slice 1). When a supplier submits a response, the agent
 * reviews it without the buyer prompting: scores coverage, runs evidence-based
 * checks, cross-checks supplier claims against Netify's independent grades,
 * adds an LLM quality judgement (kept separate), flags gaps, drafts
 * clarification questions, and queues them for approval. It sends nothing.
 *
 * Two layers, deliberately separated (the guardrail):
 *   1. Evidence layer  - deterministic, no model: coverage, hedging detection,
 *      claim-vs-grade. Reproducible and defensible.
 *   2. Judgement layer  - one bounded LLM call for qualitative assessment,
 *      clearly labelled as model opinion, degrades to null without an API key.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getVendor, STATUS_LABELS } from "@/lib/vendors";
import { regulation } from "@/lib/rfp-compliance";
import { newId } from "@/lib/rfp-store";
import { saveReview, proposeApproval, recordAudit } from "@/lib/agent-store";
import type { ProcurementGoal } from "@/lib/agent-types";
import {
  type BidReview, type EvidenceCheck, type ClaimVsGrade, type BidGap, type RiskFlag,
} from "@/lib/agent-types";
import type { ProjectDetails, RfpResponse, RfpQuestion } from "@/lib/rfp-types";

const MODEL = "claude-haiku-4-5-20251001";

// Netify grades that count as a genuine, native capability. Anything else means
// a supplier "yes" outruns the independent evidence.
const STRONG_GRADES = new Set(["yes", "native", "full"]);
// Hedging language that signals a weak or non-committal answer to a hard need.
const HEDGE = /\b(roadmap|planned|future|not currently|tbc|to be confirmed|via partner|partner-delivered|coming soon|in development|under consideration)\b/i;
const AFFIRMATIVE = /\b(yes|fully|native|natively|supported|out of the box|included|standard)\b/i;

function answeredText(resp: RfpResponse, qid: string): string {
  return (resp.answers[qid] ?? "").trim();
}

function requiredQuestions(project: ProjectDetails): { q: RfpQuestion; category: string }[] {
  const out: { q: RfpQuestion; category: string }[] = [];
  for (const s of project.rfp_sections) {
    if (!s.included) continue;
    for (const q of s.questions) {
      if (q.priority === "required" || q.mandatory) out.push({ q, category: s.category });
    }
  }
  return out;
}

/* ---------- Layer 1: deterministic evidence checks ---------- */

function evidenceLayer(project: ProjectDetails, resp: RfpResponse, goal: ProcurementGoal | null) {
  const required = requiredQuestions(project);
  const answeredCount = required.filter(({ q }) => answeredText(resp, q.id).length > 0).length;
  const coverage = required.length ? answeredCount / required.length : 1;

  const checks: EvidenceCheck[] = [];
  checks.push({
    key: "mandatory_coverage",
    label: "Required questions answered",
    pass: coverage >= 0.999,
    detail: `${answeredCount} of ${required.length} required questions answered (${Math.round(coverage * 100)}%).`,
  });

  // must_have coverage from the goal. A must-have can be a single feature id, a
  // question id, or a compliance key (e.g. pci_dss, dora). Compliance keys are
  // resolved through the regulation engine to the methodology features that
  // evidence them, and coverage is measured against every answered question in
  // the RFP, not only the required ones, so the check is meaningful before we
  // let autonomous chasing or risk alerts depend on it.
  if (goal?.must_have.length) {
    const answeredFeatures = new Set<string>();
    for (const s of project.rfp_sections) {
      if (!s.included) continue;
      for (const q of s.questions) if (answeredText(resp, q.id).length > 0) answeredFeatures.add(q.feature_id);
    }
    for (const mh of goal.must_have) {
      const reg = regulation(mh);
      if (reg) {
        const feats = reg.required_features;
        const addressed = feats.filter((f) => answeredFeatures.has(f));
        const missing = feats.filter((f) => !answeredFeatures.has(f));
        checks.push({
          key: `must_have:${mh}`,
          label: `Compliance must-have: ${reg.label}`,
          pass: feats.length > 0 && missing.length === 0,
          detail: feats.length
            ? `${addressed.length} of ${feats.length} evidencing features answered${missing.length ? ` (missing: ${missing.join(", ")})` : ""}.`
            : "Regulation has no mapped evidencing features.",
        });
      } else {
        const matched = required.find(({ q }) => q.feature_id === mh || q.id === mh) ?? null;
        const answered = matched ? answeredText(resp, matched.q.id).length > 0 : answeredFeatures.has(mh);
        checks.push({
          key: `must_have:${mh}`,
          label: `Must-have addressed: ${mh}`,
          pass: answered,
          detail: matched
            ? (answered ? "Answered." : "Not answered in this bid.")
            : (answered ? "Answered (non-required question)." : "No matching question in the RFP."),
        });
      }
    }
  }

  // Claim vs Netify grade. The supplier claim and Netify's independent grade are
  // held in separate fields so the buyer always sees which is which.
  const claims: ClaimVsGrade[] = [];
  const slug = resp.vendor_slug;
  if (slug) {
    let vendorCaps: Record<string, string> | null = null;
    try { vendorCaps = (getVendor(slug).capabilities as Record<string, string>) ?? null; } catch { vendorCaps = null; }
    if (vendorCaps) {
      for (const { q } of required) {
        const ans = answeredText(resp, q.id);
        if (!ans || !q.feature_id || q.feature_id === "custom") continue;
        const grade = vendorCaps[q.feature_id] ?? "unknown";
        const supplierAffirms = AFFIRMATIVE.test(ans);
        const overreach = supplierAffirms && !STRONG_GRADES.has(grade);
        if (overreach || grade === "unknown") {
          claims.push({
            feature_id: q.feature_id,
            feature_name: q.text.slice(0, 80),
            supplier_claim: ans.slice(0, 200),
            netify_grade: STATUS_LABELS[grade] ?? grade,
            overreach,
            note: overreach
              ? "Supplier asserts capability that Netify's independent grade does not fully support. Ask for evidence."
              : "Netify has no independent grade for this feature; supplier claim is unverified.",
          });
        }
      }
    }
  }

  return { coverage, required, checks, claims };
}

/* ---------- Gap synthesis + drafted clarifications (deterministic) ---------- */

function buildGaps(
  project: ProjectDetails, resp: RfpResponse,
  required: { q: RfpQuestion; category: string }[], claims: ClaimVsGrade[],
): BidGap[] {
  const gaps: BidGap[] = [];
  for (const { q, category } of required) {
    const ans = answeredText(resp, q.id);
    if (!ans) {
      gaps.push({
        question_id: q.id, feature_id: q.feature_id, category, kind: "unanswered",
        detail: `No answer provided for a required question: "${q.text.slice(0, 120)}".`,
        drafted_clarification: `Your response did not cover "${q.text}". Please confirm your capability and provide evidence (${q.evidence_requested || "documentation or references"}).`,
      });
    } else if (HEDGE.test(ans)) {
      gaps.push({
        question_id: q.id, feature_id: q.feature_id, category, kind: "non_committal",
        detail: `Answer uses hedging language on a required item: "${ans.slice(0, 120)}".`,
        drafted_clarification: `On "${q.text}", your answer suggests this is partner-delivered or on the roadmap. Please clarify what is available today versus planned, with timelines and any dependencies.`,
      });
    }
  }
  for (const c of claims.filter((x) => x.overreach)) {
    gaps.push({
      question_id: "", feature_id: c.feature_id, category: "", kind: "overreach",
      detail: `Claim on ${c.feature_name} exceeds Netify's independent grade (${c.netify_grade}).`,
      drafted_clarification: `You state native support for "${c.feature_name}". Our independent assessment grades this as "${c.netify_grade}". Please provide specific evidence (architecture, documentation, customer references) that demonstrates native capability.`,
    });
  }
  return gaps;
}

/* ---------- Layer 2: LLM judgement (separate, optional) ---------- */

async function judgementLayer(project: ProjectDetails, resp: RfpResponse, goal: ProcurementGoal | null): Promise<{ summary: string; score: number | null }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { summary: "LLM judgement unavailable (no API key). Evidence-based checks above stand on their own.", score: null };
  }
  const required = requiredQuestions(project).slice(0, 25);
  const qa = required.map(({ q }) => `Q (${q.feature_id}): ${q.text}\nA: ${answeredText(resp, q.id) || "[no answer]"}`).join("\n\n");
  const goalLine = goal?.outcome ? `Buyer goal: ${goal.outcome}. Must-haves: ${goal.must_have.join(", ") || "none stated"}.` : "No explicit buyer goal stated.";
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: "You are a procurement analyst giving a qualitative second opinion on a supplier's RFP response. This is model judgement, separate from the deterministic evidence checks already computed. Be sceptical and specific. Do not invent facts. Output a tight assessment (max 120 words) of overall response quality against the buyer goal, then on a final line 'SCORE: n' where n is 0 to 100.",
      messages: [{ role: "user", content: `${goalLine}\n\nSupplier: ${resp.vendor}.\n\nResponse:\n${qa}` }],
    });
    const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join(" ").trim();
    const m = text.match(/SCORE:\s*(\d{1,3})/i);
    const score = m ? Math.max(0, Math.min(100, Number(m[1]))) : null;
    const summary = text.replace(/SCORE:\s*\d{1,3}/i, "").trim();
    return { summary: summary || "No summary produced.", score };
  } catch {
    return { summary: "LLM judgement failed to run; evidence-based checks above are unaffected.", score: null };
  }
}

/* ---------- Risk flags (surfaced, not auto-actioned in Slice 1) ---------- */

export function computeRiskFlags(project: ProjectDetails, allResponseCount: number, review: BidReview, goal: ProcurementGoal | null): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const minBids = goal?.targets.min_bids ?? 3;
  if (allResponseCount < minBids) {
    flags.push({
      kind: "single_bidder", severity: allResponseCount <= 1 ? "high" : "warn",
      message: `Only ${allResponseCount} bid(s) received against a target of ${minBids}.`,
      recommendation: "Consider inviting additional matching suppliers before evaluating.",
    });
  }
  if (review.coverage_ratio < 0.8) {
    flags.push({
      kind: "weak_field", severity: review.coverage_ratio < 0.5 ? "high" : "warn",
      message: `${review.vendor} answered only ${Math.round(review.coverage_ratio * 100)}% of required questions.`,
      recommendation: "Request a completed response covering the unanswered required items.",
    });
  }
  if (review.claim_vs_grade.some((c) => c.overreach)) {
    flags.push({
      kind: "claim_overreach", severity: "warn",
      message: `${review.vendor} makes claims that exceed Netify's independent grade on ${review.claim_vs_grade.filter((c) => c.overreach).length} feature(s).`,
      recommendation: "Approve the drafted clarification questions to request supporting evidence.",
    });
  }
  return flags;
}

/* ---------- Orchestrator ---------- */

export async function reviewBid(project: ProjectDetails, resp: RfpResponse, goal: ProcurementGoal | null, allResponseCount: number): Promise<{ review: BidReview; risks: RiskFlag[]; proposed: number }> {
  const { coverage, required, checks, claims } = evidenceLayer(project, resp, goal);
  const gaps = buildGaps(project, resp, required, claims);
  const judgement = await judgementLayer(project, resp, goal);

  const review: BidReview = {
    id: newId("rev"),
    rfp_id: project.id,
    response_id: resp.id,
    vendor: resp.vendor,
    vendor_slug: resp.vendor_slug,
    coverage_ratio: coverage,
    evidence_checks: checks,
    claim_vs_grade: claims,
    llm_quality_summary: judgement.summary,
    llm_score: judgement.score,
    gaps,
    goal_fit_note: goal?.outcome
      ? `Reviewed against goal: "${goal.outcome}".`
      : "No procurement goal set; reviewed against the RFP's required questions only.",
    created: Date.now(),
  };
  await saveReview(review);
  await recordAudit({
    rfp_id: project.id, action: "bid_review",
    summary: `Reviewed ${resp.vendor}'s bid: ${Math.round(coverage * 100)}% coverage, ${gaps.length} gap(s), ${claims.filter((c) => c.overreach).length} claim overreach(es).`,
    rationale: "Reactive review triggered by supplier bid submission. Evidence checks are deterministic; LLM judgement is a separate, labelled second opinion.",
    ref: review.id,
  });

  // Queue each gap as a gated clarification proposal. Nothing is sent.
  let proposed = 0;
  for (const g of gaps) {
    const created = await proposeApproval({
      rfp_id: project.id, kind: "send_clarification",
      vendor_slug: resp.vendor_slug ?? "", vendor_name: resp.vendor,
      summary: `Clarification for ${resp.vendor}: ${g.kind.replace("_", " ")}${g.feature_id ? ` (${g.feature_id})` : ""}`,
      payload: { question: g.drafted_clarification, feature_id: g.feature_id, gap_kind: g.kind },
      rationale: g.detail,
      source_review_id: review.id,
    });
    if (created) proposed++;
  }

  const risks = computeRiskFlags(project, allResponseCount, review, goal);
  for (const r of risks) {
    await recordAudit({ rfp_id: project.id, action: "risk_flag", summary: r.message, rationale: r.recommendation, ref: r.kind });
  }

  return { review, risks, proposed };
}
