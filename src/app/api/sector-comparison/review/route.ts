import {SectorComparisonInputSchema} from '@/lib/sector-comparison';
import {decisionReviewText} from '@/lib/sector-decision-review';
import {callWorkspaceTool} from '@/lib/mcp-workspace-tools';
import {requestOriginAllowed} from '@/lib/request-origin';
import {sourcingPlanAllowed} from '@/lib/sourcing-plan-limit';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
/** Reuses the existing model-first extraction service. No project writes or supplier contact. */
export async function POST(req:Request){
 if(!requestOriginAllowed(req))return Response.json({error:'Origin not allowed.'},{status:403,headers});
 if(!req.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'JSON required.'},{status:415,headers});
 try{
  if(!await sourcingPlanAllowed('sector-review:'+(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'local')))return Response.json({error:'Please wait a minute before reviewing again.'},{status:429,headers});
  const text=await req.text();if(text.length>30000)return Response.json({error:'Brief too large. Your text has not been read or shortened.'},{status:413,headers});
  const parsed=SectorComparisonInputSchema.safeParse(JSON.parse(text));if(!parsed.success)return Response.json({error:'Check the brief before requesting a review.'},{status:400,headers});
  const input=parsed.data;
  const result=await callWorkspaceTool('workspace_ingest',{text:decisionReviewText(input),include_fit:false,procurement:{buying:input.scope==='secure_access'?'sse':input.scope, ...(input.service_model!=='any'?{operatingModel:input.service_model==='fully_managed'?'managed':input.service_model==='self_managed'?'diy':'co_managed'}:{})}}) as {error?:string;engine:string;brief:string;updates:unknown[];earned_questions:unknown[];notes:string[];read_summary:string};
  if(result.error)throw new Error('Review failed');
  return Response.json({engine:result.engine,brief:result.brief,updates:result.updates,questions:result.earned_questions,notes:result.notes,read_summary:result.read_summary,notice:'This review is advisory. It does not change your requirements, provider grades or selections. Confirm inferred suggestions before using them.'},{headers});
 }catch(error){return Response.json({error:error instanceof SyntaxError?'Invalid request.':'The brief review is unavailable. Your original brief and the evidence comparison are still available.'},{status:error instanceof SyntaxError?400:503,headers});}
}
