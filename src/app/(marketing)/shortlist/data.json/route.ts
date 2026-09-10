import { FEATURES, FEATURE_NAMES } from "@/lib/vendors";
import { buildShortlist, DEFAULT_INPUT } from "@/lib/shortlist-core";
import { SHORTLIST_FAQS, SHORTLIST_INTRO } from "@/lib/shortlist-content";
import { SITE_URL } from "@/lib/structured-data";
import { GOVERNED_SHORTLIST_CONTRACT_VERSION } from "@/lib/governed-provider-catalogue";
import { getLiveShortlistDataset, LIVE_SHORTLIST_CONTRACT_VERSION } from "@/lib/live-shortlist";
import { createHash } from "node:crypto";
import { buildShortlistMarketView, SHORTLIST_VIEW_CONTRACT_VERSION, SHORTLIST_VIEW_KEYS, SHORTLIST_VIEWS } from "@/lib/shortlist-market-views";

/**
 * JSON twin of /shortlist. Same content as the page, structured for machines.
 * AI agents can read the dataset and discover the callable tools here.
 */
export async function GET(request: Request) {
  const live = await getLiveShortlistDataset();
  const vendors = live.vendors;
  const lastModified = vendors.map((provider) => provider.last_verified).sort().slice(-1)[0] ?? '2026-09-02';
  const defaultResult = buildShortlist(vendors, { ...DEFAULT_INPUT, shortlist_size: vendors.length }, FEATURE_NAMES);

  const generatedAt = new Date(`${lastModified}T00:00:00.000Z`).toISOString();
  const payload = {
      page: `${SITE_URL}/shortlist/`,
      title: SHORTLIST_INTRO.h1,
      description: SHORTLIST_INTRO.subhead,
      publisher: "Netify Group Limited",
      contract_version: GOVERNED_SHORTLIST_CONTRACT_VERSION,
      market_view_contract_version: SHORTLIST_VIEW_CONTRACT_VERSION,
      source_contract_version: LIVE_SHORTLIST_CONTRACT_VERSION,
      provider_contract_version: live.providerContractVersion,
      runtime_provider_source: live.source,
      provider_dataset_versions: live.datasetVersions,
      provider_loaded_at: generatedAt,
      generated_at: generatedAt,
      last_reviewed: vendors.map((provider) => provider.last_verified).sort().slice(-1)[0],
      evidence: {
        method:
          "Each public provider profile is a reviewed projection of the governed provider record. Capability states distinguish supported, partial, partner-delivered, unsupported, unknown and requires-confirmation evidence.",
        sources_total: vendors.reduce((n, provider) => n + (provider.evidence_source_count ?? 0), 0),
      },
      faqs: SHORTLIST_FAQS,
      features: FEATURES,
      vendors,
      governed_provider_profiles: vendors.map((provider) => ({
        comparison_slug: provider.slug,
        name: provider.name,
        provider_types: provider.category.split(" / "),
        summary: provider.shortlist_summary,
        reviewed_at: provider.last_verified,
        products: provider.product_focus?.split(", ") ?? [],
        evidence_source_count: provider.evidence_source_count ?? 0,
        url: provider.marketplace_url,
      })),
      top_providers_at_balanced_setting: defaultResult.shortlist.slice(0, 10),
      market_views: Object.fromEntries(SHORTLIST_VIEW_KEYS.map((view) => [view, {
        label: SHORTLIST_VIEWS[view].label,
        title: SHORTLIST_VIEWS[view].title,
        answer: SHORTLIST_VIEWS[view].answer,
        url: view === "all" ? `${SITE_URL}/shortlist/` : `${SITE_URL}/shortlist/${view}/`,
        ranking: buildShortlistMarketView(vendors, view),
      }])),
      default_shortlist: { ...defaultResult, generated_at: generatedAt },
      interactiveSurfaces: [
        {
          id: "shortlist-builder",
          kind: "filter-ui",
          url: `${SITE_URL}/shortlist/`,
          description:
            "Public provider comparison builder. Filter state is encoded in URL query parameters, so any scenario URL is shareable and citable.",
          backingTool: "build_sase_shortlist",
          inputs:
            "service_model, required_features, preferred_features, required_regions, required_clouds, ai_requirements, disaster_recovery_required, max_deployment_speed, weight_preset, shortlist_size",
        },
        {
          id: "mcp-server",
          kind: "mcp",
          url: `${SITE_URL}/api/mcp/`,
          description:
            "JSON-RPC 2.0 MCP server. tools/list returns available tools; tools/call provides public comparisons and aggregate coverage. Personalised matches require verified project publication.",
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
      distributions: {
        json: `${SITE_URL}/shortlist/data.json`,
        csv: `${SITE_URL}/shortlist/data.csv`,
      },
  };
  const body = JSON.stringify(payload);
  const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Last-Modified": new Date(lastModified).toUTCString(),
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers });
}
