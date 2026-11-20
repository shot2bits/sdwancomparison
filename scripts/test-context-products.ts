import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {CONTEXT_PRODUCTS,ProductSelectionsSchema,productScope,productRequirements,type ProductSelection} from '../src/lib/context-product-catalogue';
import {compareContextProviders,ContextPreviewInputSchema} from '../src/lib/context-comparison-preview';
import {buildContextProject,ContextWorkspaceBackupSchema,ContextWorkingBackupSchema,ContextProjectSchema} from '../src/lib/context-project-preview';
import type {PublishedProvider} from '../src/lib/sector-comparison';
assert.equal(CONTEXT_PRODUCTS.length,13);
const selection=(id:string,features:string[]=[]):ProductSelection=>({id,included:true,intent:'new',operation:'any',existing_product:'',features,custom_features:[]});
const input={sector:'manufacturing',scope:'secure_access',sites:24,users:0,regions:['uk_ireland'],service_model:'any',business:'Buyer needs endpoint protection for a manufacturing estate.',existing_technology:'',applications:[],cloud_services:[],contexts:[],custom:[],products:[selection('endpoint',['edr'])]};
const dir='.private/provider-review/harry-audit-20261110/live';
const records=readdirSync(dir).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(readFileSync(dir+'/'+n,'utf8'))).filter(r=>r.provider&&r.capabilities) as PublishedProvider[];
const original=JSON.stringify(records),result=compareContextProviders(input,records);
assert.equal(result.providers.length,30);
for(const p of result.providers){assert(!p.findings.some(f=>f.id.startsWith('scope:')));assert(p.findings.some(f=>f.id==='product:endpoint:feature:edr'&&f.state==='unconfirmed'));assert(!p.findings.some(f=>f.id.includes('ztna')));}
assert.equal(JSON.stringify(records),original);
const network=compareContextProviders({...input,scope:'sdwan',products:[selection('sdwan',['routing'])]},records);const cisco=network.providers.find(p=>p.slug==='cisco')!;assert(cisco.findings.some(f=>f.id==='product:sdwan:published-options'&&f.qualification.includes('Catalyst SD-WAN')&&f.source_urls.length));assert(cisco.findings.some(f=>f.id==='product:sdwan'&&f.state==='unconfirmed'));

const long='Exact original custom requirement. '.repeat(500)+'END OF BUYER FEATURE';
const retained={...selection('identity',['sso']),intent:'retain' as const,existing_product:'Existing workforce identity subscription',operation:'co_managed' as const,custom_features:[long]};
const products=[selection('sdwan',['segmentation']),retained,{...selection('endpoint',['edr']),included:false}];
assert.equal(productScope(products),'sase');assert.equal(productScope([selection('sdwan')]),'sdwan');assert.equal(productScope([selection('identity')]),'secure_access');
const project={version:'context-project/1',id:randomUUID(),revision:1,input:{...input,scope:productScope(products),products},document:{format:'rfp',timescale:'Not decided',notes:'',questionIds:['Q-SM-01']},selectedProviders:[]};
const built=buildContextProject(project);assert(built.markdown.startsWith('# Network and security RFP'));assert(built.markdown.includes('Keep and integrate'));assert(built.markdown.includes('Existing workforce identity subscription'));assert(built.markdown.includes('Co-managed'));assert(built.markdown.includes(long));assert(built.markdown.includes('Traffic segmentation'));assert(!built.markdown.includes('Application-aware routing'));assert(!built.markdown.includes('Endpoint Threat Protection'));assert(built.markdown.includes('avoid duplicate charges'));
const updated=structuredClone(project);updated.input.products[0].features=[];assert(!buildContextProject(updated).markdown.includes('Traffic segmentation'));assert(buildContextProject(updated).project.input.products?.[2].features.includes('edr'));
assert(!ProductSelectionsSchema.safeParse([selection('invented')]).success);assert(!ProductSelectionsSchema.safeParse([selection('sdwan',['edr'])]).success);assert(!ProductSelectionsSchema.safeParse([selection('sdwan'),selection('sdwan')]).success);assert(!ContextPreviewInputSchema.safeParse({...input,scope:'sdwan'}).success);
const backup={version:'context-workspace/1',project,workspace:{confirmedFields:{scope:true},custom:[],weights:{},origins:{},selectionsBySector:{manufacturing:[]},defaults:false,layout:'orbit',spread:100,links:45,labels:true,showLinks:true,vendors:true,managed:true}};
assert.deepEqual(ContextWorkspaceBackupSchema.parse(backup).project.input.products,products);
assert(productRequirements(products).every(r=>!r.id.includes('endpoint')));
console.log('PASS: 13 product categories; separate selectable features; buying/operation/retained licences; exact long wording; removed selections preserved in backup but excluded from RFP/matching; no inferred endpoint or identity evidence; no automatic ZTNA or unwanted product scope; 30 provider records unchanged.');

const partial: Record<string,any>=structuredClone(backup);Object.assign(partial.project.input,{sector:'',scope:'sase',sites:6,users:7,regions:[],contexts:[],products:[]});partial.workspace.selectionsBySector={};partial.workspace.confirmedFields={scope:false};
assert(ContextWorkingBackupSchema.safeParse(partial).success);assert(!ContextProjectSchema.safeParse(partial.project).success);
const reopened=ContextWorkingBackupSchema.parse(partial);assert.equal(reopened.project.input.sector,'');assert.deepEqual(reopened.project.input.regions,[]);assert.equal(reopened.project.input.sites,6);assert.equal(reopened.project.input.users,7);
assert(!ContextWorkingBackupSchema.safeParse({...partial,project:{...partial.project,input:{...partial.project.input,sites:-1}}}).success);
assert(!ContextWorkingBackupSchema.safeParse({...partial,project:{...partial.project,document:{...partial.project.document,questionIds:['invented-question']}}}).success);
console.log('PASS: incomplete drafts save and reopen exact site/user values without invented sector/regions; incomplete projects cannot generate an RFP or bypass matching readiness; invalid saved inputs are rejected.');

// Conversation-accepted requirements must satisfy the same canonical context ID contract.
assert(ContextPreviewInputSchema.safeParse({...input,custom:[{id:"supplier-20e65654-4301-428d-8c96-30ac49b894b9",text:"Supplier must document rollback criteria.",mandatory:false}]}).success);
