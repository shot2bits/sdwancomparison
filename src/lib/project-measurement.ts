import {sanitiseAttribution} from './measurement-contract';
import type {ReportingRecord} from './activity-weekly-report';
export function projectMeasurement(records:ReportingRecord[],attributions:Map<string,unknown>,start:number,end:number){
 const groups=new Map<string,{landing_page:string;acquisition:string;drafts_saved:number;publications:number;qualified_projects:number;tests:number;nonproduction:number}>();
 for(const r of records){
  const created=r.created_at>=start&&r.created_at<end;
  const publications=new Set((r.publications??[]).filter(p=>p.at>=start&&p.at<end).map(p=>p.opportunity_id)).size;
  if(!created&&!publications)continue;
  const a=sanitiseAttribution(attributions.get(r.id));const landing_page=a?.landing_page??'unknown',acquisition=a?.acquisition??'unknown';
  const key=JSON.stringify([landing_page,acquisition]);
  const row=groups.get(key)??{landing_page,acquisition,drafts_saved:0,publications:0,qualified_projects:0,tests:0,nonproduction:0};groups.set(key,row);
  if(r.activity?.classification.value==='test'||(!r.activity&&r.legacy_test_evidence)){row.tests++;continue;}
  if(r.environment!=='production'){row.nonproduction++;continue;}
  if(created)row.drafts_saved++;
  row.publications+=publications;
  if(created&&r.activity?.classification.value==='non_test'&&r.activity.buyer_intent?.verified&&r.activity.buyer_intent.evidence_ref&&r.activity.buyer_intent.at<=end)row.qualified_projects++;
 }
 return {rows:[...groups.values()],definition:'Draft creation and publication are separate activities, not leads. Qualified projects require independently recorded buyer-intent evidence. Attribution is consent-based, client-reported and retained for 90 days; absent or unsupported entrances are unknown. Publication counts are unique opportunities represented in the week, including later revisions; not new-opportunity counts.'};
}
