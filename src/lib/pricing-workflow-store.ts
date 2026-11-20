import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {z} from 'zod';
import {ProcurementFoundationSchema} from './procurement-foundation';
import {PricedScopeSchema,StructuredQuotationSchema,SupplierPricingSettingsSchema} from './priced-scope';
const text=z.string().min(1),date=z.string().datetime({offset:true});
const request=z.object({id:text,environment:z.enum(['test','live']),projectId:text,scope:PricedScopeSchema,scopeHash:text,recipients:z.array(z.object({supplierId:text,name:text,contact:text,components:z.array(text),responseTargetHours:z.number().nullable(),responseDueAt:date.nullable()}).strict()),disclosedFields:z.array(text),preparedAt:date,authorityHash:text.optional(),delivery:z.object({channel:z.literal('email'),mode:z.literal('internal_test_capture'),actualDestination:z.literal('support@netify.com'),sender:z.literal('not_configured')}).strict().optional(),previewHash:text,approvedAt:date.nullable(),approvedBy:text.nullable(),dispatch:z.enum(['not_sent','test_recorded']),introductions:z.array(z.object({supplierId:text,at:date,scopeHash:text,environment:z.enum(['test','live'])}).strict())}).strict();
export const PricingWorkflowStateSchema=z.object({
 contract:z.literal('netify-pricing-workflow/1'),environment:z.enum(['test','live']),projectId:text,tenantId:text,ownerSubject:text,agentSubjects:z.array(text),projectUrl:z.string().url(),revision:z.number().int().nonnegative(),
 procurement:ProcurementFoundationSchema.optional(),supplierSettingsHistory:z.array(z.object({at:date,settings:SupplierPricingSettingsSchema}).strict()).optional(),
 scopes:z.array(PricedScopeSchema),suppliers:z.array(SupplierPricingSettingsSchema),
 requests:z.array(z.object({request,expiresAt:date,supersedes:text.nullable(),approval:z.object({id:text,hash:text,subject:text,at:date,expiresAt:date}).strict().nullable(),outbox:z.array(z.object({supplierId:text,key:text,state:z.enum(['queued','sending','unknown','delivered','failed','awaiting_delivery_confirmation']).transform(state=>state==='unknown'?'awaiting_delivery_confirmation':state),attempts:z.number().int().nonnegative(),at:date.nullable(),receipt:text.nullable(),error:z.string().nullable()}).strict())}).strict()),
 grants:z.array(z.object({id:text,hash:text,requestId:text,supplierId:text,expiresAt:date,revoked:z.boolean()}).strict()),
 documents:z.array(z.object({id:text,requestId:text,supplierId:text,name:text,mime:text,sha256:text,base64:text,at:date}).strict()),
 quotations:z.array(z.object({requestId:text,quotation:StructuredQuotationSchema,originalJson:text,sha256:text,receivedAt:date}).strict()),
 audit:z.array(z.object({id:text,at:date,actor:text,actorKind:z.enum(['human','partner','agent','supplier','system']).optional(),action:text,requestId:z.string().nullable(),supplierId:z.string().nullable()}).strict()),
}).strict();
export type PricingWorkflowState=z.infer<typeof PricingWorkflowStateSchema>;
export interface PricingWorkflowStore{read(projectId:string):Promise<PricingWorkflowState|null>;transaction<T>(projectId:string,work:(current:PricingWorkflowState|null)=>{state:PricingWorkflowState;result:T}):Promise<T>}
/** Test adapter. Production must supply an atomic shared store; no live data is written here. */
export class FilePricingWorkflowStore implements PricingWorkflowStore{
 constructor(private directory:string){}
 private path(id:string){return resolve(this.directory,createHash('sha256').update(id).digest('hex')+'.json');}
 async read(id:string){try{return PricingWorkflowStateSchema.parse(JSON.parse(await readFile(this.path(id),'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw Error('pricing_record_unavailable');}}
 async transaction<T>(id:string,work:(current:PricingWorkflowState|null)=>{state:PricingWorkflowState;result:T}){
  await mkdir(this.directory,{recursive:true,mode:0o700});const path=this.path(id),lock=path+'.lock';
  try{await mkdir(lock,{mode:0o700});}catch{throw Error('pricing_record_busy_retry_read');}
  const temporary=path+'.'+randomUUID()+'.tmp';
  try{const prior=await this.read(id),{state,result}=work(prior?structuredClone(prior):null),valid=PricingWorkflowStateSchema.parse(state);if(valid.projectId!==id||valid.environment!=='test')throw Error('local_store_is_test_only');await writeFile(temporary,JSON.stringify(valid),{mode:0o600});await rename(temporary,path);return result;}
  finally{await rm(temporary,{force:true});await rm(lock,{recursive:true,force:true});}
 }
}
export class MemoryPricingWorkflowStore implements PricingWorkflowStore{
 private records=new Map<string,PricingWorkflowState>();
 async read(id:string){return structuredClone(this.records.get(id)??null);}
 async transaction<T>(id:string,work:(current:PricingWorkflowState|null)=>{state:PricingWorkflowState;result:T}){const {state,result}=work(structuredClone(this.records.get(id)??null));this.records.set(id,PricingWorkflowStateSchema.parse(state));return result;}
}
