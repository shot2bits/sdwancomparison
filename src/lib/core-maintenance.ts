import {deliverDeskRequest} from './core-desk';
import {dailyOwnerSummary} from './final-notifications';
/** Retention is based on successful scope edits or verified owner activity, never reads. */
import {randomUUID} from 'node:crypto';import {neon} from '@neondatabase/serverless';
import {coreDatabase,CoreError} from './core-phase1';import {coreEnvironment,CORE_LIVE_HOST,coreLocationPath} from './core-host';import {openPrivate,sealPrivate} from './core-identity';import {privateMailEnabled,sendPrivateVerification,sendRetentionNotice} from './core-mail';
export async function runCoreMaintenance(fixtureIds?:string[]){
 const live=coreEnvironment()==='production';if(!live&&(!fixtureIds?.length||fixtureIds.length>100))throw new CoreError(403,'explicit_development_fixtures_required');
 const sql=coreDatabase(),workerUrl=process.env.NETIFY_CORE_PURGE_DATABASE_URL??'',host=new URL(workerUrl).hostname;if(host!==(live?CORE_LIVE_HOST:'ep-old-union-zaxn5pyr-pooler.c-2.eu-west-2.aws.neon.tech'))throw new CoreError(503,'purge_connection_mismatch');const purge=neon(workerUrl);
 const counts={examined:0,reminders_queued:0,mail_accepted:0,mail_failed:0,purged:0,transients_deleted:0,desk_accepted:0,desk_failed:0};
 const rows=await sql.query(`SELECT p.id,p.owner_id,p.expires_at,p.reminder_at,p.purge_after,p.deletion_requested_at,o.email_cipher,p.last_verified_owner_at+interval '24 months'<=clock_timestamp() AS reminder_due FROM netify_core_phase1.projects p LEFT JOIN netify_core_phase1.owners o ON o.id=p.owner_id WHERE ${live?"p.environment='production' AND (p.deletion_requested_at IS NOT NULL OR p.owner_id IS NULL AND p.expires_at+interval '30 days'<=clock_timestamp() OR p.owner_id IS NOT NULL AND p.last_verified_owner_at+interval '24 months'<=clock_timestamp())":"p.disposable_fixture=true AND p.id=ANY($1::uuid[])"} LIMIT 100`,live?[]:[fixtureIds]);
 for(const p of rows){counts.examined++;
  const purgeDue=p.deletion_requested_at||!p.owner_id&&new Date(p.expires_at).getTime()+30*86400000<=Date.now()||p.owner_id&&p.reminder_at&&p.purge_after&&new Date(p.purge_after).getTime()<=Date.now();
  if(purgeDue){const r=(await purge.query('SELECT netify_core_phase1.purge_project($1,$2) AS result',[p.id,randomUUID()]))[0].result;if(r.status==='purged')counts.purged++;continue;}
  if(!p.owner_id||!p.reminder_due)continue;
  const state=(await sql.query("UPDATE netify_core_phase1.projects SET reminder_at=coalesce(reminder_at,clock_timestamp()),purge_after=coalesce(purge_after,least(expires_at,clock_timestamp()+interval '30 days')) WHERE id=$1 RETURNING purge_after",[p.id]))[0];
  const deadline=new Date(state.purge_after).toISOString(),payload=sealPrivate({to:openPrivate(p.email_cipher),url:'https://netify.co.uk'+coreLocationPath()+'?core='+p.id,deadline});
  const queued=await sql.query("INSERT INTO netify_core_phase1.captured_mail(id,project_id,purpose,payload_cipher,expires_at,next_attempt_at) VALUES($1,$2,'retention',$3,$4,clock_timestamp()) ON CONFLICT(project_id) WHERE purpose='retention' DO NOTHING RETURNING id",[randomUUID(),p.id,payload,deadline]);counts.reminders_queued+=queued.length;
 }
 if(privateMailEnabled()){
  const due=await sql.query(`SELECT m.id,m.purpose,m.payload_cipher,m.delivery_round FROM netify_core_phase1.captured_mail m JOIN netify_core_phase1.projects p ON p.id=m.project_id WHERE ${live?"p.environment='production'":"p.disposable_fixture=true AND p.id=ANY($1::uuid[])"} AND m.status IN ('captured','failed','bounced') AND m.expires_at>clock_timestamp() AND coalesce(m.next_attempt_at,m.created_at)<=clock_timestamp() AND (m.purpose='retention' OR m.created_at>clock_timestamp()-interval '14 minutes') ORDER BY m.created_at LIMIT 100`,live?[]:[fixtureIds]);
  for(const m of due){try{const payload=openPrivate(m.payload_cipher);const deliveryKey=m.id+(m.delivery_round?'-r'+m.delivery_round:'');const d=m.purpose==='retention'?await sendRetentionNotice(payload,deliveryKey):await sendPrivateVerification(payload,deliveryKey);await sql.query("UPDATE netify_core_phase1.captured_mail SET status='accepted',delivery_id=$2,delivery_ids=array_append(delivery_ids,$2),attempts=attempts+1,next_attempt_at=NULL WHERE id=$1",[m.id,d.delivery_id]);counts.mail_accepted++;}catch{await sql.query("UPDATE netify_core_phase1.captured_mail SET status='failed',attempts=attempts+1,next_attempt_at=least(expires_at,clock_timestamp()+CASE WHEN purpose='retention' THEN interval '1 day' ELSE interval '1 minute' END) WHERE id=$1",[m.id]);counts.mail_failed++;}}
 }
 if(process.env.NETIFY_CORE_DESK_ENABLED==='1'&&privateMailEnabled()){
  await sql.query(`UPDATE netify_core_phase1.desk_requests d SET status='stale',next_attempt_at=NULL FROM netify_core_phase1.projects p WHERE p.id=d.project_id AND p.current_revision<>d.revision AND d.status IN ('approved','failed','sending') AND ${live?"p.environment='production'":"p.disposable_fixture=true AND p.id=ANY($1::uuid[])"}`,live?[]:[fixtureIds]);
  const waiting=await sql.query(`SELECT d.id FROM netify_core_phase1.desk_requests d JOIN netify_core_phase1.projects p ON p.id=d.project_id WHERE ${live?"p.environment='production'":"p.disposable_fixture=true AND p.id=ANY($1::uuid[])"} AND p.current_revision=d.revision AND p.expires_at>clock_timestamp() AND p.deletion_requested_at IS NULL AND d.status IN ('approved','failed','sending') AND coalesce(d.next_attempt_at,d.approved_at)<=clock_timestamp() LIMIT 25`,live?[]:[fixtureIds]);
  for(const d of waiting)try{await deliverDeskRequest(d.id,live?'https://netify.co.uk':'http://127.0.0.1:3023');counts.desk_accepted++;}catch{counts.desk_failed++;}
 }
 const cleaned=(await purge.query('SELECT netify_core_phase1.cleanup_transients() AS result',[]))[0].result;counts.transients_deleted=cleaned.deleted_transient_rows;
 await dailyOwnerSummary();
 return {publisher:'Netify',environment:coreEnvironment(),...counts};
}
