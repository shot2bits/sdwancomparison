import {coreEnvironment} from '../src/lib/core-host';
import {coreOwnerCookie} from './context-identity-http';
import {identityRate,ownerStatus} from '../src/lib/core-identity';
import {sha} from '../src/lib/core-phase1';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {CoreError,createCoreProject,readCoreProject,saveCoreProject,coreProjection} from '../src/lib/core-phase1';
import {previewBackupImport,importBackup} from '../src/lib/core-backup-import';
const buckets=new Map<string,{at:number,count:number}>();
export async function corePhase1Http(req:IncomingMessage,res:ServerResponse,url:URL,origin:string){
 if(!url.pathname.startsWith('/api/context-preview/core'))return false;
 const send=(status:number,data:unknown)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
 try{
  if(process.env.NETIFY_CORE_ENABLED!=='1'||req.headers.host!==new URL(origin).host)throw new CoreError(403,'local_development_only');
  if(req.method==='GET'&&url.pathname==='/api/context-preview/core/status'){send(200,{enabled:true,environment:coreEnvironment()});return true;}
  const parts=url.pathname.split('/').filter(Boolean),id=parts[3];
  const token=(req.headers.authorization??'').replace(/^Bearer /,'');
  if(req.method==='GET'&&id){send(200,url.pathname.endsWith('/projection')?await coreProjection(id,token):await readCoreProject(id,token));return true;}
  if(req.method!=='POST'||req.headers.origin!==origin||!req.headers['content-type']?.startsWith('application/json'))throw new CoreError(403,'same_origin_json_required');
  const chunks:Buffer[]=[];let size=0;for await(const c of req){const b=Buffer.from(c);size+=b.length;if(size>5_000_000)throw new CoreError(413,'project_too_large_not_truncated',{message:'Request exceeds 5,000,000 UTF-8 bytes. Nothing was shortened or saved.'});chunks.push(b);}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(coreEnvironment()==='production'){const ip=req.socket.remoteAddress??'not-provided';await identityRate('core:web:'+sha(ip),600);if(!id||id==='import'){await identityRate('core:create:'+sha(ip),10);await identityRate('core:create:global',100);}}
  const bucket=buckets.get(req.socket.remoteAddress??'local')??{at:Date.now(),count:0};if(Date.now()-bucket.at>60000){bucket.at=Date.now();bucket.count=0;}bucket.count++;buckets.set(req.socket.remoteAddress??'local',bucket);if(bucket.count>60)throw new CoreError(429,'local_request_limit');
  if(id==='import-preview'){const plan=previewBackupImport(data.backup,data.new_project_id);send(200,{publisher:'Netify',environment:coreEnvironment(),reconciliation:plan.reconciliation,preview_hash:plan.preview_hash});return true;}
  if(id==='import'){send(201,await importBackup(data.backup,data.new_project_id,data.preview_hash,data.operation_id,origin,data.credentials));return true;}
  if(!id){send(201,await createCoreProject(data.snapshot,data.operation_id,origin,data.credentials));return true;}
  if(parts.length!==4)throw new CoreError(404,'operation_not_available_in_phase1');
  const session=coreOwnerCookie(req),owner=process.env.NETIFY_CORE_PHASE23==='1'?await ownerStatus(id,session):{owner:false};
  send(200,await saveCoreProject(id,token,data.snapshot,data.base_revision,data.operation_id,owner.owner?{type:'verified_owner',ref:'web-owner',owner_session_hash:sha(session)}:undefined));
 }catch(error){if(error instanceof CoreError)send(error.status,{publisher:'Netify',environment:coreEnvironment(),error:error.code,...error.detail});else send(422,{publisher:'Netify',environment:coreEnvironment(),error:'save_status_not_confirmed',message:'Check the saved revision and retry with the same operation key if needed. Keep your local edits.'});}
 return true;
}
