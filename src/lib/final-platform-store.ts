import 'server-only';
import {coreDatabase,CoreError} from './core-phase1';
import {coreEnvironment} from './core-host';
export type RecordKind='supplier'|'commercial'|'supplier_grant'|'supplier_document'|'supplier_capture'|'organisation'|'membership'|'mandate'|'agent_client'|'agent_code'|'agent_token'|'public_evidence'|'reseller_enquiry';
export type ScopeGuard={projectId:string;scopeHash:string;revision:number;ownerId:string};
export interface PlatformStore {
 read<T>(kind:RecordKind,id:string):Promise<{revision:number;value:T}|null>;
 list<T>(kind:RecordKind,projectId?:string):Promise<{id:string;revision:number;value:T}[]>;
 change<T,R>(kind:RecordKind,id:string,work:(value:T|null)=>{value:T;result:R},projectId?:string,guard?:ScopeGuard):Promise<R>;
}
/** Shared optimistic transaction: conflicts never replay side effects or overwrite a newer record. */
export class NeonPlatformStore implements PlatformStore {
 async read<T>(kind:RecordKind,id:string){const rows=await coreDatabase().query('SELECT revision,payload FROM netify_core_phase1.platform_records WHERE kind=$1 AND id=$2 AND environment=$3',[kind,id,coreEnvironment()]);return rows[0]?{revision:Number(rows[0].revision),value:rows[0].payload as T}:null;}
 async list<T>(kind:RecordKind,projectId?:string){const rows=await coreDatabase().query('SELECT id,revision,payload FROM netify_core_phase1.platform_records WHERE kind=$1 AND environment=$2 AND ($3::uuid IS NULL OR project_id=$3) ORDER BY created_at,id',[kind,coreEnvironment(),projectId??null]);return rows.map(r=>({id:r.id,revision:Number(r.revision),value:r.payload as T}));}
 async change<T,R>(kind:RecordKind,id:string,work:(value:T|null)=>{value:T;result:R},projectId?:string,guard?:ScopeGuard){const prior=await this.read<T>(kind,id),next=work(prior?structuredClone(prior.value):null);const rows=prior?await coreDatabase().query(`WITH gate AS (SELECT p.id FROM netify_core_phase1.projects p JOIN netify_core_phase1.scope_revisions s ON s.project_id=p.id AND s.revision=p.current_revision WHERE p.id=$6::uuid AND p.current_revision=$7 AND p.owner_id=$8::uuid AND s.scope_hash=$9 AND p.deletion_requested_at IS NULL AND p.expires_at>clock_timestamp() FOR UPDATE OF p) UPDATE netify_core_phase1.platform_records SET payload=$3,revision=revision+1,updated_at=clock_timestamp() WHERE kind=$1 AND id=$2 AND revision=$4 AND environment=$5 AND ($6::uuid IS NULL OR EXISTS(SELECT 1 FROM gate)) RETURNING id`,[kind,id,JSON.stringify(next.value),prior.revision,coreEnvironment(),guard?.projectId??null,guard?.revision??null,guard?.ownerId??null,guard?.scopeHash??null]):await coreDatabase().query('INSERT INTO netify_core_phase1.platform_records(kind,id,payload,environment,project_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id',[kind,id,JSON.stringify(next.value),coreEnvironment(),projectId??null]);if(!rows.length)throw new CoreError(409,'record_changed_reload');return next.result;}
}
/** Disposable tests only. No public route selects this adapter. */
export class MemoryPlatformStore implements PlatformStore {
 private rows=new Map<string,{revision:number;value:unknown;projectId?:string}>();
 async read<T>(kind:RecordKind,id:string){return structuredClone(this.rows.get(kind+':'+id)??null) as {revision:number;value:T}|null;}
 async list<T>(kind:RecordKind,projectId?:string){return [...this.rows].filter(([k,r])=>k.startsWith(kind+':')&&(!projectId||r.projectId===projectId)).map(([k,r])=>({id:k.slice(kind.length+1),revision:r.revision,value:structuredClone(r.value) as T}));}
 async change<T,R>(kind:RecordKind,id:string,work:(value:T|null)=>{value:T;result:R},projectId?:string){const prior=await this.read<T>(kind,id),next=work(prior?.value??null);if((this.rows.get(kind+':'+id)?.revision??0)!==(prior?.revision??0))throw new CoreError(409,'record_changed_reload');this.rows.set(kind+':'+id,{revision:(prior?.revision??0)+1,value:structuredClone(next.value),projectId});return next.result;}
}
export const platformStore=new NeonPlatformStore();
