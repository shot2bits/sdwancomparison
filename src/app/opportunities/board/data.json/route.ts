import { listPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Machine-readable twin of the public opportunity board. No pricing amounts. */
export async function GET() {
  const opportunities = kvConfigured() ? await listPublicOpportunities() : [];
  return Response.json({
    "@context": "https://schema.org",
    title: "Live SASE, SSE and SD-WAN opportunity board",
    url: `${SITE_URL}/opportunities/board`,
    description: "Open buyer opportunities. Verified vendors bid and quote. Pricing amounts are private to the posting buyer.",
    generated: new Date().toISOString(),
    count: opportunities.length,
    opportunities,
  });
}
