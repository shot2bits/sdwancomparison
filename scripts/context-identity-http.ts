import {reviewDeskRequest,approveDeskRequest,readDeskStatus} from '../src/lib/core-desk';
import {coreOriginAllowed} from '../src/lib/core-host';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {CoreError} from '../src/lib/core-phase1';
import {guardAnonymousSend,SendGuardError} from '../src/lib/send-guard';
import {requestVerification,completeVerification,ownerStatus,ownerAction,identityRate} from '../src/lib/core-identity';
export function coreOwnerCookie(req:IncomingMessage){return req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('netify_core_owner='))?.slice('netify_core_owner='.length)??'';}
export async function coreIdentityHttp(req:IncomingMessage,res:ServerResponse,url:URL,origin:string){
 if(!url.pathname.startsWith('/api/context-preview/core/identity'))return false;
 const send=(status:number,data:unknown,cookie?:string,extra:Record<string,string>={})=>{res.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff',...(cookie?{'set-cookie':cookie}:{}),...extra});res.end(JSON.stringify(data));};
 try{
  const action=url.pathname.split('/').filter(Boolean)[4],anonymousSend=req.method==='POST'&&action==='pricing-approve';
  // The anonymous send is guarded before anything else, including the feature flag, so abuse protection is identical wherever the route answers.
  if((!anonymousSend&&process.env.NETIFY_CORE_PHASE23!=='1')||!coreOriginAllowed(origin)||req.headers.host!==new URL(origin).host)throw new CoreError(403,'local_development_only');
  if(req.method==='GET'&&action==='desk-status'){send(200,await readDeskStatus(url.searchParams.get('project')??'',coreOwnerCookie(req)));return true;}
  if(req.method==='GET'&&action==='status'){send(200,await ownerStatus(url.searchParams.get('project')??'',coreOwnerCookie(req)));return true;}
  if(req.method!=='POST'||req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))throw new CoreError(403,'same_origin_json_required');
  const chunks:Buffer[]=[];let size=0;for await(const raw of req){const c=Buffer.from(raw);size+=c.length;if(size>64000)throw new CoreError(413,'identity_request_too_large');chunks.push(c);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(anonymousSend){const guarded=await guardAnonymousSend({channel:'desk',ip:req.socket.remoteAddress??'unknown',email:body.contact_email,honeypot:body.website,formElapsedMs:body.form_elapsed_ms});body.contact_email=guarded.email;if(process.env.NETIFY_CORE_PHASE23!=='1')throw new CoreError(403,'local_development_only');}
  const edit=(req.headers.authorization??'').replace(/^Bearer /,'');
  if(action==='pricing-review'){send(200,await reviewDeskRequest(body.project_id,edit,coreOwnerCookie(req),origin));return true;}
  if(action==='pricing-approve'){send(200,await approveDeskRequest(body.project_id,edit,coreOwnerCookie(req),body,origin));return true;}
  if(action==='claim'||action==='recover'){send(202,await requestVerification({projectId:body.project_id,edit,email:body.email,purpose:action==='claim'?'claim':'recover',origin,requester:req.socket.remoteAddress??'local'}));return true;}
  if(action==='verify'){await identityRate('verify:'+(req.socket.remoteAddress??'local'),30);const result=await completeVerification(body.token,origin);const {session,...safe}=result;send(200,safe,'netify_core_owner='+session+'; Path='+(process.env.VERCEL_ENV?'/sase':'')+'/api/context-preview/core; HttpOnly; SameSite=Strict; Max-Age=604800'+(process.env.VERCEL_ENV?'; Secure':''));return true;}
  if(action==='owner-action'){send(200,await ownerAction(body.project_id,coreOwnerCookie(req),body.action,body.confirmed===true,origin));return true;}
  throw new CoreError(404,'identity_action_unavailable');
 }catch(e){if(e instanceof SendGuardError)send(e.status,{error:e.code,message:e.userMessage},undefined,e.retryAfterSeconds?{'retry-after':String(e.retryAfterSeconds)}:{});else if(e instanceof CoreError)send(e.status,{error:e.code,...e.detail});else send(422,{error:'identity_request_not_completed'});}return true;
}
