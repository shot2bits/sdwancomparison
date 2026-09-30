import {activityEnvironment} from './activity-provenance';
import {activityKvBinding} from './activity-storage';

/** Capture is opt-in, preview-only, and requires physically isolated storage. */
export function previewMailCaptureEnabled(): boolean {
 const binding=activityKvBinding();
 return activityEnvironment()==='preview' && process.env.NETIFY_PREVIEW_MAIL_CAPTURE==='1' && Boolean(binding.url&&binding.token);
}
export function activityMailKey(): string | undefined {
 return previewMailCaptureEnabled() ? 'preview-capture-no-external-delivery' : activityEnvironment()==='production' ? process.env.RESEND_API_KEY : undefined;
}
export type CapturedMail = {id:string; captured_at:number; expires_at:number; payload_hash:string; payload:Record<string,unknown>; delivery:'captured_not_sent'};

/** No external fetch is possible outside production. Capture has no public inbox. */
export async function activityMailFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 if(activityEnvironment()==='production')return fetch(input,init);
 if(!previewMailCaptureEnabled())throw new Error('External mail is disabled outside production');
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url!=='https://api.resend.com/emails'||init?.method!=='POST'||typeof init.body!=='string'||init.body.length>2_000_000)throw new Error('Unsupported preview mail request');
 const payload=JSON.parse(init.body) as Record<string,unknown>;
 if(!payload||typeof payload!=='object'||!payload.to||typeof payload.subject!=='string')throw new Error('Invalid preview mail');
 // Transactional links must return to this deployment, never to the live app.
 const host=process.env.VERCEL_URL;
 if(!host || !/^[a-z0-9-]+\.vercel\.app$/i.test(host))throw new Error('Preview mail requires a verified deployment host');
 for(const field of ['html','text'])if(typeof payload[field]==='string')payload[field]=payload[field].replaceAll('https://netify.co.uk/sase',`https://${host}/sase`);
 const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
 const hash=await digest(JSON.stringify(payload));
 const idempotency=new Headers(init.headers).get('Idempotency-Key');
 const id=idempotency?await digest(idempotency):crypto.randomUUID();
 const record:CapturedMail={id:`capture_${id}`,captured_at:Date.now(),expires_at:Date.now()+86400000,payload_hash:hash,payload,delivery:'captured_not_sent'};
 // Keep this transport Edge-compatible: legacy lead routes use the Edge runtime.
 const binding=activityKvBinding();
 const kvRaw=async(command:(string|number)[])=>{
  const response=await fetch(binding.url!,{method:'POST',headers:{authorization:`Bearer ${binding.token}`,'content-type':'application/json'},body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Preview capture storage unavailable');
  const data=await response.json() as {result?:unknown;error?:string};
  if(data.error)throw new Error('Preview capture storage rejected the write');
  return data.result;
 };
 const key=`preview:mail:${record.id}`;
 const saved=await kvRaw(['SET',key,JSON.stringify(record),'NX','EX',86400]);
 if(saved!=='OK'){
  const raw=await kvRaw(['GET',key]);
  const previous=typeof raw==='string'?JSON.parse(raw) as CapturedMail:null;
  if(!previous||previous.payload_hash!==hash)return Response.json({error:'Conflicting captured mail idempotency key'},{status:409});
 }
 return Response.json({id:record.id,delivery:'captured_not_sent'});
}
