import {z} from 'zod';
import {SectorComparisonInputSchema,compareSectorProviders,decisionPackMarkdown} from '@/lib/sector-comparison';
import {loadSectorComparisonRecords} from '@/lib/sector-comparison-source';
import {requestOriginAllowed} from '@/lib/request-origin';
import {sourcingPlanAllowed} from '@/lib/sourcing-plan-limit';
import {renderRfpDocx} from '@/lib/rfp-export-docx';
export const runtime='nodejs';
const schema=z.object({input:SectorComparisonInputSchema,format:z.enum(['json','docx','markdown']).default('json'),expected_revisions:z.record(z.string(),z.string()).default({}),providers:z.array(z.string().regex(/^[a-z0-9-]+$/)).max(4).default([])}).strict();
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export function GET(){return Response.json({version:'sector-comparison/2026-11-09.1',description:'Source-linked sector comparison and downloadable provider decision pack. No supplier contact or publication.',method:'POST',input:SectorComparisonInputSchema.toJSONSchema(),formats:['json','docx','markdown'],max_selected_providers:4,export_requires:'providers and expected_revisions from the comparison response'}, {headers});}
/** No brief persistence, project publication, mail or supplier access. Operational rate limits apply. */
export async function POST(req:Request){
 if(!requestOriginAllowed(req))return Response.json({error:'Origin not allowed.'},{status:403,headers});
 try{
  if(!await sourcingPlanAllowed('sector-comparison:'+ (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'local')))return Response.json({error:'Please wait a minute before trying again.'},{status:429,headers:{...headers,'Retry-After':'60'}});
  const raw=await req.text();if(raw.length>24000)return Response.json({error:'Brief too large.'},{status:413,headers});
  const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Check your sector, sites, users and requirements.'},{status:400,headers});
  const {providers,unavailable}=await loadSectorComparisonRecords();
  const result=compareSectorProviders(parsed.data.input,providers,unavailable);
  if(parsed.data.format==='json')return Response.json(result,{headers});
  const selected=[...new Set(parsed.data.providers)];
  if(!selected.length||selected.some(slug=>!result.providers.some(p=>p.slug===slug)))return Response.json({error:'Select one to four available providers before downloading.'},{status:400,headers});
  if(selected.some(slug=>parsed.data.expected_revisions[slug]!==result.providers.find(p=>p.slug===slug)!.revision_id))return Response.json({error:'Provider research has changed. Rebuild your comparison before downloading.'},{status:409,headers});
  const markdown=decisionPackMarkdown(result,selected);
  if(parsed.data.format==='markdown')return new Response(markdown,{headers:{...headers,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="netify-sector-decision-pack.md"'}});
  const file=await renderRfpDocx(markdown,'SD-WAN and SASE provider decision pack');
  return new Response(new Uint8Array(file),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="netify-sector-decision-pack.docx"'}});
 }catch(error){if(error instanceof SyntaxError)return Response.json({error:'Invalid request.'},{status:400,headers});return Response.json({error:'Research is temporarily unavailable. Keep your brief and try again.'},{status:503,headers});}
}
