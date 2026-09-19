import {invitationOpportunity} from './activity-joins';
import {projectMeasurement} from './project-measurement';
import {kvRaw,kvGetJson} from './rfp-store';
import {readActivityAudit} from './activity-audit';
import {explicitTestEvidence} from './activity-provenance';
import {normaliseEnvironment,type ReportingRecord,type ReportingEvent} from './activity-weekly-report';
import type {ProjectDetails,SupplierConnection,RfpResponse} from './rfp-types';
import type {PublishedSnapshot} from './published-snapshot';
/** Raw reads only: do not call lazy-healing project/opportunity accessors in a report. */
export async function readActivityReportingRecords(start?:number,end?:number){
 const attributions=new Map<string,unknown>();
 const keys=new Set<string>();let cursor='0';do{const result=await kvRaw(['SCAN',cursor,'MATCH','rfp:*','COUNT',500]) as [string,string[]];cursor=String(result[0]);for(const key of result[1])if(/^rfp:[a-zA-Z0-9_-]+$/.test(key))keys.add(key);}while(cursor!=='0');
 const records:ReportingRecord[]=[];const unresolved={publication_opportunities:0,invitation_opportunities:0,response_invitations:0,response_substance_unverified:0};
 for(const key of keys){
  const p=await kvGetJson<ProjectDetails>(key);if(!p?.id||!p.buyer)continue;
  if(start!==undefined&&end!==undefined)attributions.set(p.id,await kvGetJson(`measurement:attribution:${p.id}`));
  const environment=normaliseEnvironment(p.activity?.environment??p.activity_environment);
  const audit=await readActivityAudit('sase',environment,p.id);
  const snapshots=await kvGetJson<PublishedSnapshot[]>(`rfp:${p.id}:published_snapshots`)??[];
  const latest=await kvGetJson<PublishedSnapshot>(`rfp:${p.id}:published_snapshot`);if(latest&&!snapshots.some(s=>s.id===latest.id))snapshots.push(latest);
  const publications=[];for(const s of snapshots){const id=s.public_projection?.opportunity_id;if(id&&await kvGetJson(`opp:${id}`))publications.push({id:s.id,opportunity_id:id,at:s.published_at});else unresolved.publication_opportunities++;}
  const storedConnections=await kvGetJson<SupplierConnection[]>(`rfp:${p.id}:connections`);
  const connections=storedConnections??[];
  const replies=await kvGetJson<RfpResponse[]>(`rfp:${p.id}:responses`)??[];
  const opportunities=[...new Set(publications.map(p=>p.opportunity_id))];
  const connectionOpportunity=(c:SupplierConnection)=>invitationOpportunity(c,opportunities,environment);
  const missingResponsesBefore=unresolved.response_invitations,unverifiedBefore=unresolved.response_substance_unverified;
  const invitations=connections.flatMap(c=>{const id=connectionOpportunity(c);if(!id){unresolved.invitation_opportunities++;return [];}return [{id:c.id,opportunity_id:id,at:c.created,delivery:c.delivery?.state??'unknown',...(c.first_delivered_at?{delivered_at:c.first_delivered_at}:c.delivery?.state==='delivered'?{delivered_at:c.delivery.updated_at}:{})}];});
  unresolved.response_substance_unverified+=connections.flatMap(c=>(c.messages??[])).filter(m=>m.from==='supplier'&&['message','demo_response'].includes(m.type)&&m.body.trim()).length;
  const responses=connections.flatMap(c=>{const id=connectionOpportunity(c);return id?(c.messages??[]).filter(m=>m.from==='supplier'&&m.type==='decline'&&m.body.trim()).map(m=>({id:m.id,opportunity_id:id,invitation_id:c.id,at:m.created,substantive:true})):[];});
  for(const r of replies.filter(r=>r.submitted!==null)){const c=connections.find(c=>c.vendor_slug===r.vendor_slug),id=c?connectionOpportunity(c):undefined;if(!c||!id){unresolved.response_invitations++;continue;}responses.push({id:r.id,opportunity_id:id,invitation_id:c.id,at:r.submitted!,substantive:Object.values(r.answers??{}).some(a=>a.trim().length>0)});}
  records.push({app:'sase',id:p.id,environment,route:p.journey?.mode??'unknown',created_at:p.created,activity:audit.at(-1)?.activity??p.activity,legacy_test_evidence:explicitTestEvidence(p),publications,invitations,responses,outcomes:[],response_records_complete:unresolved.response_invitations===missingResponsesBefore&&unresolved.response_substance_unverified===unverifiedBefore,invitation_records_complete:invitations.length===connections.length&&snapshots.every(s=>Array.isArray(s.invited_vendor_ids)&&s.invited_vendor_ids.every(slug=>connections.some(c=>c.vendor_slug===slug)))});

 }
 const events:ReportingEvent[]=[];for(const env of ['production','preview','development','unknown']){const raw=await kvRaw(['LRANGE',`activity:events:sase:${env}`,0,-1]);for(const r of Array.isArray(raw)?raw:[]){const e=JSON.parse(String(r));events.push({app:'sase',environment:normaliseEnvironment(e.environment),record_id:e.project_id,event:e.event,id:e.id,at:e.at});}}
 const legacy=await kvRaw(['LRANGE','marketplace:funnel:events',0,-1]);
 for(const raw of Array.isArray(legacy)?legacy:[]){const e=JSON.parse(String(raw));if(e.version!=='marketplace-funnel/2.0.0'||!['project_started','publication_completed','supplier_response'].includes(e.event))events.push({app:'sase',environment:normaliseEnvironment(e.environment),record_id:e.project_id,event:e.event,id:`legacy:${e.project_id}:${e.event}:${e.at}`,at:e.at});}
 return {records,events,measurement:start!==undefined&&end!==undefined?projectMeasurement(records,attributions,start,end):undefined,unresolved_joins:unresolved,limitations:['Published snapshot history retains at most 50 revisions per project. Expired/deleted records cannot be recovered.','Invitation delivery timestamps represent the saved delivery evidence; provider acceptance is not delivery.','Connections with multiple possible historical opportunities and no explicit join are excluded; their attribution requires review. No SASE commercial-stage source is currently wired; absence of recorded outcomes is not evidence of no off-platform deal.']};
}
