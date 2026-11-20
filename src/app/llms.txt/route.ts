import {BUYER_TOOLS} from '@/lib/core-buyer-tools';
import {coreDiscoveryEnabled} from '@/lib/core-host';
import { RESEARCH_METRIC_METHOD } from "@/lib/research-metrics";
import { shortlistEntity } from "@/lib/shortlist-entity";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp-tool-definitions';
import { SOURCING_TOOL_DEFINITIONS } from '@/lib/mcp-sourcing-tools';
import { sourcingUndertaking,SOURCING_TITLE,SOURCING_DESCRIPTION,COMMISSION_DESCRIPTION } from '@/lib/sourcing-contract';
import { SITE_URL } from '@/lib/structured-data';
import { CASE_PAGE_SECTORS, RESEARCH, SECTORS, researchSummarySentence } from '@/lib/workbook-research';
const researchBlock=()=>`## Desk research (updated ${RESEARCH.updated_date})\n${researchSummarySentence()}\nDataset version: ${RESEARCH.dataset_version}\nResearch hub: ${SITE_URL}/research/\nResearch data (JSON): ${SITE_URL}/research/data.json\nPublished list prices (not quotes): ${SITE_URL}/research/list-prices/\n${CASE_PAGE_SECTORS.map(s=>`${SECTORS.find(x=>x.slug===s)?.name} case studies: ${SITE_URL}/research/cases/${s}/`).join('\n')}\nBest providers by sector (cited cases): ${SECTORS.map(s=>`${SITE_URL}/research/sectors/${s.slug}/`).join(' ')}\nProvider evidence: ${SITE_URL}/research/providers/<provider-slug>/\n`;
export async function GET(){const entity=shortlistEntity((await getLiveShortlistDataset()).vendors); return new Response(`${entity.h1}
${entity.count_sentence}
${entity.uk_sentence}

${researchBlock()}
## ${SOURCING_TITLE}
${SOURCING_DESCRIPTION}
${sourcingUndertaking()}
${COMMISSION_DESCRIPTION}

${RESEARCH_METRIC_METHOD}
Methodology: ${SITE_URL}/shortlist/research-methodology/

Research: ${SITE_URL}/shortlist/data.json
Service: ${SITE_URL}/shortlist/
Market Record: ${SITE_URL}/shortlist/market-record.json/
MCP: ${SITE_URL}/api/mcp/

${coreDiscoveryEnabled()?'Public multi-provider evidence and research need no project. Personalised assessment requires a project capability and reviewed site and user requirements. Agent actions stop at preparing a request, without sending. Only a verified owner can approve the exact version in the web view for Netify desk review. No automatic supplier contact or publication. Price lines remain awaiting supplier until an actual quotation exists.':'Read-only evidence matching is open. Requests to share a buyer brief require request-specific identity confirmation, approved recipients and desk review. No account or public listing is required.'}

${(coreDiscoveryEnabled()?BUYER_TOOLS:[...SOURCING_TOOL_DEFINITIONS,...MCP_TOOL_DEFINITIONS]).map(t=>`- ${t.name}: ${t.description}`).join('\n')}`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});}
