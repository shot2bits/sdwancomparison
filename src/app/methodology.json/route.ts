import { buildMethodology } from "@/lib/rfp-methodology";
import { corsHeaders } from "@/lib/cors";

export const dynamic = "force-static";

/** Public methodology endpoint. The RFP agent reads this for live reference. */
export async function GET(req: Request) {
  return Response.json(buildMethodology(), {
    headers: { ...corsHeaders(req), "cache-control": "public, max-age=3600" },
  });
}
