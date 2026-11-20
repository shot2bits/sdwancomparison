import {coreLocationPath,coreEnvironment,coreLiveEnabled,CORE_LIVE_BRANCH,CORE_LIVE_HOST} from './core-host';
import {normaliseEstate,detachLegacySchedule} from '../../preview/context-space/estate-projection.js';
import {contextCatalogue} from './context-comparison-preview';
import {neon} from '@neondatabase/serverless';
import {createHash} from 'node:crypto';
import {measureCoreScope} from './final-measurement-hooks';
import {readFile} from 'node:fs/promises';
import {ContextWorkingBackupSchema,buildContextProject} from './context-project-preview';
import {validateEstate,siteReviewSignature,userReviewSignature,effective} from '../../preview/context-space/location-model.js';

export const CORE_BRANCH='br-aged-union-zar77mut';
const DEV_HOST='ep-old-union-zaxn5pyr-pooler.c-2.eu-west-2.aws.neon.tech';
export class CoreError extends Error {constructor(public status:number,public code:string,public detail:Record<string,unknown>={}){super(code);}}
export function coreDatabase(){
 const live=coreEnvironment()==='production';
 if(process.env.NETIFY_CORE_ENABLED!=='1'||(live?!coreLiveEnabled()||process.env.NETIFY_CORE_BRANCH_ID!==CORE_LIVE_BRANCH:process.env.NETIFY_CORE_BRANCH_ID!==CORE_BRANCH))throw new CoreError(503,'core_disabled');
 const url=(process.env.NETIFY_CORE_PHASE23==='1'?process.env.NETIFY_CORE_RUNTIME_DATABASE_URL:process.env.NETIFY_CORE_DATABASE_URL)??'';
 if(new URL(url).hostname!==(live?CORE_LIVE_HOST:DEV_HOST))throw new CoreError(503,'development_branch_mismatch');
 return neon(url);
}
export const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
export function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function validatedSnapshot(raw:any){
 if(!raw)throw new CoreError(422,'invalid_project_snapshot');
 if(Buffer.byteLength(JSON.stringify(raw))>5_000_000)throw new CoreError(422,'project_too_large_not_truncated',{message:'Project exceeds 5,000,000 UTF-8 bytes. Nothing was shortened or saved.'});
 // Validate without replacing the original object: preserve original fields,
 // source rows, ordering and existing review signatures without truncation.
 const prepared=structuredClone(raw);prepared.estate=normaliseEstate(prepared.estate,prepared.packet.project.input);detachLegacySchedule(prepared.packet,prepared.estate,contextCatalogue().products);
 ContextWorkingBackupSchema.parse(prepared.packet);validateEstate(prepared.estate);
 if(raw.version!=='netify-core-snapshot/1'||!raw.siteDrafts||typeof raw.siteDrafts!=='object'||Array.isArray(raw.siteDrafts))throw new CoreError(422,'invalid_project_snapshot');
 for(const [id,draft] of Object.entries(raw.siteDrafts))if(!raw.estate.sites.some((s:any)=>s.id===id)||!draft||typeof draft!=='object'||Object.values(draft).some(v=>typeof v!=='string'||v.length>20000))throw new CoreError(422,'invalid_site_draft');
 if(prepared.pricingTerms){const t=prepared.pricingTerms;for(const k of Object.keys(t))if(!['termMonths','bandwidthMbps','accessType','resilience','includeConnectivity'].includes(k))throw new CoreError(422,'invalid_pricing_terms');if(t.termMonths!==null&&![12,24,36,60].includes(t.termMonths)||t.bandwidthMbps!==null&&!(Number.isFinite(t.bandwidthMbps)&&t.bandwidthMbps>0&&t.bandwidthMbps<=1000000)||typeof t.includeConnectivity!=='boolean'||['accessType','resilience'].some(k=>t[k]!==null&&(typeof t[k]!=='string'||t[k].length>20000)))throw new CoreError(422,'invalid_pricing_terms');}
 const copy=prepared;copy.packet.project.revision=0;if(Buffer.byteLength(JSON.stringify(copy))>5_000_000)throw new CoreError(422,'project_too_large_not_truncated',{message:'Project exceeds 5,000,000 UTF-8 bytes after normalisation. Nothing was shortened or saved.'});return copy;
}
export function scopeOf(snapshot:any){const p=snapshot.packet.project;return {input:p.input,document:p.document,selectedProviders:p.selectedProviders,estate:snapshot.estate,siteDrafts:snapshot.siteDrafts,pricingTerms:snapshot.pricingTerms??null,site_index:snapshot.estate.sites.map((s:any)=>({site_id:s.id,city:s.city,country:s.country,region:s.region,sector:p.input.sector,products:effective(snapshot.estate,s).products}))};}
function invalidateReviews(snapshot:any){
 const e=snapshot.estate,p=e.planning;if(!p)return snapshot;
 for(const s of e.sites)if(p.siteReviews?.[s.id]&&p.siteReviews[s.id]!==siteReviewSignature(e,s))delete p.siteReviews[s.id];
 if(p.userReview&&p.userReview!==userReviewSignature(e,snapshot.packet.project.input))delete p.userReview;
 return snapshot;
}
function tokenHash(token:string){if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new CoreError(404,'project_access_denied');return sha(token);}
export async function applyCoreSchema(){const sql=coreDatabase();const migration=await readFile('db/migrations/20261114_core_phase1.sql','utf8');const statements=migration.split(/(?=^(?:CREATE|REVOKE) )/m).filter(s=>/^(CREATE|REVOKE) /.test(s));await sql.transaction(statements.map(s=>sql.query(s,[])));return sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema='netify_core_phase1' ORDER BY table_name",[]);}
export async function createCoreProject(raw:any,operation:string,origin:string,credentials:{edit:string;view:string},importDetail?:{source_hash:string;raw_backup:string;reconciliation:unknown},creator?:{type:'browser'|'assistant';ref:string;instruction?:string}){
 if(!/^[a-f0-9-]{36}$/.test(operation))throw new CoreError(422,'operation_key_required');
 const snapshot=invalidateReviews(validatedSnapshot(raw));
 // The browser supplies a cryptographic project UUID; creation is idempotent
 // through one transaction. The same identity can never overwrite an estate.
 const id=snapshot.packet.project.id;const {edit,view}=credentials;tokenHash(edit);tokenHash(view);if(edit===view)throw new CoreError(422,'distinct_capabilities_required');
 // snapshot is a JSON string scalar inside JSONB to preserve key ordering used
 // by existing review signatures. scope is separately indexed JSONB, derived
 // from this same immutable snapshot in the transaction.
 const scope=scopeOf(snapshot),hash=sha(canonical(scope));const actor={...(creator??{type:'browser',ref:sha(edit).slice(0,16)}),environment:coreEnvironment()};const fixture=coreEnvironment()==='production'&&[process.env.NETIFY_CORE_SMOKE_PROJECT,process.env.NETIFY_CORE_SMOKE_CREATED_PROJECT].filter(Boolean).includes(id);
 const requestHash=sha(canonical({snapshot,import_source:importDetail?.source_hash??null}));
 const sql=coreDatabase();try{await sql.transaction([
  sql.query('INSERT INTO netify_core_phase1.projects(id,current_revision,disposable_fixture) VALUES($1,1,$2)',[id,fixture]),
  sql.query('INSERT INTO netify_core_phase1.scope_revisions(project_id,revision,scope_hash,scope,snapshot,actor) VALUES($1,1,$2,$3,$4,$5)',[id,hash,JSON.stringify(scope),JSON.stringify(JSON.stringify(snapshot)),JSON.stringify(actor)]),
  sql.query("INSERT INTO netify_core_phase1.capabilities(token_hash,project_id,authority) VALUES($1,$3,'edit'),($2,$3,'view')",[sha(edit),sha(view),id]),
  sql.query("INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail) VALUES($1,1,'project.created',$2,$3)",[id,JSON.stringify(actor),JSON.stringify({scope_hash:hash,...(importDetail?{import:importDetail}:{})})]),
  sql.query('INSERT INTO netify_core_phase1.operations VALUES($1,$2,$3,$4)',[id,operation,requestHash,JSON.stringify({created:true})])
 ]);}catch(error:any){if(error.code==='23505'){await readCoreProject(id,edit);const prior=await sql.query('SELECT request_hash FROM netify_core_phase1.operations WHERE project_id=$1 AND operation_id=$2',[id,operation]);if(prior[0]?.request_hash!==requestHash)throw new CoreError(409,'operation_key_reused');}else throw error;}
 await measureCoreScope(id,null,snapshot,operation,actor.type==='assistant'?'mcp':'web').catch(()=>console.error('platform_measurement_unavailable'));
 if(coreEnvironment()==='production'&&!fixture)console.info(JSON.stringify({event:'project_started',environment:'production',project_ref:sha(id).slice(0,16),actor:actor.type,test:false}));
 const link=(token:string)=>`${origin}${coreLocationPath()}?core=${id}#cap=${token}`;
 return {...await readCoreProject(id,edit),edit_link:link(edit),view_link:link(view),claim_available:process.env.NETIFY_CORE_PHASE23==='1'};
}
export async function readCoreProject(id:string,token:string){
 if(token.startsWith('reseller_'))await import('./final-reseller-runtime').then(m=>m.guardFinalDelegation(id,token));
 const sql=coreDatabase();const rows=await sql.query(`SELECT p.id,p.current_revision,p.expires_at,p.owner_id,p.last_verified_owner_at,p.reminder_at,p.purge_after,r.scope_hash,r.snapshot,c.authority FROM netify_core_phase1.projects p
 JOIN netify_core_phase1.scope_revisions r ON r.project_id=p.id AND r.revision=p.current_revision
 JOIN netify_core_phase1.capabilities c ON c.project_id=p.id
 WHERE p.id::text=$1 AND c.token_hash=$2 AND c.revoked_at IS NULL AND c.authority IN ('view','edit') AND p.expires_at>clock_timestamp()`,[id,tokenHash(token)]);
 if(!rows.length)throw new CoreError(404,'project_access_denied');const r=rows[0];
 return {publisher:'Netify',environment:coreEnvironment(),contract_version:'netify-core/1',project_id:r.id,revision:r.current_revision,scope_hash:r.scope_hash,expires_at:r.expires_at,authority:r.authority,snapshot:typeof r.snapshot==='string'?JSON.parse(r.snapshot):r.snapshot,project_link:`${coreLocationPath()}?core=${r.id}`,claim_available:!r.owner_id,claimed:Boolean(r.owner_id),owner_activity_at:r.last_verified_owner_at,reminder_at:r.reminder_at,purge_after:r.purge_after};
}
export async function saveCoreProject(id:string,token:string,raw:any,base:number,operation:string,actor?:{type:'browser'|'assistant'|'verified_owner';ref:string;instruction?:string;owner_session_hash?:string},commandHash?:string){
 if(!Number.isSafeInteger(base)||base<1||!/^[a-f0-9-]{36}$/.test(operation))throw new CoreError(422,'revision_and_operation_required');
 const snapshot=invalidateReviews(validatedSnapshot(raw));if(snapshot.packet.project.id!==id)throw new CoreError(422,'project_identity_mismatch');
 const before=await readCoreProject(id,token);
 const scope=scopeOf(snapshot),hash=sha(canonical(scope)),requestHash=commandHash??sha(canonical({snapshot,base}));const sql=coreDatabase();
 const rows=await sql.query('SELECT netify_core_phase1.save_scope($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result',[id,tokenHash(token),base,operation,requestHash,JSON.stringify(scope),JSON.stringify(JSON.stringify(snapshot)),hash,JSON.stringify({...actor??{type:'browser',ref:sha(token).slice(0,16)},environment:coreEnvironment()})]);
 const r=rows[0].result;if(r.error)throw new CoreError(r.error==='project_access_denied'?404:409,r.error,{current_revision:r.current_revision});await measureCoreScope(id,before.snapshot,snapshot,operation,actor?.type==='assistant'?'mcp':'web').catch(()=>console.error('platform_measurement_unavailable'));return {publisher:'Netify',environment:coreEnvironment(),...r};
}
export async function coreProjection(id:string,token:string){const project=await readCoreProject(id,token);const s=project.snapshot;let document=null;try{document=buildContextProject({...s.packet.project,revision:project.revision},s.estate);}catch{/* An incomplete brief is saved, never invented to force a document. */}
 return {project,sites:s.estate.sites.map((site:any)=>({...site,effective:effective(s.estate,site)})),living_rfp:document?.markdown??null};}
