import {fullResearchAppendixMarkdown} from '@/lib/sector-research-appendix';
import {z} from 'zod';
import {SectorComparisonInputSchema,compareSectorProviders,decisionPackMarkdown,prepareComparisonRecord} from '@/lib/sector-comparison';
import {loadSectorComparisonRecords} from '@/lib/sector-comparison-source';
import {requestOriginAllowed} from '@/lib/request-origin';
import {sourcingPlanAllowed} from '@/lib/sourcing-plan-limit';
import {renderRfpDocx} from '@/lib/rfp-export-docx';
export const runtime='nodejs';
const schema=z.object({input:SectorComparisonInputSchema,format:z.enum(['json','docx','markdown','research_json']).default('json'),include_full_research:z.boolean().default(false),advisory_review:z.string().max(50000).optional(),expected_fingerprints:z.record(z.string(),z.string()).default({}),expected_revisions:z.record(z.string(),z.string()).default({}),providers:z.array(z.string().regex(/^[a-z0-9-]+$/)).max(4).default([])}).strict();
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export function GET(){return Response.json({version:'sector-comparison/2026-11-10.4',description:'Source-linked sector comparison and downloadable provider decision pack. No supplier contact or publication.',method:'POST',input:SectorComparisonInputSchema.toJSONSchema(),formats:['json','docx','markdown','research_json'],max_selected_providers:4,buyer_checklists:'Original questions with dated primary-source checks; archival guidance, not ranking evidence.',provider_research_url:'/sase/api/sector-comparison/providers/{slug}/',primary_source_research:'shortlist-primary-research/2026-11-09.1',export_requires:'providers, expected_revisions and expected_fingerprints from the comparison response'}, {headers});}
/** No brief persistence, project publication, mail or supplier access. Operational rate limits apply. */
export async function POST(req:Request){
 if(!requestOriginAllowed(req))return Response.json({error:'Origin not allowed.'},{status:403,headers});
 try{
  if(!await sourcingPlanAllowed('sector-comparison:'+ (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'local')))return Response.json({error:'Please wait a minute before trying again.'},{status:429,headers:{...headers,'Retry-After':'60'}});
  const raw=await req.text();if(raw.length>120000)return Response.json({error:'Brief too large.'},{status:413,headers});
  const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Check your sector, sites, users and requirements.'},{status:400,headers});
  const {providers,unavailable}=await loadSectorComparisonRecords();
  const result=compareSectorProviders(parsed.data.input,providers,unavailable);
  if(parsed.data.format==='json')return Response.json(result,{headers});
  const selected=[...new Set(parsed.data.providers)];
  if(!selected.length||selected.some(slug=>!result.providers.some(p=>p.slug===slug)))return Response.json({error:'Select one to four available providers before downloading.'},{status:400,headers});
  if(selected.some(slug=>parsed.data.expected_revisions[slug]!==result.providers.find(p=>p.slug===slug)!.revision_id||parsed.data.expected_fingerprints[slug]!==result.providers.find(p=>p.slug===slug)!.evidence_fingerprint))return Response.json({error:'Provider research or this tool has changed. Refresh this page and rebuild your comparison before downloading.'},{status:409,headers});
  const records=providers.filter(p=>selected.includes(p.provider.slug)).map(prepareComparisonRecord);
  if(parsed.data.format==='research_json')return new Response(JSON.stringify({version:result.version,generated_at:result.generated_at,input:result.input,providers:result.providers.filter(p=>selected.includes(p.slug)),complete_published_records:providers.filter(p=>selected.includes(p.provider.slug)),interpreted_comparison_records:records},null,2),{headers:{...headers,'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="netify-complete-provider-research.json"'}});
  const markdown=decisionPackMarkdown(result,selected)+(parsed.data.advisory_review?'\n\n## Unconfirmed advisory brief review\n\nThis review was supplied with the export. It does not change evidence grades or the buyer-confirmed requirements.\n\n'+parsed.data.advisory_review.split(/\r?\n/).map(line=>'> '+line).join('\n'):'')+(parsed.data.include_full_research?'\n\n'+fullResearchAppendixMarkdown(records):'');
  if(parsed.data.format==='markdown')return new Response(markdown,{headers:{...headers,'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':'attachment; filename="netify-sector-decision-pack.md"'}});
  const file=await renderRfpDocx(markdown,'SD-WAN and SASE provider decision pack');
  return new Response(new Uint8Array(file),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':'attachment; filename="netify-sector-decision-pack.docx"'}});
 }catch(error){if(error instanceof SyntaxError)return Response.json({error:'Invalid request.'},{status:400,headers});return Response.json({error:'Research is temporarily unavailable. Keep your brief and try again.'},{status:503,headers});}
}
