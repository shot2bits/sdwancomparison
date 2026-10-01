import { RESEARCH_METRIC_METHOD } from "@/lib/research-metrics";
import { shortlistEntity } from "@/lib/shortlist-entity";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp-tool-definitions';
import { SOURCING_TOOL_DEFINITIONS } from '@/lib/mcp-sourcing-tools';
import { sourcingUndertaking,SOURCING_TITLE,SOURCING_DESCRIPTION,COMMISSION_DESCRIPTION } from '@/lib/sourcing-contract';
import { SITE_URL } from '@/lib/structured-data';
export async function GET(){const entity=shortlistEntity((await getLiveShortlistDataset()).vendors); return new Response(`${entity.h1}
${entity.count_sentence}
${entity.uk_sentence}

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

Read-only evidence matching is open. Requests to share a buyer brief require request-specific identity confirmation, approved recipients and desk review. No account or public listing is required.

${[...SOURCING_TOOL_DEFINITIONS,...MCP_TOOL_DEFINITIONS].map(t=>`- ${t.name}: ${t.description}`).join('\n')}`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});}
