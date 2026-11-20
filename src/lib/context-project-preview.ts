import {estateDocument,normaliseEstate} from '../../preview/context-space/estate-projection.js';
import {validateBuyingWorkspace} from '../../preview/context-space/buying-model.js';
import {validateRoom} from '../../preview/context-space/conversation-model.js';
import {productRequirements} from './context-product-catalogue';
/** Local prototype contract. Never writes to the live marketplace project store. */
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ContextPreviewInputSchema,ContextDraftInputSchema,contextCatalogue,type ContextPreviewInput} from './context-comparison-preview';
import {canonicalQuestions,QUESTION_BANK} from './rfp-question-bank';
import {studioDocument,studioReadiness,studioPublicNotice,type StudioDraft} from './opportunity-studio';

export const CONTEXT_PROJECT_VERSION='context-project/1';
export const ContextProjectSchema=z.object({
 version:z.literal(CONTEXT_PROJECT_VERSION),id:z.string().uuid(),revision:z.number().int().min(0),
 input:ContextPreviewInputSchema,
 document:z.object({format:z.enum(['rfi','rfp']),timescale:z.enum(['','Within 3 months','3–6 months','6–12 months','Not decided']),questionIds:z.array(z.string()).max(500),notes:z.string().max(20000)}).strict(),
 selectedProviders:z.array(z.string().regex(/^[a-z0-9-]+$/)).max(30),
}).strict().superRefine((p,c)=>{const valid=new Set(projectQuestionCatalogue().map(q=>q.id));if(p.document.questionIds.some(id=>!valid.has(id))||new Set(p.document.questionIds).size!==p.document.questionIds.length)c.addIssue({code:'custom',message:'Select distinct questions from the existing Netify bank.'});if(new Set(p.selectedProviders).size!==p.selectedProviders.length)c.addIssue({code:'custom',message:'Select each provider once.'});});
export type ContextProject=z.infer<typeof ContextProjectSchema>;
const safeKey=z.string().regex(/^(?!__proto__$|constructor$|prototype$)[a-z0-9_:-]+$/i);
const ConversationBackupSchema=z.unknown().superRefine((value,c)=>{try{validateRoom(value);}catch{c.addIssue({code:'custom',message:'Invalid local conversation backup. No identity or delivery authority can be imported.'});}}).transform(value=>validateRoom(value));
const BuyingBackupSchema=z.unknown().superRefine((value,c)=>{try{validateBuyingWorkspace(value);}catch(error){c.addIssue({code:'custom',message:error instanceof Error?error.message:'Invalid buying workspace.'});}}).transform(value=>validateBuyingWorkspace(value));
const ContextWorkspaceBaseSchema=z.object({buying:BuyingBackupSchema.optional(),conversations:ConversationBackupSchema.optional(),version:z.literal('context-workspace/1'),project:ContextProjectSchema,workspace:z.object({
 confirmedFields:z.record(safeKey,z.boolean()).optional(),
 custom:z.array(z.object({id:safeKey,text:z.string().min(1).max(20000),kind:z.literal('custom'),included:z.boolean(),relatedTo:safeKey,relatedSector:z.string(),relation:z.string().max(100)}).strict()).max(100),
 weights:z.record(safeKey,z.number().int().min(1).max(3)),origins:z.record(safeKey,z.enum(['buyer','suggested'])),
 selectionsBySector:z.record(z.string(),z.array(z.number().int().min(0).max(5)).max(6)),defaults:z.boolean(),layout:z.enum(['orbit','layers']),spread:z.number().min(65).max(135),links:z.number().min(0).max(100),labels:z.boolean(),showLinks:z.boolean(),vendors:z.boolean(),managed:z.boolean(),
 }).strict()}).strict();
