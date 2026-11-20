import {coreDatabase} from './core-phase1';
import {recordOwnerDelivery} from './final-notifications';
/** Verified private-project mail only. No sign-in publication or supplier flow is reused. */
import {CoreError} from './core-phase1';
export const privateMailEnabled=()=>process.env.NETIFY_CORE_MAIL_MODE==='live'&&process.env.NETIFY_CORE_MAIL_READY==='1'&&process.env.NETIFY_CORE_SECURITY_TRACKING_OFF==='1';
export async function sendPrivateVerification(payload:{to:string;subject:string;url:string},id:string){
 if(!privateMailEnabled()||!process.env.RESEND_API_KEY)throw new CoreError(503,'private_mail_not_enabled');
 const testTo=process.env.NETIFY_CORE_MAIL_TEST_TO?.trim().toLowerCase();if(testTo&&payload.to!==testTo)throw new CoreError(503,'owner_mail_test_only');
 const u=new URL(payload.url);if(u.protocol!=='https:'||!(u.hostname==='netify.co.uk'||process.env.VERCEL_ENV==='preview'&&u.host===process.env.VERCEL_URL)||!u.hash.startsWith('#verify='))throw new CoreError(422,'invalid_private_mail_link');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+process.env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':'netify-private-'+id},body:JSON.stringify({from:'Netify <no-reply@mail.netify.co.uk>',to:[payload.to],subject:payload.subject,tags:[{name:'netify_channel',value:'private_core'}],text:'Confirm access to your private Netify project:\n\n'+payload.url+'\n\nThis link expires in 15 minutes. It does not publish your project or authorise supplier contact. If you did not request it, ignore this message.'}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new CoreError(503,'private_mail_delivery_not_confirmed');const result=await response.json();if(typeof result.id!=='string')throw new CoreError(503,'private_mail_delivery_not_confirmed');return {accepted:true,delivery_id:result.id};
}
export async function sendRetentionNotice(payload:{to:string;url:string;deadline:string},id:string){
 if(!privateMailEnabled()||!process.env.RESEND_API_KEY)throw new CoreError(503,'private_mail_not_enabled');
 const testTo=process.env.NETIFY_CORE_MAIL_TEST_TO?.trim().toLowerCase();if(testTo&&payload.to!==testTo)throw new CoreError(503,'owner_mail_test_only');
 const url=new URL(payload.url);if(url.protocol!=='https:'||!(url.hostname==='netify.co.uk'||process.env.VERCEL_ENV==='preview'&&url.host===process.env.VERCEL_URL)||url.hash)throw new CoreError(422,'invalid_private_mail_link');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+process.env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':'netify-retention-'+id},body:JSON.stringify({from:'Netify <no-reply@mail.netify.co.uk>',to:[payload.to],subject:'Keep or delete your private Netify project',tags:[{name:'netify_channel',value:'private_core'}],text:'Your private Netify project is due for deletion on '+payload.deadline+'.\n\nOpen your project, verify your work email if required, and select Keep this project to retain it:\n'+payload.url+'\n\nIf no action is taken, access and live records will be deleted at the retention deadline. Database recovery history expires within six hours of purge. Downloaded exports remain under your control.'}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new CoreError(503,'private_mail_delivery_not_confirmed');const result=await response.json();if(typeof result.id!=='string')throw new CoreError(503,'private_mail_delivery_not_confirmed');return {accepted:true,delivery_id:result.id};
}

/** Called only after the existing Resend webhook's signature has been verified. */
export async function recordPrivateMailEvent(deliveryId:string,event:string){
 if(!deliveryId||!['email.delivered','email.bounced','email.complained'].includes(event))return false;
 await recordOwnerDelivery(deliveryId,event);
 const sql=coreDatabase();const status=event==='email.delivered'?'delivered':event==='email.bounced'?'bounced':'suppressed';
 const rows=await sql.query("UPDATE netify_core_phase1.captured_mail SET status=$2,delivery_round=delivery_round+CASE WHEN $2='bounced' THEN 1 ELSE 0 END,last_bounced_delivery_id=CASE WHEN $2='bounced' THEN $1 ELSE last_bounced_delivery_id END,next_attempt_at=CASE WHEN $2='bounced' AND expires_at>clock_timestamp() THEN least(expires_at,clock_timestamp()+CASE WHEN purpose='retention' THEN interval '1 day' ELSE interval '1 minute' END) ELSE NULL END WHERE delivery_id=$1 AND status<>$2 AND ($2<>'bounced' OR last_bounced_delivery_id IS DISTINCT FROM $1) RETURNING id",[deliveryId,status]);
 const desk=await sql.query("UPDATE netify_core_phase1.desk_requests SET status=$2,next_attempt_at=NULL WHERE delivery_id=$1 AND $2 IN ('bounced','suppressed') RETURNING project_id,revision",[deliveryId,status]);
 for(const d of desk)await sql.query("UPDATE netify_core_phase1.projects SET status='draft' WHERE id=$1 AND current_revision=$2",[d.project_id,d.revision]);
 const existing=rows.length?rows:await sql.query('SELECT id FROM netify_core_phase1.captured_mail WHERE delivery_id=$1 OR $1=ANY(delivery_ids)',[deliveryId]);return existing.length>0||desk.length>0;
}
