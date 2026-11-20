import {CONTEXT_PRODUCTS,ProductSelectionsSchema,productScope,productRequirements} from './context-product-catalogue';
import {evidenceState,type EvidenceRow} from './provider-evidence-normalization';
/** Read-only context-space adapter. No project persistence or publication. */
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CHALLENGES,SECTOR_CHOICES,SECTOR_COMPARISON_VERSION,type ComparisonSector} from './sector-comparison-config';
import {SECTOR_PRIORITIES} from './sector-decision-config';
import {compareSectorProviders,decisionPackMarkdown,providerEvidenceFingerprint,type PublishedProvider,type SectorComparisonInput,type SectorComparisonResult,type ProviderCandidate,type RequirementFinding,prepareComparisonRecord} from './sector-comparison';
export const CONTEXT_PREVIEW_VERSION='context-preview/2026-11-10.1';
export function contextCatalogue(){return {version:CONTEXT_PREVIEW_VERSION,source_method:SECTOR_COMPARISON_VERSION,products:CONTEXT_PRODUCTS,sectors:SECTOR_CHOICES,contexts:Object.fromEntries(SECTOR_CHOICES.map(s=>[s.id,[...SECTOR_PRIORITIES[s.id].map(p=>({key:'scenario:'+p.id,title:p.title,test:p.test,description:p.description,kind:'scenario'})),...s.challenges.map(id=>{const c=CHALLENGES.find(c=>c.id===id)!;return {key:'challenge:'+c.id,title:c.label,test:c.question,description:c.question,kind:'challenge'};})]])),cloud_services:[{id:'aws',name:'AWS'},{id:'azure',name:'Microsoft Azure'},{id:'gcp',name:'Google Cloud'}]};}
const word=z.string().min(1).max(300);
export const ContextPreviewInputSchema=z.object({
 sector:z.enum(SECTOR_CHOICES.map(s=>s.id) as [ComparisonSector,...ComparisonSector[]]),
 scope:z.enum(['sase','sdwan','secure_access']),sites:z.number().int().min(0).max(100000),users:z.number().int().min(0).max(1000000),
 regions:z.array(z.enum(['uk_ireland','europe','north_america','asia_pacific','middle_east_africa','latin_america','china_mainland'])).min(1).max(7),
 service_model:z.enum(['any','self_managed','co_managed','fully_managed']),
 products:ProductSelectionsSchema.optional(),
 business:z.string().max(20000),existing_technology:z.string().max(10000),applications:z.array(word).max(100),cloud_services:z.array(word).max(100),
 contexts:z.array(z.object({key:z.string().max(100),mandatory:z.boolean(),origin:z.enum(['suggested','buyer']),importance:z.enum(['explore','important','mandatory'])})).max(6),
 custom:z.array(z.object({id:z.string().regex(/^[a-z0-9_-]+$/i),text:z.string().min(1).max(20000),mandatory:z.boolean()})).max(100),
}).strict().superRefine((v,c)=>{if(!(v.sites||v.users))c.addIssue({code:'custom',message:'Provide one known site or user count. Unknown values are not invented.'});if(v.products?.some(p=>p.included)&&v.scope!==productScope(v.products))c.addIssue({code:'custom',message:'Product choices and comparison scope must agree.'});const catalogue=contextCatalogue().contexts as Record<string,{key:string}[]>;const keys=new Set(catalogue[v.sector].map(x=>x.key));if(v.contexts.some(x=>!keys.has(x.key))||new Set(v.contexts.map(x=>x.key)).size!==v.contexts.length)c.addIssue({code:'custom',message:'Choose distinct contexts belonging to the selected sector.'});if(new Set(v.regions).size!==v.regions.length)c.addIssue({code:'custom',message:'Choose each coverage region once.'});if(new Set(v.custom.map(x=>x.id)).size!==v.custom.length)c.addIssue({code:'custom',message:'Each buyer context needs its own identifier.'});});
/** An incomplete draft can be saved without inventing a sector, region or estate size. */
export const ContextDraftInputSchema=z.object({...ContextPreviewInputSchema.shape,sector:z.union([ContextPreviewInputSchema.shape.sector,z.literal('')]),regions:z.array(z.enum(['uk_ireland','europe','north_america','asia_pacific','middle_east_africa','latin_america','china_mainland'])).max(7)}).strict().superRefine((v,c)=>{
 const defs=v.sector?contextCatalogue().contexts[v.sector]:[];
 if(v.contexts.some(x=>!defs.some(d=>d.key===x.key))||new Set(v.contexts.map(x=>x.key)).size!==v.contexts.length)c.addIssue({code:'custom',message:'Choose distinct contexts from your selected sector.'});
 if(new Set(v.regions).size!==v.regions.length||new Set(v.custom.map(x=>x.id)).size!==v.custom.length)c.addIssue({code:'custom',message:'Duplicate region or buyer requirement.'});
 if(v.products?.some(p=>p.included)&&v.scope!==productScope(v.products))c.addIssue({code:'custom',message:'Products and comparison scope must agree.'});
});
export type ContextPreviewInput=z.infer<typeof ContextPreviewInputSchema>;
export type ContextPreviewResult=SectorComparisonResult&{context_version:string;original_context:ContextPreviewInput;context_checks:{key:string;label:string;mandatory:boolean;origin:string}[];ranking_method:string;};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const contextPreviewFingerprint=(record:PublishedProvider)=>hash(CONTEXT_PREVIEW_VERSION+':'+providerEvidenceFingerprint(record));
export function contextBaseInput(input:ContextPreviewInput):SectorComparisonInput{
 const cloudIds=[...new Set(input.cloud_services.map(x=>/^aws$|amazon web services/i.test(x)?'aws':/azure/i.test(x)?'azure':/^gcp$|google cloud/i.test(x)?'gcp':null).filter((x):x is 'aws'|'azure'|'gcp'=>x!==null))];
 return {sector:input.sector,sites:input.sites,users:input.users,regions:input.regions,scope:input.scope,service_model:input.service_model,notes:'',
 challenges:input.contexts.filter(c=>c.key.startsWith('challenge:')).map(c=>({id:CHALLENGES.find(x=>'challenge:'+x.id===c.key)!.id,mandatory:c.mandatory})),requirements:cloudIds.map(id=>({id,mandatory:false})),decision:{ownership_confirmed:input.service_model!=='any',estate:'undecided',approach:'undecided'}};
 // Free text is preserved in original_context, not clipped to the legacy note
 // budget or misrepresented as parsed capability requirements.
}
function group(p:ProviderCandidate):ProviderCandidate['group']{const m=p.findings.filter(f=>f.mandatory);return m.some(f=>f.state==='not_supported')?'excluded':m.every(f=>f.state==='evidenced')?'evidenced':'confirmation';}
export function compareContextProviders(value:unknown,records:PublishedProvider[],unavailable:string[]=[],now=new Date().toISOString()):ContextPreviewResult{
 const input=ContextPreviewInputSchema.parse(value),base=contextBaseInput(input),result=compareSectorProviders(base,records,unavailable,now);
 const scenarioResults=input.contexts.filter(c=>c.key.startsWith('scenario:')).map(c=>({c,result:compareSectorProviders({...base,decision:{...base.decision!,priority_id:c.key.slice(9)}},records,unavailable,now)}));
 const index=new Map(result.providers.map(p=>[p.slug,p]));
 for(const {c,result:r} of scenarioResults){for(const source of r.providers){const target=index.get(source.slug)!;for(const f of source.findings.filter(f=>f.id.startsWith('scenario:'))){const id=f.id==='scenario:acceptance'?'context:'+c.key+':acceptance':f.id;const existing=target.findings.find(x=>x.id===id);if(existing){existing.mandatory=existing.mandatory||c.mandatory;continue;}target.findings.push({...f,id,label:f.id==='scenario:acceptance'?SECTOR_PRIORITIES[input.sector].find(p=>'scenario:'+p.id===c.key)!.title+' · supplier test':f.label,mandatory:c.mandatory});}}}
 const additional=(id:string,label:string,question:string,mandatory=false):RequirementFinding=>({id,label,mandatory,state:'unconfirmed',qualification:question,supplier_question:question,source_urls:[],reviewed_at:null});
 for(const p of result.providers){
  if(input.products){
   const removed=p.findings.filter(f=>f.id.startsWith('scope:'));p.findings=p.findings.filter(f=>!f.id.startsWith('scope:'));p.questions=p.questions.filter(q=>!removed.some(f=>f.supplier_question===q));
   const record=prepareComparisonRecord(records.find(r=>r.provider.slug===p.slug)!);
   for(const selection of input.products.filter(x=>x.included)){
    const def=CONTEXT_PRODUCTS.find(d=>d.id===selection.id)!;
    p.findings.push(additional('product:'+def.id,def.label+' / product, licence and delivery',productRequirements([selection])[0].test));
    const productPatterns:Record<string,RegExp>={sdwan:/\bsd[ -]?wan\b/i,sse:/\bsse\b|secure web gateway|internet.{0,20}security/i,ztna:/\bztna\b|private (?:application )?access/i,firewall:/firewall|\bngfw\b/i,endpoint:/endpoint (?:security|protection|detection|threat)|\bepp\b|\bedr\b/i,identity:/identity (?:and |& )?access management|workforce identity|\biam\b/i,dlp:/data loss prevention|\bdlp\b/i,uem:/unified endpoint management|device management|\buem\b|\bmdm\b/i,mdr:/managed detection|\bmdr\b|managed soc/i,pam:/privileged access management|\bpam\b/i,itdr:/identity threat|\bitdr\b/i,dem:/digital experience monitoring|\bdem\b/i,browser:/enterprise browser|secure browser/i};
    const productSources=(r:EvidenceRow)=>record.evidence_sources.filter(source=>(r.evidence_source_ids??[]).includes(String(source.id))&&['current','review_due'].includes(String(source.source_status??'current'))&&source.reliability_tier!=='tier_4').map(source=>String(source.url)).filter(u=>/^https?:\/\//.test(u));
    const named=record.products.filter(r=>r.status==='current'&&(r.freshness_state===undefined||r.freshness_state==='current')&&!['low','unresolved'].includes(String(r.confidence))&&productPatterns[def.id]?.test(String(r.category??''))&&productSources(r).length);
    if(named.length&&selection.intent!=='retain')p.findings.push({id:'product:'+def.id+':published-options',label:def.label+' / published product options',mandatory:false,state:named.some(r=>r.delivery_relationship==='native')?'evidenced':'conditional',qualification:named.map(r=>String(r.name)+' — '+String(r.category)+'. Delivery relationship: '+String(r.delivery_relationship??'Confirm with supplier')+'.').join('\n\n')+'\n\nThese are source-linked product records. Confirm current edition, licence, availability, coherent stack and delivery partner for this project.',supplier_question:'Identify which listed product or alternative you propose, its licence tier, exact feature entitlements, current availability and delivery responsibilities.',source_urls:[...new Set(named.flatMap(productSources))],reviewed_at:record.revision.reviewed_at});

    const specs=[{id:'capability',label:'Relevant capability evidence',codes:def.codes},...selection.features.map(id=>def.features.find(f=>f.id===id)!)];
    for(const spec of specs){if(spec.id==='capability'&&!spec.codes.length)continue;const question='Confirm '+def.label+' / '+spec.label+' in the exact proposed product, licence, deployment and operating model. '+(selection.intent==='retain'?'This product is being retained: demonstrate the integration rather than proposing replacement.':'Generic capability evidence does not prove product inclusion or a licensed entitlement.');
     const finding=additional('product:'+def.id+':feature:'+spec.id,def.label+' / '+spec.label,question);
     const rows=record.capabilities.filter(r=>spec.codes.includes(String(r.capability_code)));
     const urls=(r:EvidenceRow)=>record.evidence_sources.filter(source=>(r.evidence_source_ids??[]).includes(String(source.id))&&['current','review_due'].includes(String(source.source_status??'current'))&&source.reliability_tier!=='tier_4').map(source=>String(source.url)).filter(u=>/^https?:\/\//.test(u));
     const qualified=rows.filter(r=>r.freshness_state==='current'&&urls(r).length&&!['low','unresolved'].includes(String(r.confidence)));
     const row=qualified.find(r=>evidenceState(r)==='supported')??qualified.find(r=>['partially_supported','partner_delivered'].includes(evidenceState(r)))??qualified.find(r=>evidenceState(r)==='not_supported');
     if(row&&selection.intent!=='retain'){finding.state=evidenceState(row)==='supported'?'evidenced':evidenceState(row)==='not_supported'?'not_supported':'conditional';finding.qualification=String(row.qualification??'Source-backed capability evidence.')+' Exact product, licence and delivery scope require supplier confirmation.';finding.source_urls=urls(row);finding.reviewed_at=typeof row.verified_date==='string'?row.verified_date:null;}
     p.findings.push(finding);
    }
    selection.custom_features.forEach((text,i)=>p.findings.push(additional('product:'+def.id+':own:'+i,def.label+' / buyer feature',text)));
   }
  }
  for(const app of input.applications)p.findings.push(additional('application:'+hash(app).slice(0,12),'Application: '+app,'Demonstrate '+app+' over the proposed traffic path, with the required device, identity, performance, inspection and failover behaviour. A generic networking feature does not establish application compatibility.'));
  for(const cloud of input.cloud_services.filter(x=>!/^aws$|amazon web services|azure|^gcp$|google cloud/i.test(x)))p.findings.push(additional('cloud:'+hash(cloud).slice(0,12),'Cloud service: '+cloud,'Confirm the exact integration, product version, licence and operating responsibilities for '+cloud+'. No matching integration was assumed.'));
  for(const c of input.custom)p.findings.push(additional('buyer:'+c.id,'Buyer-added context',c.text+'\n\nThis original context has not been automatically converted into a capability claim. Confirm its meaning and ask the supplier for a specific answer and evidence.',c.mandatory));
  if(input.existing_technology.trim())p.findings.push(additional('existing-estate','Existing technology','Confirm coexistence, integration versions, retained licences, migration and rollback for the buyer\'s existing technology. See the complete initial brief.'));
  p.group=group(p);p.questions=[...new Set([...p.questions,...p.findings.filter(f=>f.state!=='evidenced').map(f=>f.supplier_question)])];p.evidence_fingerprint=hash(CONTEXT_PREVIEW_VERSION+':'+p.evidence_fingerprint);
 }
 const count=(p:ProviderCandidate,mandatory:boolean,state:RequirementFinding['state'])=>new Set(p.findings.filter(f=>f.mandatory===mandatory&&f.state===state).map(f=>f.id)).size;
 result.providers.sort((a,b)=>({evidenced:0,confirmation:1,excluded:2}[a.group]-{evidenced:0,confirmation:1,excluded:2}[b.group])||count(b,true,'evidenced')-count(a,true,'evidenced')||count(b,true,'conditional')-count(a,true,'conditional')||count(b,false,'evidenced')-count(a,false,'evidenced')||b.sector_reference.length-a.sector_reference.length||a.name.localeCompare(b.name,'en-GB'));
 const cat=contextCatalogue().contexts as Record<string,{key:string;title:string}[]>;
 return {...result,context_version:CONTEXT_PREVIEW_VERSION,original_context:input,context_checks:input.contexts.map(c=>({key:c.key,label:cat[input.sector].find(x=>x.key===c.key)!.title,mandatory:c.mandatory,origin:c.origin})),ranking_method:'Source-backed mandatory evidence first; preferred capability evidence next; source-linked sector references break ties. No synthetic fit score. Unknown research never proves inability.',limitations:[...result.limitations,'Application names, custom context and existing technology are retained in full and require supplier-specific validation.','Cloud platforms create advisory integration checks, not confirmed compatibility or buyer-mandated integration.','Sector suggestions are editable and remain separate from buyer-specified requirements.']};
}
const quote=(s:string)=>s.split(/\r?\n/).map(line=>'> '+line).join('\n');
export function contextInitialBriefMarkdown(input:ContextPreviewInput){return ['## Complete initial business brief','### Business description',quote(input.business||'Not supplied.'),'### Existing technology',quote(input.existing_technology||'Not supplied.'),'### Applications',...input.applications.map(x=>'- '+x),'### Cloud services',...input.cloud_services.map(x=>'- '+x),'### Original buyer-added context',...input.custom.flatMap(c=>['Buyer context '+c.id+' · '+(c.mandatory?'mandatory':'preferred'),quote(c.text)]),'### Product and service selections',...productRequirements(input.products).flatMap(r=>['#### '+r.text,quote(r.test)]),'### Sector starting points',...input.contexts.map(c=>'- '+c.key+' · '+c.origin+' · '+c.importance)].join('\n\n');}
export function contextDecisionPackMarkdown(result:ContextPreviewResult,slugs:string[]){return decisionPackMarkdown(result,slugs)+'\n\n'+contextInitialBriefMarkdown(result.original_context);}
