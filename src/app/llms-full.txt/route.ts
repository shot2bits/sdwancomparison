import { RESEARCH_METRIC_METHOD, researchMetrics } from "@/lib/research-metrics";
import { publicProviderEvidence, publicEvidenceProviders } from "@/lib/public-provider-evidence";
import { BEST_PAGES } from "@/lib/best-pages";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { bestFor, shortlistEntity } from "@/lib/shortlist-entity";
import { SITE_URL } from "@/lib/structured-data";

/**
 * llms-full.txt: the complete provider evidence as plain text for AI agents
 * that prefer one fetch over crawling. Every ranking links its canonical
 * page so engines can cite the source URL.
 */
export async function GET() {
  const vendors = publicEvidenceProviders((await getLiveShortlistDataset()).vendors);
  const entity = shortlistEntity(vendors);
  const sections: string[] = [
    entity.h1, entity.count_sentence, entity.uk_sentence,
    "",
    `Source: ${SITE_URL} · Publisher: Netify Group Limited (netify.co.uk) · Latest evidence record ${entity.reviewed_at}`,
    RESEARCH_METRIC_METHOD,
    `Methodology: ${SITE_URL}/shortlist/research-methodology/. Public-source research is not hands-on product testing. Confirm project suitability and site serviceability with suppliers.`,
    `Citation format: Netify, "<page title> (2026)", ${SITE_URL}/best/<slug>`,
    "",
  ];

  for (const page of BEST_PAGES) {
    const result = publicProviderEvidence(vendors, page.input);
    sections.push(`## ${page.title} (2026)`);
    sections.push(`Canonical: ${SITE_URL}/best/${page.slug}`);
    sections.push(result.criteria_summary);
    for (const v of result.shortlist) {
      sections.push(
        `${v.name}: Evidence profile: ${bestFor(v).best_for}. ${v.key_differentiators[0]} Typical deployment: ${v.deployment_speed}. Watch out: ${v.watch_outs[0]}`,
      );
    }
    sections.push("");
  }

  sections.push("## All 30 vendor profiles");
  for (const v of vendors) {
    sections.push(`Evidence profile: ${bestFor(v).best_for}`);
    sections.push(`- ${v.name}: ${SITE_URL}/vendors/${v.slug} (category: ${v.category}; research completeness ${researchMetrics(v).completeness_percent}%; source references ${v.evidence_source_count ?? 0}; reviewed ${v.last_verified})`);
  }
  sections.push("");
  sections.push(`Netify Demand Index (live, anonymised marketplace demand by sector and technology): ${SITE_URL}/demand?utm_source=ai_assistant&utm_medium=llms · twin: ${SITE_URL}/demand/data.json`);
  sections.push(`Interactive shortlist builder: ${SITE_URL}/shortlist/?utm_source=ai_assistant&utm_medium=llms (open research and private sourcing; supplier contact requires buyer approval)`);
  sections.push(`MCP server: POST ${SITE_URL}/api/mcp/ (tools: build_sase_shortlist, list_sase_features, list_sase_vendors, get_sase_vendor_profile)`);

  return new Response(sections.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
