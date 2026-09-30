import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getProject,kvGetJson,kvSetJson,kvRaw} from './rfp-store';
import {circuitLock,CircuitError} from './circuit-store';
import {currentSourcingProposals} from './sourcing-proposal-scope';
import type {FeedItem} from './opportunity-types';
import type {SourcingRecord} from './sourcing-store';
import {OUTCOME_CONSENT} from './market-outcome-contract';
export const OutcomeText=z.object({scope:z.string().trim().min(10).max(800),outcome:z.enum(['proposals_received','evaluation_completed','contract_awarded','incomplete','declined','no_proposals','withdrawn']),summary:z.string().trim().min(20).max(1600)}).strict();
export type OutcomeTextType=z.infer<typeof OutcomeText>;
export type PublicOutcome=OutcomeTextType & {id:string;sector:string;site_band:string;user_band:string;approached:number;acknowledged:number;responded:number;declined:number;first_proposal_working_days:number|null;reporting_period:string;timing_basis:string;revision:number};
type Event={stage:string;supplier_slug:string|null;occurred_at:string;evidence_url:string};
export type OutcomeRecord={project_id:string;revision:number;status:'draft'|'awaiting_buyer'|'approved'|'published'|'declined'|'withdrawn';public:PublicOutcome;evidence_references:string[];reviewed_by:string|null;approval:{email:string;revision:number;text:string;at:string}|null;audit:{action:string;actor:string;at:string;revision:number}[]};
const key=(id:string)=>`rfp:${id}:market-outcome`;
export const readOutcome=(id:string)=>kvGetJson<OutcomeRecord>(key(id));
function band(n:number,limits:number[]){const top=limits.find(x=>n<=x);if(top===undefined)return `${limits.at(-1)!+1}+`;const i=limits.indexOf(top);return `${i?limits[i-1]+1:0}–${top}`;}
function weekdays(start:number,end:number){if(end<start)return null;let n=0;const d=new Date(start);d.setUTCHours(0,0,0,0);const stop=new Date(end);stop.setUTCHours(0,0,0,0);while(d<stop){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)n++;}return n;}
async function snapshot(id:string,prior?:OutcomeRecord|null):Promise<{public:PublicOutcome;evidence_references:string[]}>{
 const p=await getProject(id);const requestId=p?.entrance_context?.raw_input.sourcing_request_id;
 const r=typeof requestId==='string'?await kvGetJson<SourcingRecord>(`sourcing:request:${requestId}`):null;
 if(!p||!r||r.project_id!==id||r.status!=='desk_review')throw new CircuitError('A confirmed sourcing project is required.',404);
 const events=await kvGetJson<Event[]>(`rfp:${id}:sourcing-activity`)??[];
 const feed=(await currentSourcingProposals(p,await kvGetJson<FeedItem[]>(`rfp:${id}:sourcing-pricing`)??[])).current;
 const suppliers=(stage:string)=>new Set(events.filter(e=>e.stage===stage&&e.supplier_slug).map(e=>e.supplier_slug));
 const approached=suppliers('supplier_approached');const responded=new Set(feed.map(f=>f.actor_slug).filter(s=>approached.has(s??null)));
 const firstApproach=Math.min(...events.filter(e=>e.stage==='supplier_approached').map(e=>Date.parse(e.occurred_at)));
 const firstResponse=Math.min(...feed.filter(f=>approached.has(f.actor_slug??null)).map(f=>f.created));
 const now=new Date();
 return {public:{id:prior?.public.id??randomUUID(),revision:(prior?.revision??0)+1,sector:r.request.brief.sector??'Not specified',site_band:band(r.request.brief.sites,[4,9,24,49,99,249,999]),user_band:band(r.request.brief.remote_users,[49,249,999,4999]),scope:r.request.brief.need==='sdwan'?'SD-WAN provider sourcing':r.request.brief.need==='secure_access'?'Secure remote access provider sourcing':'Network and security provider sourcing',outcome:'incomplete',summary:'Sourcing is in progress. No completed decision has been recorded.',approached:approached.size,acknowledged:suppliers('introduction_acknowledged').size,responded:responded.size,declined:new Set([...suppliers('supplier_declined')].filter(s=>approached.has(s))).size,first_proposal_working_days:Number.isFinite(firstApproach)&&Number.isFinite(firstResponse)?weekdays(firstApproach,firstResponse):null,reporting_period:`${now.getUTCFullYear()} Q${Math.floor(now.getUTCMonth()/3)+1}`,timing_basis:'Weekdays from first recorded supplier approach to proposal recording in Netify, which may differ from receipt time; public holidays are not excluded. Site and user bands describe the confirmed initial brief. Responses relate to requirements at the time this record was prepared.'},evidence_references:[...events.map(e=>e.evidence_url),...feed.flatMap(f=>f.links??[])]};
}
export async function outcomeAction(id:string,actor:string,staff:boolean,body:{action:string;revision:number;content?:OutcomeTextType;redaction_reviewed?:boolean;consent?:string}){
 return circuitLock(`market-outcome:${id}`,async()=>{
  let r=await readOutcome(id);if((r?.revision??0)!==body.revision)throw new CircuitError('This record changed. Reload and review the latest version.',409);
  const staffActions=['draft','review','publish'];const buyerActions=['approve','decline'];
  if(staffActions.includes(body.action)&&!staff)throw new CircuitError('Netify staff review is required.',403);
  if(buyerActions.includes(body.action)&&staff)throw new CircuitError('Only the verified buyer can give publication permission.',403);
  if(r)await kvSetJson(`rfp:${id}:market-outcome:history:${r.revision}:${r.status}`,r);
  if(body.action==='draft'){
   if(r?.status==='published')throw new CircuitError('Withdraw the published record before revising it.',409);
   const draft=await snapshot(id,r);r={project_id:id,revision:draft.public.revision,status:'draft',...draft,reviewed_by:null,approval:null,audit:r?.audit??[]};
  }else{
   if(!r)throw new CircuitError('No outcome draft exists.',404);
   if(body.action==='review'){
    if(r.status==='published')throw new CircuitError('Withdraw before editing a published record.',409);
    const content=OutcomeText.parse(body.content);
    if(!body.redaction_reviewed||!r.evidence_references.length)throw new CircuitError('Review the underlying evidence and anonymity before requesting approval.',422);
    if(/@|https?:\/\/|www\.|\b\d{5,}\b/i.test(content.scope+' '+content.summary))throw new CircuitError('Remove contact details, links and identifying numbers from the public text.',422);
    if(['proposals_received','evaluation_completed','contract_awarded'].includes(content.outcome)&&!r.public.responded)throw new CircuitError('Recorded supplier proposals are required for this outcome.',422);
    if(content.outcome==='no_proposals'&&r.public.responded)throw new CircuitError('This record includes supplier proposals.',422);
    r.revision++;r.public={...r.public,...content,revision:r.revision};r.status='awaiting_buyer';r.reviewed_by=actor;r.approval=null;
   }else if(body.action==='approve'){
    if(r.status!=='awaiting_buyer'||body.consent!==OUTCOME_CONSENT)throw new CircuitError('Review this exact draft and explicitly approve publication.',409);
    r.approval={email:actor,revision:r.revision,text:OUTCOME_CONSENT,at:new Date().toISOString()};r.status='approved';
   }else if(body.action==='decline'){
    if(r.status!=='awaiting_buyer'&&r.status!=='approved')throw new CircuitError('No pending publication request.',409);
    r.status='declined';r.approval=null;
   }else if(body.action==='publish'){
    if(r.status!=='approved'||!r.reviewed_by||r.approval?.revision!==r.revision)throw new CircuitError('Exact buyer approval and staff review are required.',409);
    // Index first: a failed final save leaves the record non-public. Retrying is safe.
    await kvSetJson(`market-outcome:public:${r.public.id}`,id);
    await kvRaw(['ZADD','market-outcomes:index',Date.now(),id]);r.status='published';
   }else if(body.action==='withdraw'){
    r.status='withdrawn';r.approval=null;
   }else throw new CircuitError('Unknown action.',422);
  }
  r.audit.push({action:body.action,actor,at:new Date().toISOString(),revision:r.revision});await kvSetJson(key(id),r);return r;
 });
}
export function publishedOutcome(r:OutcomeRecord|null):PublicOutcome|null {return r?.status==='published'&&r.reviewed_by&&r.approval?.revision===r.revision?{...r.public}:null;}
export async function listPublicOutcomes(){const ids=await kvRaw(['ZREVRANGE','market-outcomes:index',0,499]) as string[];return (await Promise.all(ids.map(readOutcome))).map(publishedOutcome).filter((r):r is PublicOutcome=>r!==null);}
export async function publicOutcome(id:string){if(!z.uuid().safeParse(id).success)return null;const project=await kvGetJson<string>(`market-outcome:public:${id}`).catch(()=>null);return project?publishedOutcome(await readOutcome(project)):null;}
