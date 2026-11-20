import 'server-only';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {type PlatformStore} from './final-platform-store';
import {CoreError,sha} from './core-phase1';
export const AGENT_SCOPES=['project:read','project:write'] as const;
export const AGENT_ORIGIN=process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:'https://netify.co.uk';
/** Marketplace-owned authorisation server. Discovery lives under /sase/. The main-site MCP can reuse this issuer, see docs/oauth-issuer.md. */
export const AGENT_ISSUER=AGENT_ORIGIN+'/sase';
export const AGENT_RESOURCE=AGENT_ORIGIN+'/sase/api/mcp/';
export const MAIN_SITE_MCP_RESOURCE='https://netify.co.uk/api/mcp/';
export const OAUTH_ENDPOINT=AGENT_ORIGIN+'/sase/oauth/';
export function allowedResource(resource:string){
 return resource===AGENT_RESOURCE||resource===MAIN_SITE_MCP_RESOURCE||resource==='https://netify.co.uk/sase/api/mcp/';
}
function blockedMetadataHost(host:string){
 const h=host.toLowerCase().replace(/\.$/,'');
 if(h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.arpa')||h==='metadata.google.internal')return true;
 if(/^\d+\.\d+\.\d+\.\d+$/.test(h)){
  const [a,b]=h.split('.').map(Number);
  if(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127))return true;
 }
 if(h.includes(':'))return true;
 return false;
}
const clientMetadataDoc=z.object({
 client_id:z.string().url().optional(),
 client_name:z.string().min(1).max(150),
 redirect_uris:z.array(z.string().url()).min(1).max(10),
 token_endpoint_auth_method:z.literal('none').optional(),
 grant_types:z.array(z.string()).optional()
}).passthrough();
/** Client ID Metadata Document (CIMD). HTTPS URL client_id, no private hosts, no redirects, 3s and 64KB limits. */
export async function readClientIdMetadata(clientId:string){
 let url:URL;try{url=new URL(clientId);}catch{throw new CoreError(400,'invalid_client_metadata');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||blockedMetadataHost(url.hostname)||(url.port&&url.port!=='443'))throw new CoreError(400,'invalid_client_metadata');
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),3000);
 try{
  const res=await fetch(url.href,{method:'GET',redirect:'error',signal:ac.signal,headers:{accept:'application/json','user-agent':'Netify-OAuth-CIMD'}});
  if(!res.ok)throw new CoreError(400,'invalid_client_metadata');
  const text=await res.text();if(text.length>65536)throw new CoreError(400,'invalid_client_metadata');
  const doc=clientMetadataDoc.parse(JSON.parse(text));
  if(doc.client_id&&doc.client_id!==clientId)throw new CoreError(400,'invalid_client_metadata');
  if(doc.redirect_uris.some(r=>{const u=new URL(r);return u.protocol!=='https:'||u.hash||u.username||u.password||u.hostname===url.hostname&&u.pathname===url.pathname;}))throw new CoreError(400,'invalid_redirect_uri');
  return {client_name:doc.client_name,redirect_uris:doc.redirect_uris,token_endpoint_auth_method:'none' as const,client_id:clientId,via:'cimd' as const};
 }catch(e){if(e instanceof CoreError)throw e;throw new CoreError(400,'invalid_client_metadata');}
 finally{clearTimeout(timer);}
}
type AgentClient={client_id:string;client_name:string;redirect_uris:string[];token_endpoint_auth_method?:string;via?:'cimd'};
type Grant={clientId:string;redirect:string;resource:string;scope:string[];projectId:string;ownerId:string;capCipher:string;expiresAt:string;challenge:string;used:boolean};
type Token={clientId:string;resource:string;scope:string[];projectId:string;ownerId:string;capCipher:string;expiresAt:string;refreshHash:string;refreshExpires:string;revoked:boolean};
const registration=z.object({client_name:z.string().min(1).max(150),redirect_uris:z.array(z.string().url()).min(1).max(10),token_endpoint_auth_method:z.literal('none').default('none'),grant_types:z.array(z.enum(['authorization_code','refresh_token'])).default(['authorization_code']),response_types:z.array(z.literal('code')).default(['code'])}).passthrough();
const random=()=>randomBytes(32).toString('base64url');
export class FinalAgentAuth {
 constructor(private store:PlatformStore,private seal:(v:string)=>string,private open:(v:string)=>string,private clock=()=>new Date()){}
 async register(raw:unknown){const a=registration.parse(raw);if(a.redirect_uris.some(r=>{const u=new URL(r);return u.protocol!=='https:'||u.hash||u.username||u.password;}))throw new CoreError(400,'invalid_redirect_uri');const clientId=random();await this.store.change('agent_client',clientId,()=>({value:{...a,client_id:clientId,at:this.clock().toISOString()},result:true}));return {...a,client_id:clientId,client_id_issued_at:Math.floor(this.clock().getTime()/1000)};}
 async request(a:Record<string,string>){let c=(await this.store.read<AgentClient>('agent_client',a.client_id))?.value;if(!c&&typeof a.client_id==='string'&&a.client_id.startsWith('https://'))c=await readClientIdMetadata(a.client_id);if(!c||!c.redirect_uris.includes(a.redirect_uri))throw new CoreError(400,'invalid_client_or_redirect');const scopes=(a.scope??'project:read').split(' ').filter(Boolean);if(a.response_type!=='code'||!allowedResource(a.resource)||a.code_challenge_method!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(a.code_challenge)||!scopes.length||scopes.some(s=>!(AGENT_SCOPES as readonly string[]).includes(s))||!a.state||a.state.length>2000)throw new CoreError(400,'invalid_authorization_request');return {client:c,scopes};}
 async consent(a:Record<string,string>,p:{ownerId:string;projectId:string;capability:string}){const validated=await this.request(a);const code=random(),grant:Grant={clientId:a.client_id,redirect:a.redirect_uri,resource:a.resource,scope:validated.scopes,projectId:p.projectId,ownerId:p.ownerId,capCipher:this.seal(p.capability),expiresAt:new Date(this.clock().getTime()+5*60000).toISOString(),challenge:a.code_challenge,used:false};await this.store.change('agent_code',sha(code),()=>({value:grant,result:true}),p.projectId);const redirect=new URL(a.redirect_uri);redirect.searchParams.set('code',code);redirect.searchParams.set('state',a.state);redirect.searchParams.set('iss',AGENT_ISSUER);return redirect.href;}
 async exchange(a:Record<string,string>){if(a.grant_type==='refresh_token')return this.refresh(a);if(a.grant_type!=='authorization_code'||!a.code||!a.client_id||!a.code_verifier||!/^[A-Za-z0-9._~-]{43,128}$/.test(a.code_verifier))throw new CoreError(400,'invalid_grant');const grant=await this.store.change<Grant,Grant>('agent_code',sha(a.code),g=>{if(!g||g.used||Date.parse(g.expiresAt)<=this.clock().getTime()||g.clientId!==a.client_id||g.redirect!==a.redirect_uri||g.resource!==a.resource||createHash('sha256').update(a.code_verifier).digest('base64url')!==g.challenge)throw new CoreError(400,'invalid_grant');return {value:{...g,used:true},result:g};});return this.issue(grant);}
 private async issue(grant:Pick<Grant,'clientId'|'resource'|'scope'|'projectId'|'ownerId'|'capCipher'>){const access=random(),refresh=random(),token:Token={...grant,expiresAt:new Date(this.clock().getTime()+3600000).toISOString(),refreshHash:sha(refresh),refreshExpires:new Date(this.clock().getTime()+7*86400000).toISOString(),revoked:false};await this.store.change('agent_token',sha(access),()=>({value:token,result:true}),grant.projectId);return {access_token:'netify_agent_'+access,token_type:'Bearer',expires_in:3600,refresh_token:'netify_refresh_'+sha(access)+'.'+refresh,scope:grant.scope.join(' ')};}
 private async refresh(a:Record<string,string>){const parts=a.refresh_token?.match(/^netify_refresh_([a-f0-9]{64})\.([A-Za-z0-9_-]{43})$/);if(!parts)throw new CoreError(400,'invalid_grant');const id=parts[1],hash=sha(parts[2]),row=await this.store.read<Token>('agent_token',id);if(!row)throw new CoreError(400,'invalid_grant');const token=await this.store.change<Token,Token>('agent_token',id,t=>{if(!t||t.refreshHash!==hash||t.revoked||t.clientId!==a.client_id||t.resource!==a.resource||Date.parse(t.refreshExpires)<=this.clock().getTime())throw new CoreError(400,'invalid_grant');return {value:{...t,revoked:true},result:t};},row.value.projectId);return this.issue(token);}
 async authenticate(raw:string,projectId:string|undefined,write:boolean){if(!raw.startsWith('netify_agent_'))throw new CoreError(401,'assistant_sign_in_required');const token=(await this.store.read<Token>('agent_token',sha(raw.slice(13))))?.value;if(!token||token.revoked||Date.parse(token.expiresAt)<=this.clock().getTime()||token.resource!==AGENT_RESOURCE||!token.scope.includes(write?'project:write':'project:read')||projectId&&token.projectId!==projectId)throw new CoreError(403,'assistant_scope_not_granted');return {...token,capability:this.open(token.capCipher)};}
 async revoke(raw:string,ownerId:string){const hash=sha(raw.replace(/^netify_agent_/,''));await this.store.change<Token,boolean>('agent_token',hash,t=>{if(!t||t.ownerId!==ownerId)throw new CoreError(403,'verified_owner_required');return {value:{...t,revoked:true},result:true};});}
}
export async function projectAgentToken(raw:string,projectId:string|undefined,write:boolean){const {platformStore}=await import('./final-platform-store'),identity=await import('./core-identity');return new FinalAgentAuth(platformStore,identity.sealPrivate,v=>String(identity.openPrivate(v))).authenticate(raw,projectId,write);}
