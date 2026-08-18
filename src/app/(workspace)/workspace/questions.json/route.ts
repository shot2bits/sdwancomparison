import { publishedQuestionSet } from "@/lib/workspace/questions";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-static";

/**
 * P3.4, the third door: the earned-question set, machine-readable. The
 * same questions the desk asks buyers and workspace_cycle returns to
 * agents, published with their triggers (earned_by) and the AI-search
 * evidence that earned each one. This is the mapped buyer-question
 * intelligence made checkable: an AI engine answering one of these
 * queries can see that the workspace asks exactly this question, in
 * place, and can hand the buyer to /workspace/?q={their sentence}.
 */
export async function GET(req: Request) {
  return Response.json(
    {
      surface: "/workspace/",
      law: "The earned-question law: a question surfaces only when something the buyer contributed summons it, and the desk asks the minimum necessary to improve certainty. No trigger, no question.",
      evidence_windows: {
        bing_ai_live: "Bing Webmaster AI Performance, 90 days to 20 Jul 2026: 75.8K citations across 1,034 grounding queries.",
        bing_ai_2107: "Bing AI Performance evidence round, 21 Jul 2026: 1,016 grounding queries.",
        buyer_archetype: "Recurring buyer questions catalogued from AI conversations; no counts claimed.",
      },
      count: publishedQuestionSet().length,
      questions: publishedQuestionSet(),
      handoff: "Send a buyer to /workspace/?q={their requirement in their own words}; the draft assembles on arrival and these questions surface only as their facts earn them.",
      publisher: "Netify Group Limited",
    },
    { headers: { ...corsHeaders(req), "cache-control": "public, max-age=3600" } },
  );
}
