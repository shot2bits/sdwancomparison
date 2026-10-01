import { requestOriginAllowed } from "@/lib/request-origin";
import {recordSourcingMetric} from "@/lib/sourcing-metrics";
import {currentSourcingProposals} from '@/lib/sourcing-proposal-scope';
import {z} from 'zod';
import {sessionFromRequest} from '@/lib/auth';
import {getProject,kvGetJson,kvSetJson} from '@/lib/rfp-store';
import {comparableBidGroups} from '@/lib/bid-comparison';
import type {FeedItem} from '@/lib/opportunity-types';
import {circuitLock} from '@/lib/circuit-store';
import {recordMarketplaceFunnelEvent} from '@/lib/marketplace-funnel';
import type {SourcingRecord} from '@/lib/sourcing-store';
const headers={'Cache-Control':'private, no-store'};
const Entry=z.object({id:z.string().uuid(),stage:z.enum(['desk_reviewed','supplier_approached','supplier_declined','introduction_acknowledged','comparable_set_ready','buyer_decision']),supplier_slug:z.string().max(120).nullable(),evidence_url:z.url().refine(s=>s.startsWith('https://')),note:z.string().trim().min(1).max(4000),occurred_at:z.string().datetime()}).strict();
type Saved=z.infer<typeof Entry>&{recorded_at:string;recorded_by:string};
type Ctx={params:Promise<{id:string}>};
export async function GET(req:Request,ctx:Ctx){
 if((await sessionFromRequest(req))?.role!=='netify')return Response.json({error:'Netify desk access required.'},{status:403,headers});
 const {id}=await ctx.params;
 return Response.json({entries:await kvGetJson<Saved[]>(`rfp:${id}:sourcing-activity`)??[]},{headers});
}
export async function POST(req:Request,ctx:Ctx){
 try{
  const session=await sessionFromRequest(req);
  if(session?.role!=='netify')return Response.json({error:'Netify desk access required.'},{status:403,headers});
  if(!requestOriginAllowed(req))return Response.json({error:'Origin not allowed.'},{status:403,headers});
  const raw=await req.text();if(raw.length>20000)return Response.json({error:'Record too large.'},{status:413,headers});
  const b=Entry.parse(JSON.parse(raw));if(Date.parse(b.occurred_at)>Date.now())throw Error('Future event');
  const {id}=await ctx.params;
  const result=await circuitLock(`sourcing-activity:${id}`,async()=>{
   const p=await getProject(id);const requestId=p?.entrance_context?.raw_input.sourcing_request_id;
   const r=typeof requestId==='string'?await kvGetJson<SourcingRecord>(`sourcing:request:${requestId}`):null;
   if(!r||r.project_id!==id||r.status!=='desk_review')throw Error('Confirmed request required');
   const supplierStage=['supplier_approached','supplier_declined','introduction_acknowledged'].includes(b.stage);
   if(supplierStage&&(!b.supplier_slug||!r.request.recipients.some(x=>x.slug===b.supplier_slug)))throw Error('Buyer-approved recipient required');
   if(!supplierStage&&b.supplier_slug!==null)throw Error('Project stage has no supplier');
   const items=await kvGetJson<Saved[]>(`rfp:${id}:sourcing-activity`)??[];
   const prior=items.find(x=>x.id===b.id);
   if(prior){if(JSON.stringify({id:prior.id,stage:prior.stage,supplier_slug:prior.supplier_slug,evidence_url:prior.evidence_url,note:prior.note,occurred_at:prior.occurred_at})!==JSON.stringify(b))throw Error('ID already used');return items;}
   if(b.stage==='supplier_approached'&&!items.some(x=>x.stage==='introduction_acknowledged'&&x.supplier_slug===b.supplier_slug&&Date.parse(x.occurred_at)<=Date.parse(b.occurred_at)))throw Error('Introduction acknowledgement required before approach');
   if(b.stage==='comparable_set_ready'){
    const feed=await kvGetJson<FeedItem[]>(`rfp:${id}:sourcing-pricing`)??[];
    if(![...comparableBidGroups((await currentSourcingProposals(p!,feed)).current).values()].some(group=>new Set(group.filter(q=>q.amount!==null).map(q=>q.slug??q.supplier)).size>=2))throw Error('Two priced supplier proposals on one basis required');
   }
   if(items.length>=1000)throw Error('Activity limit reached');
   const next=[...items,{...b,recorded_at:new Date().toISOString(),recorded_by:session.email}];
   await kvSetJson(`rfp:${id}:sourcing-activity`,next);return next;
  });
  const project=await getProject(id);const requestId=project?.entrance_context?.raw_input.sourcing_request_id;
  const sourcing=typeof requestId==="string"?await kvGetJson<SourcingRecord>(`sourcing:request:${requestId}`):null;
  if(sourcing)await recordSourcingMetric(b.stage,sourcing.request.acquisition,`${id}:${b.id}`);
  await recordMarketplaceFunnelEvent({event:b.stage,project_id:id,source:'shortlist',channel:'system'});
  return Response.json({entries:result},{headers});
 }catch{return Response.json({error:'Check the confirmed project, approved recipient, evidence, date and unique event reference.'},{status:422,headers});}
}
