import {activityEnvironment,activityIdentity, type ActivityMetadata, type ActivityEnvironment} from './activity-provenance';
export type ReportingRecord={app:'sase'|'bt';id:string;environment:ActivityEnvironment;route:string;created_at:number;invitation_records_complete?:boolean;response_records_complete?:boolean;activity?:ActivityMetadata;legacy_test_evidence?:string|null;publications?:{id:string;opportunity_id:string;at:number}[];invitations?:{id:string;opportunity_id:string;at:number;delivered_at?:number;delivery:string}[];responses?:{id:string;opportunity_id:string;invitation_id?:string;at:number;substantive:boolean}[];outcomes?:{id:string;stage:'confirmed_quote'|'accepted_proposal'|'completed_order';at:number;evidence_ref:string}[]};
export type ReportingEvent={app:string;environment:ActivityEnvironment;record_id:string;event:string;id:string;at:number};
export function weeklyActivityReport(records:ReportingRecord[],events:ReportingEvent[],start:number,end:number,asOf=end){
 if(![start,end,asOf].every(Number.isFinite)||start>=end||asOf<end)throw Error('Invalid half-open reporting window');
 const inside=(at:number)=>at>=start&&at<end;
 const unique=new Map(records.map(r=>[activityIdentity(r.app,r.environment,r.id),r]));
 const partitions=Object.fromEntries(['production','preview','development','unknown'].map(env=>[env,{records:0,test:0,non_test:0,unknown:0}]));
 const publications=new Map<string,{record:ReportingRecord;at:number;id:string;opportunity_id:string}>();
 for(const r of unique.values()){
  const classification=r.activity?.classification.value??(r.legacy_test_evidence?'test':'unknown');
  if(inside(r.created_at)){partitions[r.environment].records++;partitions[r.environment][classification]++;}
  for(const p of r.publications??[])if(inside(p.at)){
   const key=activityIdentity(r.app,r.environment,p.opportunity_id);const old=publications.get(key);
   if(!old||p.at<old.at)publications.set(key,{record:r,...p});
  }
 }
 const list=[...publications.values()];
 const test=(r:ReportingRecord)=>r.activity?.classification.value==='test'||(!r.activity&&!!r.legacy_test_evidence);
 const verified=(r:ReportingRecord)=>r.environment==='production'&&r.activity?.classification.value==='non_test'&&r.activity.buyer_intent?.verified===true&&r.activity.buyer_intent.at<=asOf&&!!r.activity.buyer_intent.evidence_ref;
 const qualified=list.filter(p=>verified(p.record));
 const eligible=list.filter(p=>p.record.environment==='production'&&!test(p.record));
 const responseRows=eligible.map(p=>{
  const invitations=[...new Map((p.record.invitations??[]).filter(i=>i.opportunity_id===p.opportunity_id&&i.at<=asOf).map(i=>[i.id,i])).values()];
  const delivered=invitations.filter(i=>i.delivered_at!==undefined&&i.delivered_at<=asOf).sort((a,b)=>a.delivered_at!-b.delivered_at!);
  const responses=(p.record.responses??[]).filter(r=>r.opportunity_id===p.opportunity_id&&r.substantive&&r.at<=asOf&&invitations.some(i=>(r.invitation_id===i.id)&&r.at>=i.at)).sort((a,b)=>a.at-b.at);
  const first=delivered[0]?.delivered_at, reply=responses[0];
  return {opportunity_id:p.opportunity_id,invitations_complete:p.record.invitation_records_complete!==false,response_complete:p.record.response_records_complete!==false,classification:p.record.activity?.classification.value??'unknown',invitations:invitations.length,delivery_counts:invitations.reduce((a,i)=>({...a,[i.delivery]:(a[i.delivery]??0)+1}),{} as Record<string,number>),responded:responses.length>0,first_successful_invitation_at:first??null,first_substantive_response_at:responses[0]?.at??null,response_hours:reply&&first!==undefined&&reply.at>=first?(reply.at-first)/3600000:null,unanswered_age_hours:p.record.response_records_complete!==false&&!responses.length&&first!==undefined?(asOf-first)/3600000:null};
 });
 const invited=responseRows.filter(r=>r.invitations>0),answered=invited.filter(r=>r.responded);
 const byRoute:Record<string,{eligible_records:number;unverified_records:number;known_test_records:number;nonproduction_or_unknown_records:number;confirmed_quote:number;accepted_proposal:number;completed_order:number}>={};
 for(const r of unique.values())if(inside(r.created_at)){
  const row=byRoute[r.route]??={eligible_records:0,unverified_records:0,known_test_records:0,nonproduction_or_unknown_records:0,confirmed_quote:0,accepted_proposal:0,completed_order:0};
  if(!verified(r)){if(test(r))row.known_test_records++;else if(r.environment!=='production')row.nonproduction_or_unknown_records++;else row.unverified_records++;continue;}row.eligible_records++;
  for(const stage of ['confirmed_quote','accepted_proposal','completed_order'] as const)if(r.outcomes?.some(o=>o.stage===stage&&o.at>=r.created_at&&o.at<=asOf&&!!o.evidence_ref))row[stage]++;
 }
 const eventRows=events.filter(e=>inside(e.at));
 const acquisition:Record<string,number>={};for(const r of unique.values())if(inside(r.created_at)){const key=`${r.environment}:${r.activity?.acquisition_source??'unknown'}`;acquisition[key]=(acquisition[key]??0)+1;}
 return {contract:'activity-weekly/1',window:{timezone:'Europe/London',start_inclusive:new Date(start).toISOString(),end_exclusive:new Date(end).toISOString(),outcomes_as_of:new Date(asOf).toISOString()},partitions,
  publications:{unique_total:list.length,verified_production_non_test_buyer_intent:qualified.length,production_unverified:eligible.length-qualified.length,known_test:list.filter(p=>test(p.record)).length,environment_unknown:list.filter(p=>p.record.environment==='unknown').length,publication_revisions:new Set([...unique.values()].flatMap(r=>(r.publications??[]).filter(p=>inside(p.at)).map(p=>activityIdentity(r.app,r.environment,p.id)))).size},
  response_coverage:{denominator:invited.length,numerator:answered.length,ratio:invited.length&&!responseRows.some(r=>!r.invitations_complete||(r.invitations>0&&!r.responded&&!r.response_complete))?answered.length/invited.length:null,missing_invitation_records:responseRows.filter(r=>!r.invitations_complete).length,zero_invite:responseRows.filter(r=>r.invitations_complete&&!r.invitations).length,retained_zero_invite_all_environments:list.filter(p=>p.record.invitation_records_complete!==false&&!(p.record.invitations??[]).some(i=>i.opportunity_id===p.opportunity_id&&i.at<=asOf)).length,unanswered:invited.filter(r=>!r.responded&&r.response_complete).length,response_unknown:invited.filter(r=>!r.responded&&!r.response_complete).length,rows:responseRows},
  acquisition,commercial_progression:byRoute,event_counts:{raw:eventRows.length,unique_events:new Set(eventRows.map(e=>activityIdentity(e.app,e.environment,e.id))).size,unique_records:new Set(eventRows.map(e=>activityIdentity(e.app,e.environment,e.record_id))).size},
  definitions:{publications:'Unique opportunities first represented by a persisted publication revision within the window; corrections do not add opportunities.',response:'Production publications excluding known tests; unverified activity labelled separately. Response coverage denominator is opportunities with persisted invitations. Successful invitation time requires delivery evidence, not provider acceptance. A substantive response has submitted answers or an explicit supplier decline with text. Generic messages and demo scheduling remain unverified; acknowledgements, views and interest alone do not qualify.',progression:'Creation cohort in the week, production/non-test/independently verified; subsequent saved outcome timestamps through as-of. Not a click-to-buyer conversion rate.',missing:'Null rates/times mean missing evidence or zero denominator. Unknown environment or classification is not genuine production buyer evidence.'}};
}
export function normaliseEnvironment(value:unknown){return activityEnvironment(value??'unknown');}
