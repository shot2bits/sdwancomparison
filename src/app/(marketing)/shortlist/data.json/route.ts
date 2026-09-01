import { FEATURES, FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { buildShortlist, DEFAULT_INPUT } from "@/lib/shortlist-core";
import { SHORTLIST_FAQS, SHORTLIST_INTRO } from "@/lib/shortlist-content";
import { SITE_URL } from "@/lib/structured-data";
import { getGovernedProviderSummaries, GOVERNED_SHORTLIST_CONTRACT_VERSION, GOVERNED_SOURCE_VERSION } from "@/lib/governed-provider-catalogue";

/**
 * JSON twin of /shortlist. Same content as the page, structured for machines.
 * AI agents can read the dataset and discover the callable tools here.
 */
export async function GET() {
  const vendors = getShortlistDataset();
  const defaultResult = buildShortlist(vendors, DEFAULT_INPUT, FEATURE_NAMES);
  const governedProviders = getGovernedProviderSummaries();

  return Response.json(
    {
      page: `${SITE_URL}/shortlist/`,
      title: SHORTLIST_INTRO.h1,
      description: SHORTLIST_INTRO.subhead,
      publisher: "Netify Group Limited",
      contract_version: GOVERNED_SHORTLIST_CONTRACT_VERSION,
      source_contract_version: GOVERNED_SOURCE_VERSION,
      last_reviewed: governedProviders.map((provider) => provider.reviewedAt).sort().slice(-1)[0],
      evidence: {
        method:
          "Each public provider profile is a reviewed projection of the governed provider record. Capability states distinguish supported, partial, partner-delivered, unsupported, unknown and requires-confirmation evidence.",
        sources_total: governedProviders.reduce((n, provider) => n + provider.evidenceSourceCount, 0),
      },
      faqs: SHORTLIST_FAQS,
      features: FEATURES,
      vendors,
      governed_provider_profiles: governedProviders.map((provider) => ({
        slug: provider.slug,
        comparison_slug: provider.comparisonSlug,
        name: provider.name,
        provider_types: provider.providerTypes,
        summary: provider.summary,
        reviewed_at: provider.reviewedAt,
        dataset_version: provider.datasetVersion,
        products: provider.products.map((product) => product.name),
        evidence_source_count: provider.evidenceSourceCount,
        independent_evidence_source_count: provider.independentEvidenceSourceCount,
        url: provider.url,
      })),
      default_shortlist: defaultResult,
      interactiveSurfaces: [
        {
          id: "shortlist-builder",
          kind: "filter-ui",
          url: `${SITE_URL}/shortlist/`,
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
        {
          id: "comparison-workspace",
          kind: "agentic-comparison-ui",
          url: `${SITE_URL}/shortlist/?compare=bt-business,vodafone-business&question=Which+provider+best+fits+this+project`,
          contract: "provider-comparison/1.0.0",
          description:
            "Select two providers, calculate their deterministic evidence comparison and ask contextual follow-up questions. The compare query parameter accepts two comma-separated vendor slugs.",
          backingTool: "compare_vendors",
        },
      ],
    },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
