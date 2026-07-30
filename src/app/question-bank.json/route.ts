import { QUESTION_BANK, SASE_EXTENDED_BANK, EXTENDED_CATEGORY_LABELS } from "@/lib/rfp-question-bank";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-static";

/**
 * Public question bank endpoint: the curated analyst questions, agent-readable.
 * Includes the extended SASE canonical bank (43 questions with evidence,
 * sector-applicability, weighting, red-flag and follow-up metadata), recovered
 * from the retired Base44 app. The 27-question `canonical` array is retained
 * unchanged for backwards compatibility; `sase_extended` is its richer twin.
 */
export async function GET(req: Request) {
  return Response.json(
    {
      ...QUESTION_BANK,
      sase_extended: {
        version: SASE_EXTENDED_BANK.question_bank_version,
        methodology_version: SASE_EXTENDED_BANK.methodology_version,
        last_reviewed: SASE_EXTENDED_BANK.last_reviewed,
        category_labels: EXTENDED_CATEGORY_LABELS,
        count: SASE_EXTENDED_BANK.questions.length,
        questions: SASE_EXTENDED_BANK.questions,
        note: "Extended SASE canonical bank: each question carries evidence_required, mandatory_for/optional_for sectors, weighting_hint, why_it_matters, red_flag_answers and follow_up_questions. The top-level `canonical` array is a condensed subset kept for compatibility.",
      },
      publisher: "Netify Group Limited",
      note: "Analyst-written SASE and SD-WAN RFP question bank with buyer and vendor lenses.",
    },
    { headers: { ...corsHeaders(req), "cache-control": "public, max-age=3600" } },
  );
}
