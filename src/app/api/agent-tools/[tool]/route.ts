import {MARKET_TOOLS,callMarketTool,MarketError,MARKET_VERSION,publicToolView} from '@/lib/marketplace-tools';
import {identityRate} from '@/lib/core-identity';

/** REST mirror of the marketplace MCP tools. Same handlers, same rules, same limits. */
export const runtime='nodejs';
export const dynamic='force-dynamic';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Max-Age':'86400','cache-control':'no-store'};
type Ctx={params:Promise<{tool:string}>};
export const OPTIONS=()=>new Response(null,{status:204,headers:cors});
export async function GET(_req:Request,ctx:Ctx){const {tool}=await ctx.params;const t=MARKET_TOOLS.find(x=>x.name===tool);if(!t)return Response.json({error:'unknown_tool'},{status:404,headers:cors});return Response.json({...publicToolView(t),mcp_endpoint:'https://netify.co.uk/sase/api/mcp/'},{headers:cors});}
export async function POST(req:Request,ctx:Ctx){
 const {tool}=await ctx.params;if(!MARKET_TOOLS.some(x=>x.name===tool))return Response.json({error:'unknown_tool'},{status:404,headers:cors});
 const ip=(req.headers.get('x-forwarded-for')??'not-provided').split(',')[0].trim();
 if(process.env.VERCEL_ENV==='production'){try{await identityRate('rest-tools:'+ip,300);}catch{return Response.json({error:'please_wait_before_retrying'},{status:429,headers:{...cors,'retry-after':'60'}});}}
 let body:unknown={};try{const text=await req.text();if(text.length>1_000_000)return Response.json({error:'too_large'},{status:413,headers:cors});body=text?JSON.parse(text):{};}catch{return Response.json({error:'invalid_json'},{status:400,headers:cors});}
 const bearer=(req.headers.get('authorization')??'').replace(/^Bearer /,'');
 try{return Response.json(await callMarketTool(tool,body,{origin:'https://netify.co.uk',token:bearer,request:req,ip}),{headers:cors});}
 catch(e){if(e instanceof MarketError)return Response.json({publisher:'Netify',contract_version:MARKET_VERSION,error:e.code,...e.detail},{status:e.status,headers:cors});return Response.json({error:'tool_failed'},{status:500,headers:cors});}
}
