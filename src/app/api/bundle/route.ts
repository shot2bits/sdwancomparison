import {z} from 'zod';
import {authenticate,bundleFor} from '@/lib/agent-access';
import {MarketError} from '@/lib/marketplace-mcp';
import {renderRfpDocx} from '@/lib/rfp-export-docx';

/** Download the RFP and recommended-providers bundle for a requirement you published. Bearer token from verify_access_code. */
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const body=z.object({opportunity_id:z.string().max(60),format:z.enum(['markdown','docx','json']).default('markdown')}).strict();
export async function POST(req:Request){
 let raw:unknown;try{raw=JSON.parse(await req.text());}catch{return Response.json({error:'invalid_json'},{status:400,headers});}
 const p=body.safeParse(raw);if(!p.success)return Response.json({error:'invalid_request'},{status:422,headers});
 try{
  const id=await authenticate(req.headers.get('authorization')),b=await bundleFor(id,p.data.opportunity_id);
  if(p.data.format==='json')return Response.json({...b,markdown:undefined},{headers});
  if(p.data.format==='markdown')return new Response(b.markdown,{headers:{...headers,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="netify-rfp-and-recommended-providers.md"'}});
  const file=await renderRfpDocx(b.markdown,'SD-WAN and SASE RFP and recommended providers');
  return new Response(new Uint8Array(file),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="netify-rfp-and-recommended-providers.docx"'}});
 }catch(e){if(e instanceof MarketError)return Response.json({error:e.code,...e.detail},{status:e.status,headers});return Response.json({error:'unavailable'},{status:500,headers});}
}
