import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp-tool-definitions';
import { SOURCING_TOOL_DEFINITIONS } from '@/lib/mcp-sourcing-tools';
import { SOURCING_TITLE,SOURCING_DESCRIPTION,COMMISSION_DESCRIPTION } from '@/lib/sourcing-contract';
import { SITE_URL } from '@/lib/structured-data';
export async function GET(){return new Response(`# ${SOURCING_TITLE}

${SOURCING_DESCRIPTION}
${COMMISSION_DESCRIPTION}

Research: ${SITE_URL}/shortlist/data.json
Service: ${SITE_URL}/shortlist/
Market Record: ${SITE_URL}/shortlist/market-record.json/
MCP: ${SITE_URL}/api/mcp/

Read-only evidence matching is open. Requests to share a buyer brief require request-specific identity confirmation, approved recipients and desk review. No account or public listing is required.

${[...SOURCING_TOOL_DEFINITIONS,...MCP_TOOL_DEFINITIONS].map(t=>`- ${t.name}: ${t.description}`).join('\n')}`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});}
