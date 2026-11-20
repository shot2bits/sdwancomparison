import {privateMailEnabled,sendPrivateVerification} from './core-mail';
import {measureCoreEvent} from './final-measurement-hooks';
import {queueOwnerNotification} from './final-notifications';
import {coreEnvironment} from './core-host';
import {coreOriginAllowed,coreLocationPath} from './core-host';
import {createCipheriv,createDecipheriv,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {CoreError,coreDatabase,readCoreProject,sha} from './core-phase1';
export const IDENTITY_VERSION='netify-private-identity/1';
export const CORE_SENDER='Netify <no-reply@mail.netify.co.uk>';
const token=()=>randomBytes(32).toString('base64url');
function identityKey(){const k=process.env.NETIFY_CORE_IDENTITY_KEY??'';if(!/^[a-f0-9]{64}$/.test(k)||process.env.NETIFY_CORE_PHASE23!=='1')throw new CoreError(503,'private_identity_not_configured');return Buffer.from(k,'hex');}
export function privateHash(value:string){return createHmac('sha256',identityKey()).update(value).digest('hex');}
export function sealPrivate(value:unknown){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',identityKey(),iv),bytes=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),bytes]).toString('base64url');}
// Server-only administrative capture inspection. Never exposed over web or MCP.
export function openPrivate(value:string){const bytes=Buffer.from(value,'base64url'),c=createDecipheriv('aes-256-gcm',identityKey(),bytes.subarray(0,12));c.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([c.update(bytes.subarray(28)),c.final()]).toString('utf8'));}
export function validateWorkEmail(value:unknown){if(typeof value!=='string')throw new CoreError(422,'enter_work_email');const email=value.trim().toLowerCase();if(email.length>254||!/^[-a-z0-9.!#$%&'*+/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email)||/[\r\n]/.test(email))throw new CoreError(422,'enter_work_email');if(['gmail.com','googlemail.com','hotmail.com','outlook.com','yahoo.com','icloud.com'].includes(email.split('@')[1]))throw new CoreError(422,'use_your_work_email');return email;}
export function trustedCoreOrigin(origin:string){const u=new URL(origin);if(!coreOriginAllowed(u.origin)||u.username||u.password||u.pathname!=='/')throw new CoreError(403,'local_development_only');return u.origin;}
export function requireToken(value:unknown){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))throw new CoreError(404,'verification_unavailable');return value;}
export function requireProjectId(value:unknown){if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(value))throw new CoreError(422,'valid_project_required');return value;}
export async function identityRate(key:string,max=5){const sql=coreDatabase();const rows=await sql.query(`INSERT INTO netify_core_phase1.identity_rate_limits(key_hash,window_at,attempts) VALUES($1,clock_timestamp(),1) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN identity_rate_limits.window_at<clock_timestamp()-interval '15 minutes' THEN 1 ELSE identity_rate_limits.attempts+1 END,window_at=CASE WHEN identity_rate_limits.window_at<clock_timestamp()-interval '15 minutes' THEN clock_timestamp() ELSE identity_rate_limits.window_at END RETURNING attempts`,[privateHash(key)]);if(rows[0].attempts>max)throw new CoreError(429,'please_wait_before_retrying');}
export async function requestVerification(args:{projectId:string;edit?:string;email:unknown;purpose:'claim'|'recover';origin:string;requester:string}){
 const projectId=requireProjectId(args.projectId),email=validateWorkEmail(args.email),origin=trustedCoreOrigin(args.origin),sql=coreDatabase();
 if(process.env.NETIFY_CORE_MAIL_MODE!=='capture'&&!privateMailEnabled())throw new CoreError(503,'live_email_not_approved');
 await identityRate('requester:'+args.requester,20);await identityRate(args.purpose+':'+projectId+':'+email);await identityRate('project:'+projectId,10);
 if(args.purpose==='claim'){const p=await readCoreProject(projectId,args.edit??'');if(p.authority!=='edit')throw new CoreError(403,'edit_link_required');if(p.claimed)throw new CoreError(409,'anonymous_claiming_closed');}
 const challenge=token(),url=origin+coreLocationPath()+'?core='+projectId+'#verify='+challenge;
 const payload={from:CORE_SENDER,to:email,purpose:args.purpose,project_id:projectId,subject:args.purpose==='claim'?'Keep your private Netify project':'Recover your private Netify project',url,expires_in_minutes:15,private_only:true,environment:coreEnvironment(),delivery:privateMailEnabled()?'pending_delivery':'captured_not_sent'};
 const mailId=randomUUID();
 const eligible=await sql.query('SELECT netify_core_phase1.begin_verification($1,$2,$3,$4,$5,$6,$7,$8)',[projectId,args.edit?sha(args.edit):'',args.purpose,privateHash('email:'+email),sealPrivate(email),sha(challenge),mailId,sealPrivate(payload)]);
 if(privateMailEnabled()&&eligible[0]?.begin_verification===true){
  try{const delivery=await sendPrivateVerification(payload,mailId);await sql.query("UPDATE netify_core_phase1.captured_mail SET status='accepted',delivery_id=$2,delivery_ids=array_append(delivery_ids,$2),next_attempt_at=NULL WHERE id=$1",[mailId,delivery.delivery_id]);}
  catch{await sql.query("UPDATE netify_core_phase1.captured_mail SET status='failed',next_attempt_at=clock_timestamp()+interval '1 minute' WHERE id=$1",[mailId]);throw new CoreError(503,'private_mail_delivery_not_confirmed');}
 }
 return {publisher:'Netify',version:IDENTITY_VERSION,status:privateMailEnabled()?'verification_requested':'captured_if_eligible',message:privateMailEnabled()?'If the details match, a private verification link has been requested. Check your work email.':'If the details match, a verification message is captured. No email has been sent.',expires_in_minutes:15,project_link:coreLocationPath()+'?core='+projectId,live_email:privateMailEnabled()};
}
export async function completeVerification(challenge:unknown,origin:string){const value=requireToken(challenge),base=trustedCoreOrigin(origin),session=token(),edit=token(),sql=coreDatabase();
 const rows=await sql.query('SELECT netify_core_phase1.complete_verification($1,$2,$3,$4) AS result',[sha(value),randomUUID(),sha(session),sha(edit)]),r=rows[0].result;
 if(r.error)throw new CoreError(404,'verification_unavailable');
 if(r.purpose==='claim'){await measureCoreEvent(r.project_id,'project_claimed','claim:'+r.project_id).catch(()=>console.error('platform_measurement_unavailable'));await queueOwnerNotification('project_claimed',r.project_id,r.project_id).catch(()=>console.error('owner_notification_queue_unavailable'));}
 return {publisher:'Netify',version:IDENTITY_VERSION,status:coreEnvironment()==='production'?'verified':'verified_in_development',project_id:r.project_id,revision:r.revision,purpose:r.purpose,session,edit_link:base+coreLocationPath()+'?core='+r.project_id+'#cap='+edit,edit_token:edit,private_only:true,live_email:privateMailEnabled()};
}
export async function ownerStatus(projectId:string,session:string){const sql=coreDatabase();if(!session||!/^[A-Za-z0-9_-]{43}$/.test(session))return {owner:false};
 const rows=await sql.query(`SELECT p.id,p.current_revision,p.expires_at,p.last_verified_owner_at,p.reminder_at,p.disposable_fixture FROM netify_core_phase1.projects p JOIN netify_core_phase1.owner_sessions s ON s.project_id=p.id AND s.owner_id=p.owner_id WHERE p.id::text=$1 AND s.token_hash=$2 AND s.expires_at>clock_timestamp() AND s.revoked_at IS NULL AND p.deletion_requested_at IS NULL AND p.expires_at>clock_timestamp()`,[projectId,sha(session)]);
 if(!rows.length)return {owner:false};const r=rows[0];return {owner:true,project_id:r.id,revision:r.current_revision,access_ends_at:r.expires_at,last_owner_activity_at:r.last_verified_owner_at,reminder_at:r.reminder_at,delete_in_development:coreEnvironment()==='production'||r.disposable_fixture,private_only:true};
}
export async function ownerAction(projectId:string,session:string,action:string,confirmed:boolean,origin:string){requireProjectId(projectId);requireToken(session);const allowed=['keep','replace_edit','replace_view','revoke_view','delete'];if(!allowed.includes(action)||!confirmed)throw new CoreError(422,'confirmation_required');
 const replacement=action.startsWith('replace_')?token():null,sql=coreDatabase();const result=(await sql.query('SELECT netify_core_phase1.owner_action($1,$2,$3,$4) AS result',[projectId,sha(session),action,replacement?sha(replacement):null]))[0].result;if(result.error)throw new CoreError(403,result.error);
 return {...result,...(replacement?{private_link:trustedCoreOrigin(origin)+coreLocationPath()+'?core='+projectId+'#cap='+replacement,authority:action==='replace_view'?'view':'edit'}:{}),...(action==='delete'?{status:'access_revoked_purge_pending',message:'Access has ended. The separate deletion worker must complete the purge.'}:{}),publisher:'Netify',private_only:true};
}
export async function retentionSweep(projectIds:string[]){const sql=coreDatabase(),results=[];if(process.env.NETIFY_CORE_MAIL_MODE!=='capture')throw new CoreError(503,'live_email_not_approved');
 for(const id of projectIds){requireProjectId(id);const rows=await sql.query('SELECT p.*,o.email_cipher FROM netify_core_phase1.projects p LEFT JOIN netify_core_phase1.owners o ON o.id=p.owner_id WHERE p.id=$1 AND p.disposable_fixture=true',[id]);if(!rows.length){results.push({project_id:id,status:'fixture_not_available'});continue;}const p=rows[0];
  if(!p.owner_id){results.push({project_id:id,status:new Date(p.expires_at).getTime()<=Date.now()?'access_ended':'active',purge_at:new Date(new Date(p.expires_at).getTime()+30*86400000).toISOString()});continue;}
  const due=(await sql.query("SELECT last_verified_owner_at+interval '24 months'<=clock_timestamp() AS due FROM netify_core_phase1.projects WHERE id=$1",[id]))[0].due;if(!due){results.push({project_id:id,status:'active'});continue;}
  const payload=sealPrivate({from:CORE_SENDER,to:openPrivate(p.email_cipher),purpose:'retention',project_id:id,message:'Keep this private project before its retention deadline.',delivery:'captured_not_sent'});
  await sql.transaction([sql.query("UPDATE netify_core_phase1.projects SET reminder_at=coalesce(reminder_at,clock_timestamp()),purge_after=coalesce(purge_after,least(expires_at,clock_timestamp()+interval '30 days')) WHERE id=$1",[id]),sql.query("INSERT INTO netify_core_phase1.captured_mail(id,project_id,purpose,payload_cipher,expires_at,next_attempt_at) VALUES($1,$2,'retention',$3,least($4::timestamptz,clock_timestamp()+interval '30 days'),clock_timestamp()+interval '1 day') ON CONFLICT(project_id) WHERE purpose='retention' DO UPDATE SET attempts=captured_mail.attempts+CASE WHEN captured_mail.status IN ('failed','bounced') AND captured_mail.next_attempt_at<=clock_timestamp() AND captured_mail.expires_at>clock_timestamp() THEN 1 ELSE 0 END,next_attempt_at=CASE WHEN captured_mail.expires_at>clock_timestamp() THEN least(captured_mail.expires_at,clock_timestamp()+interval '1 day') ELSE NULL END",[randomUUID(),id,payload,p.expires_at])]);
  results.push({project_id:id,status:'reminder_captured',live_email:false});
 }return {publisher:'Netify',results};
}
