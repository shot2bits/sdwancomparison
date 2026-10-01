import { approvedEditorialReview } from "@/lib/provider-editorial-review";
import { buyerDecisionGuide } from "@/lib/buyer-decision-guide";
import { RESEARCH_METRIC_METHOD } from "@/lib/research-metrics";
import { shortlistFaqs } from "@/lib/shortlist-faq";
import { shortlistEntity, bestFor, ukStatus } from "@/lib/shortlist-entity";
import {publicResponsePanel} from '@/lib/response-panel';
import {annotateResponsePanel,publicPanelMember} from '@/lib/response-panel-contract';
import { SOURCING_TARGET, SOURCING_DESCRIPTION, PUBLIC_SOURCING_TOOLS, COMMISSION_DESCRIPTION } from '@/lib/sourcing-contract';
import { publicEvidenceProviders, publicEvidenceOutput, PUBLIC_EVIDENCE_ORDER, PUBLIC_EVIDENCE_CONTRACT, PUBLIC_EVIDENCE_NOTICE } from "@/lib/public-provider-evidence";
import { UK_BUYING_SITUATIONS, PROVIDER_ROLE_GUIDE } from "@/lib/uk-shortlist";
import { FEATURES } from "@/lib/vendors";
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
  const panel=await publicResponsePanel();
  const vendors = annotateResponsePanel(publicEvidenceProviders(live.vendors),panel);
  const entity = shortlistEntity(vendors);
  const lastModified = entity.reviewed_at;

  const generatedAt = new Date().toISOString();
  const payload = {
      page: `${SITE_URL}/shortlist/`,
      title: entity.h1,
      description: entity.count_sentence,
      publisher: "Netify Group Limited",
      license: "https://creativecommons.org/licenses/by/4.0/",
      contract_version: GOVERNED_SHORTLIST_CONTRACT_VERSION,
      market_view_contract_version: SHORTLIST_VIEW_CONTRACT_VERSION,
      source_contract_version: LIVE_SHORTLIST_CONTRACT_VERSION,
      provider_contract_version: live.providerContractVersion,
      runtime_provider_source: live.source,
      provider_dataset_versions: live.datasetVersions,
      provider_loaded_at: generatedAt,
      generated_at: generatedAt,
      last_reviewed: entity.reviewed_at,
      evidence: {
        research_completeness_method: RESEARCH_METRIC_METHOD,
        source_count_unit: "record references, not unique URLs",
        method:
          "Each public provider profile is a reviewed projection of the governed provider record. Capability states distinguish supported, partial, partner-delivered, unsupported, not-confirmed and requires-confirmation evidence.",
        sources_total: vendors.reduce((n, provider) => n + (provider.evidence_source_count ?? 0), 0),
      },
      buyer_decisions: buyerDecisionGuide(vendors),
      faqs: shortlistFaqs(vendors),
      uk_buyer_guidance: { situations: UK_BUYING_SITUATIONS, provider_roles: PROVIDER_ROLE_GUIDE, notice: "Buying guidance only. A situation does not certify coverage, filter providers or change evidence grades." },
      features: FEATURES,
      entity,
      vendors: vendors.map(v=>({...v,...bestFor(v),editorial:approvedEditorialReview(v),uk_status:ukStatus(v)})),
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
      public_evidence_contract: PUBLIC_EVIDENCE_CONTRACT,
      requires_publication: false,
      ordered_by: PUBLIC_EVIDENCE_ORDER,
      status_vocabulary: { not_confirmed: "Evidence has not been confirmed; not a negative grade." },
      notice: PUBLIC_EVIDENCE_NOTICE,
      market_views: Object.fromEntries(SHORTLIST_VIEW_KEYS.map((view) => [view, {
        ordered_by: PUBLIC_EVIDENCE_ORDER,
        label: SHORTLIST_VIEWS[view].label,
        title: SHORTLIST_VIEWS[view].title,
        answer: SHORTLIST_VIEWS[view].answer,
        url: view === "all" ? `${SITE_URL}/shortlist/` : `${SITE_URL}/shortlist/${view}/`,
        providers: buildShortlistMarketView(vendors, view).map(v=>({...v,...bestFor(v),editorial:approvedEditorialReview(v),uk_status:ukStatus(v)})),
      }])),
      service: {description:SOURCING_DESCRIPTION,commission:COMMISSION_DESCRIPTION, response_target:SOURCING_TARGET, response_panel:panel.map(publicPanelMember), research_requires_identity:false, supplier_disclosure_requires_recipient_consent:true},
      market_record:`${SITE_URL}/shortlist/market-record.json/`,
      interactiveSurfaces: [{id:'sourcing',kind:'sourcing-service',url:`${SITE_URL}/shortlist/`,description:SOURCING_DESCRIPTION}, {id:'mcp-server',kind:'mcp',url:`${SITE_URL}/api/mcp/`,tools:PUBLIC_SOURCING_TOOLS,description:'Open research and request-specific sourcing actions. No account or publication prerequisite. Supplier disclosure requires confirmed buyer identity and recipient consent.'}],
      distributions: {
        json: `${SITE_URL}/shortlist/data.json`,
        csv: `${SITE_URL}/shortlist/data.csv`,
      },
  };
  const body = JSON.stringify(publicEvidenceOutput(payload));
  const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Last-Modified": new Date(lastModified).toUTCString(),
    ETag: etag,
    "Cache-Control": "no-store",
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers });
}
