import { QUESTION_BANK } from "@/lib/rfp-question-bank";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-static";

/** Public question bank endpoint: the curated analyst questions, agent-readable. */
export async function GET(req: Request) {
  return Response.json(
    { ...QUESTION_BANK, publisher: "Netify Group Limited", note: "Analyst-written SASE and SD-WAN RFP question bank with buyer and supplier lenses." },
    { headers: { ...corsHeaders(req), "cache-control": "public, max-age=3600" } },
  );
}