export const ContextWorkspaceBackupSchema=ContextWorkspaceBaseSchema.superRefine((p,c)=>{const w=p.workspace,i=p.project.input,defs=contextCatalogue().contexts[i.sector];
 const custom=w.custom.filter(x=>x.included).map(x=>({id:x.id,text:x.text,mandatory:w.weights[x.id]===3}));
 const selected=w.selectionsBySector[i.sector]??[];
 const contexts=selected.map(n=>({key:defs[n].key,mandatory:w.weights[i.sector+':c'+n]===3,origin:w.origins[i.sector+':c'+n]??'suggested',importance:['explore','important','mandatory'][(w.weights[i.sector+':c'+n]??2)-1]}));
 if(JSON.stringify(custom)!==JSON.stringify(i.custom)||JSON.stringify(contexts)!==JSON.stringify(i.contexts))c.addIssue({code:'custom',message:'Project and map backup do not agree. The current project has not been replaced.'});
 if(new Set(w.custom.map(x=>x.id)).size!==w.custom.length)c.addIssue({code:'custom',message:'Duplicate buyer context identifiers.'});
 const sectors=new Set(contextCatalogue().sectors.map(s=>s.id));if(Object.entries(w.selectionsBySector).some(([s,ns])=>(!sectors.has(s as typeof i.sector)&&!(s===''&&ns.length===0))||new Set(ns).size!==ns.length))c.addIssue({code:'custom',message:'Invalid saved sector selections.'});
 }).transform(p=>{
 // Early node previews recorded the empty starting selection before a sector was chosen.
 // Only this empty placeholder is migrated; unknown sectors with data remain invalid.
 const {['']:_empty,...selectionsBySector}=p.workspace.selectionsBySector;void _empty;
 return {...p,workspace:{...p.workspace,selectionsBySector}};
 });
export const ContextWorkingBackupSchema=ContextWorkspaceBaseSchema.extend({project:z.object({...ContextProjectSchema.shape,input:ContextDraftInputSchema}).strict()}).superRefine((p,c)=>{
 if(p.buying){for(const snap of p.buying.snapshots){if(snap.core.project.id!==p.project.id||!ContextWorkingBackupSchema.safeParse(snap.core).success){c.addIssue({code:'custom',message:'A saved buying snapshot does not match this project or its validated requirements.'});return;}}}
 const i=p.project.input,w=p.workspace,defs=i.sector?contextCatalogue().contexts[i.sector]:[];
 const selected=w.selectionsBySector[i.sector]??[];
 if(selected.some(n=>!defs[n])){c.addIssue({code:'custom',message:'Invalid draft sector selection.'});return;}
 const contexts=selected.map(n=>({key:defs[n].key,mandatory:w.weights[i.sector+':c'+n]===3,origin:w.origins[i.sector+':c'+n]??'suggested',importance:['explore','important','mandatory'][(w.weights[i.sector+':c'+n]??2)-1]}));
 const custom=w.custom.filter(x=>x.included).map(x=>({id:x.id,text:x.text,mandatory:w.weights[x.id]===3}));
 if(JSON.stringify(contexts)!==JSON.stringify(i.contexts)||JSON.stringify(custom)!==JSON.stringify(i.custom))c.addIssue({code:'custom',message:'The saved map and document do not agree.'});
 const sectors=new Set(contextCatalogue().sectors.map(s=>s.id));if(Object.entries(w.selectionsBySector).some(([sector,ns])=>(!sectors.has(sector as Exclude<typeof i.sector,''>)&&!(sector===''&&ns.length===0))||new Set(ns).size!==ns.length))c.addIssue({code:'custom',message:'Invalid stored sector choices.'});
 if(new Set(w.custom.map(x=>x.id)).size!==w.custom.length)c.addIssue({code:'custom',message:'Duplicate buyer context.'});
 const questions=new Set(projectQuestionCatalogue().map(q=>q.id));if(p.project.document.questionIds.some(id=>!questions.has(id))||new Set(p.project.document.questionIds).size!==p.project.document.questionIds.length||new Set(p.project.selectedProviders).size!==p.project.selectedProviders.length)c.addIssue({code:'custom',message:'Invalid saved questions or provider choices.'});
}).transform(p=>({...p,workspace:{...p.workspace,selectionsBySector:Object.fromEntries(Object.entries(p.workspace.selectionsBySector).filter(([s])=>s!==''))}}));
export function projectQuestionCatalogue(){return [...canonicalQuestions().map(q=>({...q,sector:null as string|null,buyer_lens:'',supplier_lens:'',netify_note:''})),...Object.entries(QUESTION_BANK.sector_packs).flatMap(([sector,pack])=>pack.sections.flatMap(s=>s.questions.map(q=>({...q,category:pack.label+' / '+s.title,sector}))))];}
const digest=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,16);
export function projectRequirements(input:ContextPreviewInput){const cat=contextCatalogue().contexts[input.sector];return [
 ...productRequirements(input.products),
 ...input.contexts.map(c=>{const def=cat.find(x=>x.key===c.key)!;return {id:input.sector+':'+c.key,text:def.title,test:def.test,mandatory:c.mandatory,origin:c.origin};}),
 ...input.custom.map(c=>({id:'buyer:'+c.id,text:c.text,test:'Provide a specific answer, assumptions and supporting evidence.',mandatory:c.mandatory,origin:'buyer'})),
 ...input.applications.map(a=>({id:'application:'+digest(a),text:a,test:'Demonstrate the actual application path, performance, inspection and failover behaviour. Confirm dependencies and licences.',mandatory:false,origin:'buyer'})),
 ...input.cloud_services.map(a=>({id:'cloud:'+digest(a),text:a,test:'Confirm integration, regional availability, traffic paths, licences and who operates the service.',mandatory:false,origin:'buyer'})),
 ];}
