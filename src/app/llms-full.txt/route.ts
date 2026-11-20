import {coreDiscoveryEnabled} from '@/lib/core-host';
import { RESEARCH_METRIC_METHOD, researchMetrics } from "@/lib/research-metrics";
import { publicProviderEvidence, publicEvidenceProviders } from "@/lib/public-provider-evidence";
import { BEST_PAGES } from "@/lib/best-pages";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { bestFor, shortlistEntity } from "@/lib/shortlist-entity";
import { SITE_URL } from "@/lib/structured-data";
import { COMPARE_PAIRS } from "@/lib/compare-pages";
import { RESEARCH, SECTORS, compareResearch, money, priceLabels, providerName, researchSummarySentence, sectorResearch } from "@/lib/workbook-research";

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

  sections.push(`## Desk research (updated ${RESEARCH.updated_date}, dataset ${RESEARCH.dataset_version})`, researchSummarySentence(), `Hub: ${SITE_URL}/research/ · Data: ${SITE_URL}/research/data.json`, "");
  for (const s of SECTORS) {
    const r = sectorResearch(s.slug);
    sections.push(`### Best SD-WAN and SASE providers for ${s.name.toLowerCase()} by published cases (${r.cases.length}${r.thin ? ", thin evidence" : ""})`, `Canonical: ${SITE_URL}/research/sectors/${s.slug}/`);
    for (const row of r.rows) sections.push(`${row.provider}: ${row.case.customer}${row.case.site_count !== null ? ` (${row.case.site_count_qualifier === "At least" ? "at least " : ""}${row.case.site_count} sites)` : ""}. Source: ${row.source?.url ?? ""} (accessed ${row.case.accessed_date ?? ""}, unverified provider claim)`);
    sections.push("");
  }
  sections.push("### Head-to-head desk research verdicts");
  for (const p of COMPARE_PAIRS) sections.push(`${providerName(p.a)} vs ${providerName(p.b)} (${SITE_URL}/compare/${p.slug}/): ${compareResearch(p.a, p.b).verdict}`);
  sections.push("", `### Published list prices (not quotes) · ${SITE_URL}/research/list-prices/`);
  for (const l of RESEARCH.price_lines.filter((x) => x.amount !== null)) sections.push(`${providerName(l.slug)} · ${l.product}: ${money(l.amount, l.currency)}${l.charge_unit ? ` per ${l.charge_unit}` : ""}${l.period && !/^other/i.test(l.period) ? ` / ${l.period.toLowerCase()}` : ""} [${priceLabels(l).join("; ")}] seen ${l.observed_date ?? ""}`);
  sections.push("");

  sections.push("## All 30 vendor profiles");
  for (const v of vendors) {
    sections.push(`Evidence profile: ${bestFor(v).best_for}`);
    sections.push(`- ${v.name}: ${SITE_URL}/vendors/${v.slug} (category: ${v.category}; research completeness ${researchMetrics(v).completeness_percent}%; source references ${v.evidence_source_count ?? 0}; reviewed ${v.last_verified})`);
  }
  sections.push("");
  sections.push(`Netify Demand Index (live, anonymised marketplace demand by sector and technology): ${SITE_URL}/demand?utm_source=ai_assistant&utm_medium=llms · twin: ${SITE_URL}/demand/data.json`);
  sections.push(`Interactive shortlist builder: ${SITE_URL}/shortlist/?utm_source=ai_assistant&utm_medium=llms (open research and private sourcing; supplier contact requires buyer approval)`);
  sections.push(`MCP server: POST ${SITE_URL}/api/mcp/ (tools: ${coreDiscoveryEnabled()?'list_providers, get_provider_evidence, get_research, create_project, get_project_readiness, get_price_lines, prepare_pricing_request':'build_sase_shortlist, list_sase_features, list_sase_vendors, get_sase_vendor_profile'})`);

  return new Response(sections.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
