/**
 * The Netify desk handoff. Beta: sending no longer requires a verified work
 * email. Anyone holding the project's edit capability can send, with a
 * contact email that is recorded and mailed as UNVERIFIED. Abuse protection
 * (BotID, honeypot, time on form, rate limits) runs in the HTTP layer via
 * send-guard.ts before this module is reached. Verified owners keep the
 * original approve_desk_request path. Not exposed as an MCP action.
 */
import {randomUUID} from 'node:crypto';
import {measureCoreEvent} from './final-measurement-hooks';
import {queueOwnerNotification} from './final-notifications';
import {coreDatabase,CoreError,readCoreProject,sha,canonical} from './core-phase1';import {ownerStatus,openPrivate,sealPrivate,privateHash} from './core-identity';import {coreEnvironment,coreLocationPath} from './core-host';import {callBuyerTool} from './core-buyer-tools';import {privateMailEnabled} from './core-mail';import operations from '../../data/sourcing-operations.json';
const enabled=()=>process.env.NETIFY_CORE_DESK_ENABLED==='1';
function recipient(){return process.env.VERCEL_ENV==='preview'&&process.env.NETIFY_CORE_DESK_TEST_TO?process.env.NETIFY_CORE_DESK_TEST_TO:(process.env.SOURCING_DESK_EMAIL??operations.desk_email);}
async function authorised(projectId:string,capability:string,session:string){if(!enabled())throw new CoreError(503,'desk_handoff_not_enabled');const p=await readCoreProject(projectId,capability);if(p.authority!=='edit')throw new CoreError(403,'edit_capability_required');const owner=await ownerStatus(projectId,session);return Object.assign(p,{verifiedOwner:owner.owner===true});}
export async function reviewDeskRequest(projectId:string,capability:string,session:string,origin:string){
 const p=await authorised(projectId,capability,session),sql=coreDatabase();let row=(await sql.query('SELECT id,payload,revision,scope_hash FROM netify_core_phase1.pricing_previews WHERE project_id=$1 AND revision=$2 AND scope_hash=$3 ORDER BY created_at DESC LIMIT 1',[projectId,p.revision,p.scope_hash]))[0];
 if(!row){const providers=p.snapshot.packet.project.selectedProviders;if(!providers.length)throw new CoreError(422,'select_providers_before_review');const prepared=await callBuyerTool('prepare_pricing_request',{project_id:projectId,base_revision:p.revision,operation_id:randomUUID(),instruction:'Prepare the selected providers and exact scope for my private review. Do not send anything.',providers},capability,origin);const id=(prepared.data as any).preview_id;row=(await sql.query('SELECT id,payload,revision,scope_hash FROM netify_core_phase1.pricing_previews WHERE project_id=$1 AND id=$2',[projectId,id]))[0];}
 const contact=p.verifiedOwner?(await sql.query('SELECT o.email_cipher FROM netify_core_phase1.owners o JOIN netify_core_phase1.projects p ON p.owner_id=o.id WHERE p.id=$1',[projectId]))[0]:null;
 return {publisher:'Netify',project_id:projectId,preview_id:row.id,revision:row.revision,scope_hash:row.scope_hash,recipient:recipient(),buyer_email:contact?openPrivate(contact.email_cipher):null,contact_email_required:!contact,scope:row.payload.scope,rfp:row.payload.rfp,preferred_providers:row.payload.recipients,notice:'This sends this version to the Netify sourcing desk only. Netify will review the scope and confirm participating suppliers. It does not publish the project or contact suppliers automatically.',test_mode:coreEnvironment()!=='production',approval:false};
}
export async function approveDeskRequest(projectId:string,capability:string,session:string,body:any,origin:string){
 const p=await authorised(projectId,capability,session);if(body.confirmed!==true||!/^[a-f0-9-]{36}$/.test(body.preview_id??'')||!Number.isSafeInteger(body.revision)||!/^[a-f0-9]{64}$/.test(body.scope_hash??''))throw new CoreError(422,'confirm_exact_version');
 if(!p.verifiedOwner)return sendUnverifiedDeskRequest(p,body,origin);
 const sql=coreDatabase(),receipt=(await sql.query('SELECT netify_core_phase1.approve_desk_request($1,$2,$3,$4,$5,$6,$7) AS result',[projectId,sha(session),body.preview_id,body.revision,body.scope_hash,recipient(),randomUUID()]))[0].result;if(receipt.error)throw new CoreError(receipt.error==='revision_conflict'?409:403,receipt.error);
 return deliverDeskRequest(receipt.request_id,origin);
}
export async function deliverDeskRequest(requestId:string,origin:string){
 if(!enabled()||!privateMailEnabled())throw new CoreError(503,'desk_mail_not_enabled');const sql=coreDatabase();
 const rows=await sql.query(`UPDATE netify_core_phase1.desk_requests d SET status='sending',attempts=attempts+1,next_attempt_at=clock_timestamp()+interval '2 minutes' FROM netify_core_phase1.projects p WHERE d.id=$1 AND p.id=d.project_id AND p.current_revision=d.revision AND p.expires_at>clock_timestamp() AND p.deletion_requested_at IS NULL AND (d.status='approved' OR d.status='failed' AND coalesce(d.next_attempt_at,clock_timestamp())<=clock_timestamp() OR d.status='sending' AND d.next_attempt_at<=clock_timestamp()) RETURNING d.*,p.disposable_fixture`,[requestId]);
 if(!rows.length){const prior=(await sql.query('SELECT status,revision,scope_hash FROM netify_core_phase1.desk_requests WHERE id=$1',[requestId]))[0];if(prior?.status==='accepted')return{publisher:'Netify',request_id:requestId,status:'With Netify',revision:prior.revision,scope_hash:prior.scope_hash,supplier_actions:0};throw new CoreError(409,'request_waiting_or_scope_changed');}
 const d=rows[0];try{
  const preview=(await sql.query('SELECT payload FROM netify_core_phase1.pricing_previews WHERE id=$1 AND project_id=$2',[d.preview_id,d.project_id]))[0].payload;const owner=(await sql.query('SELECT email_cipher FROM netify_core_phase1.owners WHERE id=$1',[d.owner_id]))[0];const email=openPrivate(owner.email_cipher);
  const testTo=process.env.NETIFY_CORE_MAIL_TEST_TO;if(coreEnvironment()!=='production'&&(!testTo||testTo!==d.recipient))throw new CoreError(503,'owner_mail_test_only');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+process.env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':'netify-desk-'+d.id},body:JSON.stringify({from:'Netify <no-reply@mail.netify.co.uk>',to:[d.recipient],reply_to:email,tags:[{name:'netify_channel',value:'private_core'}],subject:(coreEnvironment()==='production'?'':'SYNTHETIC OWNER TEST: ')+'Netify pricing request '+d.project_id+' · version '+d.revision,text:'Verified buyer approval: '+d.approval_instruction+'\nBuyer reply address: '+email+'\nProject: '+origin+coreLocationPath()+'?core='+d.project_id+'\nScope revision: '+d.revision+'\nScope hash: '+d.scope_hash+'\nPreferred providers for desk review only: '+preview.recipients.map((r:any)=>r.provider_id).join(', ')+'\nNo suppliers have been contacted. No public listing has been created.\n\n'+preview.rfp+'\n\nPRICED SCOPE\n'+JSON.stringify(preview.scope,null,2)}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new CoreError(503,'desk_delivery_not_confirmed');const delivery=await response.json();if(typeof delivery.id!=='string')throw new CoreError(503,'desk_delivery_not_confirmed');
  await sql.transaction([sql.query("UPDATE netify_core_phase1.desk_requests SET status='accepted',delivery_id=$2,next_attempt_at=NULL WHERE id=$1",[d.id,delivery.id]),sql.query("UPDATE netify_core_phase1.projects SET status='with_netify' WHERE id=$1 AND current_revision=$2",[d.project_id,d.revision]),sql.query("INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail) VALUES($1,$2,'desk.mail_accepted',$3,$4)",[d.project_id,d.revision,JSON.stringify({type:'system',channel:'approved_netify_desk_only'}),JSON.stringify({request_id:d.id,scope_hash:d.scope_hash,supplier_actions:0})])]);
  await measureCoreEvent(d.project_id,'request_approved_and_sent',d.id).catch(()=>console.error('platform_measurement_unavailable'));
  if(!d.disposable_fixture)await queueOwnerNotification('request_approved_and_sent',d.id,d.project_id).catch(()=>console.error('owner_notification_queue_unavailable'));
  if(coreEnvironment()==='production'&&!d.disposable_fixture)console.info(JSON.stringify({event:'pricing_request_sent',channel:'netify_desk_only',environment:'production',project_ref:sha(d.project_id).slice(0,16),revision:d.revision,test:false}));
  return {publisher:'Netify',request_id:d.id,project_id:d.project_id,status:'With Netify',revision:d.revision,scope_hash:d.scope_hash,recipient:d.recipient,message:'Netify has your approved request. The sourcing desk will review the scope and confirm participating suppliers. No supplier has been contacted automatically.',supplier_actions:0,test_mode:coreEnvironment()!=='production'};
 }catch{await sql.query("UPDATE netify_core_phase1.desk_requests SET status='failed',next_attempt_at=clock_timestamp()+interval '5 minutes' WHERE id=$1",[d.id]);throw new CoreError(503,'desk_delivery_not_confirmed');}
}

