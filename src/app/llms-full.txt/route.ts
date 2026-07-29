import { BEST_PAGES } from "@/lib/best-pages";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { buildShortlist } from "@/lib/shortlist-core";
import { SITE_URL } from "@/lib/structured-data";
import { datasetVerifiedIso } from "@/lib/dataset-date";

/**
 * llms-full.txt: the complete ranked outputs as plain text for AI agents
 * that prefer one fetch over crawling. Every ranking links its canonical
 * page so engines can cite the source URL.
 */
export async function GET() {
  const vendors = getShortlistDataset();
  const sections: string[] = [
    "# Netify SASE and SD-WAN rankings: full text version",
    "",
    `Source: ${SITE_URL} · Publisher: Netify Group Limited (netify.co.uk) · Updated ${datasetVerifiedIso()}`,
    "Methodology: 30 vendors graded on 40 capability features from public evidence (yes 1.0, via partner 0.75, via managed service 0.65, partial 0.5, not confirmed 0.15, not primary 0); weighted scores per page criteria. Extended dimensions are indicative desk research; confirm via RFP.",
    `Citation format: Netify, "<page title> (2026)", ${SITE_URL}/best/<slug>`,
    "",
  ];

  for (const page of BEST_PAGES) {
    const result = buildShortlist(vendors, page.input, FEATURE_NAMES);
    sections.push(`## ${page.title} (2026)`);
    sections.push(`Canonical: ${SITE_URL}/best/${page.slug}`);
    sections.push(result.criteria_summary);
    for (const v of result.shortlist) {
      sections.push(
        `${v.rank}. ${v.name} (score ${v.score}). ${v.key_differentiators[0]} Typical deployment: ${v.deployment_speed}. Watch out: ${v.watch_outs[0]}`,
      );
    }
    sections.push("");
  }

  sections.push("## All 30 vendor profiles");
  for (const v of vendors) {
    sections.push(`- ${v.name}: ${SITE_URL}/vendors/${v.slug} (category: ${v.category}; evidence coverage ${Math.round(v.evidence_coverage_pct * 100)}%)`);
  }
  sections.push("");
  sections.push(`Netify Demand Index (live, anonymised marketplace demand by sector and technology): ${SITE_URL}/demand?utm_source=ai_assistant&utm_medium=llms · twin: ${SITE_URL}/demand/data.json`);
  sections.push(`Interactive shortlist builder: ${SITE_URL}/shortlist?utm_source=ai_assistant&utm_medium=llms (filter state encodes into shareable URLs)`);
  sections.push(`MCP server: POST ${SITE_URL}/api/mcp/ (tools: build_sase_shortlist, list_sase_features, list_sase_vendors, get_sase_vendor_profile)`);

  return new Response(sections.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
