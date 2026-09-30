import { SOURCING_DESCRIPTION } from "@/lib/sourcing-contract";
import { SITE_URL } from "@/lib/structured-data";
import { peplinkContext, getPeplinkEvidence } from "../content";
export const dynamic = "force-static";
export function GET() {
  const result = getPeplinkEvidence();
  return Response.json({
    page: `${SITE_URL}/alternatives/peplink/`,
    title: "Top Peplink alternatives (2026): provider evidence",
    subject_vendor: { slug: "peplink", name: "Peplink", included_in_matching_catalogue: false },
    context: peplinkContext,
    ordered_by: result.ordered_by,
    result,
    evaluate: { url: "https://netify.co.uk/sase-sd-wan-rfp-builder/", description: SOURCING_DESCRIPTION },
  }, { headers: { "X-Robots-Tag": "noindex" } });
}