export function projectStudioDraft(p:ContextProject):StudioDraft {const i=p.input;return {format:p.document.format,requirement:i.business,scope:({sase:'SASE',sdwan:'SD-WAN',secure_access:'SSE'} as const)[i.scope],sites:i.sites?String(i.sites):'',users:i.users?String(i.users):'',regions:i.regions.map(r=>({uk_ireland:'UK & Ireland',europe:'Europe',north_america:'North America',asia_pacific:'Asia Pacific',middle_east_africa:'Middle East & Africa',latin_america:'Latin America',china_mainland:'Mainland China'}[r])),timescale:p.document.timescale,service:({any:'Open to advice',self_managed:'Self-managed',co_managed:'Co-managed',fully_managed:'Fully managed'} as const)[i.service_model],questionIds:p.document.questionIds};}
export function buildContextProject(value:unknown,estate?:unknown){const project=ContextProjectSchema.parse(value),requirements=projectRequirements(project.input),questions=projectQuestionCatalogue(),draft=projectStudioDraft(project);
 const lines=[project.input.products?.some(p=>p.included)?studioDocument(draft,questions).replace(/^# .*/, '# Network and security '+project.document.format.toUpperCase()):studioDocument(draft,questions),'## Sector and operating context',contextCatalogue().sectors.find(s=>s.id===project.input.sector)!.name,'## Products and licence boundaries','The product schedule below describes the requested buying actions and features. Identify exact products, editions, licence entitlements and delivery partners. Where a suite covers multiple selected products, show those overlaps and avoid duplicate charges. Retained products are integration requirements, not replacement orders.','## Existing technology',project.input.existing_technology||'Not stated.','## Requirements and supplier evidence requests',...requirements.flatMap(r=>['### ['+r.id+'] '+r.text,'Priority: '+(r.mandatory?'Mandatory':'For review')+'. Origin: '+(r.origin==='suggested'?'Suggested sector starting point, subject to buyer review.':'Buyer supplied or selected.'),r.test]),'## Additional procurement instructions',project.document.notes||'None supplied.','## Document control','Private local draft. Project '+project.id+'. Revision '+project.revision+'. Nothing has been published or issued to suppliers.'];
 const normalised=estate?normaliseEstate(estate,project.input):undefined;
 if(normalised)lines.splice(lines.length-2,0,estateDocument(normalised,project.input,contextCatalogue().products));
 const markdown=lines.join('\n\n');
 return {project,...(normalised?{estate:normalised}:{}),requirements,markdown,publicNotice:studioPublicNotice(draft),readiness:studioReadiness(draft,questions),fingerprint:createHash('sha256').update(JSON.stringify(normalised?{project,estate:normalised}:project)).digest('hex')};
}
