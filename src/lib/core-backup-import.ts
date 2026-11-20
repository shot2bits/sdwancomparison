import {coreEnvironment} from './core-host';
/** Single, explicit local-backup import. No device scanning or live KV access. */
import {CoreError,canonical,sha,validatedSnapshot,createCoreProject} from './core-phase1';
import {contextCatalogue} from './context-comparison-preview';
import {totals,scheduleText,estatePlanningText} from '../../preview/context-space/location-model.js';

export function previewBackupImport(text:string,newId:string){
 if(typeof text!=='string'||Buffer.byteLength(text)>4_800_000)throw new CoreError(422,'backup_too_large_not_truncated');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(newId))throw new CoreError(422,'new_project_id_required');
 let raw:any;try{raw=JSON.parse(text);}catch{throw new CoreError(422,'invalid_backup_json');}
 if(raw?.version!=='netify-location-project/1')throw new CoreError(422,'location_backup_required');
 let original:any;try{original=validatedSnapshot({version:'netify-core-snapshot/1',estate:raw.estate,siteDrafts:raw.siteDrafts??{},packet:raw.connectedProject});}catch{throw new CoreError(422,'invalid_backup_nothing_imported');}
 if(original.packet.project.id===newId)throw new CoreError(422,'import_requires_new_project');
 const snapshot=structuredClone(original),p=snapshot.packet.project,e=snapshot.estate;
 const reviewCount=Object.keys(e.planning?.siteReviews??{}).length+(e.planning?.userReview?1:0);
 if(e.planning){e.planning.siteReviews={};delete e.planning.userReview;}
 const sourceId=p.id;
 // Rebind structural identities only. Quoted evidence and historic text stay exact.
 p.id=newId;p.revision=0;
 for(const saved of snapshot.packet.buying?.snapshots??[])saved.core.project.id=newId;
 validatedSnapshot(snapshot);
 const counts=totals(e);
 const reconciliation={version:'netify-backup-import/1',source_project_id:sourceId,new_project_id:newId,
  source_hash:sha(text),location_records:e.sites.length,total_sites:counts.sites,unallocated_sites:e.unallocated,
  declared_sites:p.input.sites,users:p.input.users,sector:p.input.sector,
  products:p.input.products?.length??0,custom_requirements:snapshot.packet.workspace.custom.length,
  selected_questions:p.document.questionIds.length,selected_providers:p.selectedProviders.length,
  source_archives:e.sources?.length??0,source_characters:(e.sources??[]).reduce((n:number,s:any)=>n+s.text.length,0),
  site_drafts:Object.keys(snapshot.siteDrafts).length,conversation_threads:snapshot.packet.conversations?.threads.length??0,
  buying_snapshots:snapshot.packet.buying?.snapshots.length??0,proposals:snapshot.packet.buying?.proposals.length??0,
  reviews_to_repeat:reviewCount,structured_estate_bytes:Buffer.byteLength(JSON.stringify(e)),
  preserved:'All validated project fields, site exceptions, evidence, original source text, RFP question selections, local conversations and buying records. The exact original file is archived in the private creation audit.',
  changes:'New project identity and revision 1. Existing local reviews become pending in the new project, and the generated RFP site schedule reflects this. Historical local records grant no identity, supplier-sharing or delivery authority.',
  current_project:'Unchanged',environment:coreEnvironment(),supplier_actions:0};
 return {snapshot,reconciliation,preview_hash:sha(canonical(reconciliation))};
}
export async function importBackup(text:string,newId:string,previewHash:string,operation:string,origin:string,credentials:{edit:string;view:string}){
 const plan=previewBackupImport(text,newId);
 if(previewHash!==plan.preview_hash)throw new CoreError(409,'backup_preview_changed');
 const result=await createCoreProject(plan.snapshot,operation,origin,credentials,{source_hash:sha(text),raw_backup:text,reconciliation:plan.reconciliation});
 return {...result,reconciliation:plan.reconciliation,preview_hash:plan.preview_hash};
}