/**
 * Beta unverified send. desk_requests needs a verified owner (owner_id NOT
 * NULL, approve_desk_request checks an owner session), so this path records
 * the send in the append-only audit_events log instead and never creates an
 * owners row, which would mark the address as verified.
 */
export async function sendUnverifiedDeskRequest(p:{project_id:string;revision:number;scope_hash:string},body:{preview_id:string;revision:number;scope_hash:string;contact_email?:unknown},origin:string){
 if(!enabled()||!privateMailEnabled())throw new CoreError(503,'desk_mail_not_enabled');
 if(typeof body.contact_email!=='string')throw new CoreError(422,'enter_contact_email');const email=body.contact_email;
 if(body.revision!==p.revision||body.scope_hash!==p.scope_hash)throw new CoreError(409,'revision_conflict');
 const sql=coreDatabase(),to=recipient();
 const prior=(await sql.query("SELECT detail FROM netify_core_phase1.audit_events WHERE project_id=$1 AND event='desk.unverified_mail_accepted' AND detail->>'preview_id'=$2 LIMIT 1",[p.project_id,body.preview_id]))[0];
 if(prior)return {publisher:'Netify',request_id:prior.detail.request_id,project_id:p.project_id,status:'With Netify',revision:p.revision,scope_hash:p.scope_hash,recipient:to,verified:false,message:'Netify already has this version. The sourcing desk will reply to the email you gave.',supplier_actions:0,test_mode:coreEnvironment()!=='production'};
 const preview=(await sql.query('SELECT payload FROM netify_core_phase1.pricing_previews WHERE id=$1 AND project_id=$2 AND revision=$3 AND scope_hash=$4',[body.preview_id,p.project_id,p.revision,p.scope_hash]))[0]?.payload;
 if(!preview)throw new CoreError(409,'request_waiting_or_scope_changed');
 const fixture=(await sql.query('SELECT disposable_fixture FROM netify_core_phase1.projects WHERE id=$1',[p.project_id]))[0]?.disposable_fixture===true;
 const testTo=process.env.NETIFY_CORE_MAIL_TEST_TO;if(coreEnvironment()!=='production'&&(!testTo||testTo!==to))throw new CoreError(503,'owner_mail_test_only');
 const requestId=randomUUID();
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+process.env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':'netify-desk-unverified-'+body.preview_id},body:JSON.stringify({from:'Netify <no-reply@mail.netify.co.uk>',to:[to],reply_to:email,tags:[{name:'netify_channel',value:'private_core_unverified'}],subject:(coreEnvironment()==='production'?'':'SYNTHETIC OWNER TEST: ')+'[UNVERIFIED CONTACT] Netify pricing request '+p.project_id+' · version '+p.revision,text:'UNVERIFIED CONTACT: the buyer approved this version but their email address has NOT been confirmed. Check it before relying on it.\nBuyer contact (unverified): '+email+'\nProject: '+origin+coreLocationPath()+'?core='+p.project_id+'\nScope revision: '+p.revision+'\nScope hash: '+p.scope_hash+'\nPreferred providers for desk review only: '+preview.recipients.map((r:{provider_id:string})=>r.provider_id).join(', ')+'\nNo suppliers have been contacted. No public listing has been created.\n\n'+preview.rfp+'\n\nPRICED SCOPE\n'+JSON.stringify(preview.scope,null,2)}),signal:AbortSignal.timeout(20000)}).catch(()=>null);
 if(!response?.ok)throw new CoreError(503,'desk_delivery_not_confirmed');const delivery=await response.json().catch(()=>null);if(typeof delivery?.id!=='string')throw new CoreError(503,'desk_delivery_not_confirmed');
 await sql.transaction([sql.query("UPDATE netify_core_phase1.projects SET status='with_netify' WHERE id=$1 AND current_revision=$2",[p.project_id,p.revision]),sql.query("INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail) VALUES($1,$2,'desk.unverified_mail_accepted',$3,$4)",[p.project_id,p.revision,JSON.stringify({type:'unverified_contact',channel:'approved_netify_desk_only'}),JSON.stringify({request_id:requestId,preview_id:body.preview_id,scope_hash:p.scope_hash,delivery_id:delivery.id,recipient:to,verified:false,contact_hash:privateHash(email),contact_cipher:sealPrivate(email),supplier_actions:0})])]);
 await measureCoreEvent(p.project_id,'request_approved_and_sent',requestId).catch(()=>console.error('platform_measurement_unavailable'));
 if(!fixture)await queueOwnerNotification('request_approved_and_sent',requestId,p.project_id,{unverified:true}).catch(()=>console.error('owner_notification_queue_unavailable'));
 if(coreEnvironment()==='production'&&!fixture)console.info(JSON.stringify({event:'pricing_request_sent',channel:'netify_desk_only',verified:false,environment:'production',project_ref:sha(p.project_id).slice(0,16),revision:p.revision,test:false}));
 return {publisher:'Netify',request_id:requestId,project_id:p.project_id,status:'With Netify',revision:p.revision,scope_hash:p.scope_hash,recipient:to,verified:false,message:'Netify has your approved request. The sourcing desk will reply to the email you gave. No supplier has been contacted automatically.',supplier_actions:0,test_mode:coreEnvironment()!=='production'};
}

export async function readDeskStatus(projectId:string,session:string){
 const owner=await ownerStatus(projectId,session);if(!owner.owner)return {owner:false};const sql=coreDatabase(),rows=await sql.query('SELECT id,revision,scope_hash,status,approved_at FROM netify_core_phase1.desk_requests WHERE project_id=$1 ORDER BY approved_at DESC LIMIT 30',[projectId]);const latest=rows[0];return {owner:true,requests:rows,status:latest?.status==='accepted'?(latest.revision===owner.revision?'With Netify':'Previous version with Netify. Review the changed scope before sending again.'):['failed','bounced','suppressed'].includes(latest?.status)?'Delivery needs attention. Your approved request is saved.':latest?'Request being processed.':'No request sent.'};
}
