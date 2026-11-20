import {OPEN_TOOLS,MarketError,MARKET_VERSION,type MarketTool,type MarketContext} from './marketplace-mcp';
export {MarketError,MARKET_VERSION};
export type {MarketContext};
/** Single registry the MCP endpoint, REST mirror, OpenAPI and server card all read. */
export const MARKET_TOOLS:MarketTool[]=[...OPEN_TOOLS];
export const MARKET_TOOL_NAMES=new Set(MARKET_TOOLS.map(t=>t.name));
export const publicToolView=(t:MarketTool)=>({name:t.name,title:t.title,description:t.description,inputSchema:t.inputSchema,annotations:t.annotations});
export const MARKET_TOOL_VIEWS=MARKET_TOOLS.map(publicToolView);
export async function callMarketTool(name:string,args:unknown,ctx:MarketContext){
 const t=MARKET_TOOLS.find(x=>x.name===name);if(!t)throw new MarketError(404,'unknown_tool');
 return t.handler(args,ctx);
}
