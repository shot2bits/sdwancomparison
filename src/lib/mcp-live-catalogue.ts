import {BUYER_TOOLS} from './core-buyer-tools';
import {MARKET_TOOLS} from './marketplace-tools';

/**
 * One list of what the live MCP server offers, read by tools/list, the connector page and the tests.
 * Nothing is typed twice, so the documentation cannot drift from the server.
 */
export const OPEN_CORE_TOOL_NAMES=['list_products_and_features','list_providers','get_provider_evidence','get_research','get_sector_recommendations','list_opportunities','get_opportunity','create_project'];
export type CatalogueGroup='open'|'verified'|'project';
export type CatalogueTool={name:string;description:string;group:CatalogueGroup;readOnly:boolean};
const VERIFIED_OPEN=new Set(['request_access_code','verify_access_code']);
export function liveCatalogue():CatalogueTool[]{
 const market=MARKET_TOOLS.map(t=>({name:t.name,description:t.description,group:(t.access==='buyer'||VERIFIED_OPEN.has(t.name)?'verified':'open') as CatalogueGroup,readOnly:Boolean(t.annotations.readOnlyHint)}));
 const marketNames=new Set(market.map(t=>t.name));
 const core=BUYER_TOOLS.filter(t=>!marketNames.has(t.name)).map(t=>({name:t.name,description:t.description,group:(OPEN_CORE_TOOL_NAMES.includes(t.name)?'open':'project') as CatalogueGroup,readOnly:Boolean(t.annotations.readOnlyHint)}));
 return [...core,...market];
}
