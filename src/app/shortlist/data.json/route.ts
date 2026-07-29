import { FEATURES, FEATURE_NAMES, getAllVendors, getShortlistDataset } from "@/lib/vendors";
import { buildShortlist, DEFAULT_INPUT } from "@/lib/shortlist-core";
import { SHORTLIST_FAQS, SHORTLIST_INTRO } from "@/lib/shortlist-content";
import { SITE_URL } from "@/lib/structured-data";

/**
 * JSON twin of /shortlist. Same content as the page, structured for machines.
 * AI agents can read the dataset and discover the callable tools here.
 */
export async function GET() {
  const vendors = getShortlistDataset();
  const full = getAllVendors();
  const defaultResult = buildShortlist(vendors, DEFAULT_INPUT, FEATURE_NAMES);

  return Response.json(
    {
      page: `${SITE_URL}/shortlist`,
      title: SHORTLIST_INTRO.h1,
      description: SHORTLIST_INTRO.subhead,
      publisher: "Netify Group Limited",
      // Derived, never hand-typed. The page prose, this field and every
      // record's last_verified were three different dates until 29 July 2026.
      last_reviewed: full.map((v) => v.last_verified).sort().slice(-1)[0],
      evidence: {
        method:
          "Every graded fact carries a named source, a reliability tier and a sentence quoted from that source, confirmed present on the cited page by an independent check.",
        sources_total: full.reduce((n, v) => n + (v.evidence_register?.length ?? 0), 0),
        sources_rejected_tier_4: full.reduce(
          (n, v) => n + (v.evidence_register?.filter((e) => e.tier === 4).length ?? 0),
          0,
        ),
        conflicts_documented: full.reduce((n, v) => n + (v.conflicts?.length ?? 0), 0),
      },
      faqs: SHORTLIST_FAQS,
      features: FEATURES,
      vendors,
      default_shortlist: defaultResult,
      interactiveSurfaces: [
        {
          id: "shortlist-builder",
          kind: "filter-ui",
          url: `${SITE_URL}/shortlist`,
          description:
            "Interactive shortlist builder. Filter state is encoded in URL query parameters, so any scenario URL is shareable and citable.",
          backingTool: "build_sase_shortlist",
          inputs:
            "service_model, required_features, preferred_features, required_regions, required_clouds, ai_requirements, disaster_recovery_required, max_deployment_speed, weight_preset, shortlist_size",
        },
        {
          id: "mcp-server",
          kind: "mcp",
          url: `${SITE_URL}/api/mcp`,
          description:
            "JSON-RPC 2.0 MCP server. tools/list returns available tools; tools/call executes build_sase_shortlist, list_sase_vendors or get_sase_vendor_profile.",
        },
      ],
    },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
