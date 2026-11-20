import {createHash} from 'node:crypto';
import {z} from 'zod';

/** Shared short/full contract. No prices or supplier participation are inferred. */
export const PRICED_SCOPE_VERSION='netify-priced-scope/1.0.0';
export const QUOTATION_VERSION='netify-quotation/1.0.0';
export const SUPPLIER_SETTINGS_VERSION='netify-supplier-pricing/1.0.0';
const text=z.string().trim().min(1).max(2000);
const id=z.string().trim().min(1).max(100);
const count=z.number().int().positive().max(1000000);
const date=z.string().datetime({offset:true});
const components=z.enum(['connectivity','sase_licence','product_licence','sdwan_edge','management','design_install_migration','commercial_terms']);
const mode=z.enum(['instant','rate_card','referred']);
const level=z.enum(['instant_site_price','indicative_estimate','supplier_quotation']);
export const ShortPricingAnswersSchema=z.object({
 sector:text,sitesByCountry:z.array(z.object({country:text,sites:count}).strict()).max(250),
 users:count.nullable(),bandwidthBand:text.nullable(),products:z.array(id).max(100),features:z.array(id).max(500),
 termMonths:z.number().int().positive().max(120).nullable(),managementModel:text.nullable(),
}).strict();
const access=z.enum(['','ethernet_leased_line','business_broadband','five_g','four_g','satellite','private_wan','supplier_design','other','none']);
const accessLink=z.object({type:access,bandwidthMbps:z.number().positive().max(1000000).nullable()}).strict();
export const SiteNetworkPlanSchema=z.object({primary:accessLink,secondary:accessLink,failover:z.enum(['','active_passive','active_active','single_link','supplier_design']),diversity:z.enum(['','supplier_confirm','required','not_required']),notes:z.string().max(20000)}).strict();
const site=z.object({id,name:text,country:text,location:text.nullable(),sites:count,users:count.nullable(),
 bandwidthMbps:z.number().positive().max(1000000).nullable(),accessType:text.nullable(),resilience:text.nullable(),connectivity:SiteNetworkPlanSchema.optional(),products:z.array(id).max(100),features:z.array(id).max(500),requirements:z.string().max(20000)}).strict();
const line=z.object({id,component:components,description:text,siteId:id.nullable(),unit:z.enum(['site','user','device','licence','estate']),quantity:count.nullable(),products:z.array(id).max(100),features:z.array(id).max(500),requirements:z.string().max(20000)}).strict();
export const PricedScopeSchema=z.object({contract:z.literal(PRICED_SCOPE_VERSION),projectId:id,revision:z.number().int().positive(),createdAt:date,
 short:ShortPricingAnswersSchema,sites:z.array(site).max(5000),userSets:z.array(z.object({id,users:count.nullable(),products:z.array(id).max(100),features:z.array(id).max(500)}).strict()).max(100),
 lines:z.array(line).min(1).max(10000),services:z.array(text).max(100),requirements:z.string().max(100000),
}).strict().superRefine((s,ctx)=>{
 for(const key of ['sites','lines','userSets'] as const){const ids=s[key].map(x=>x.id);if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Duplicate '+key+' ID'});}
 const ids=new Set(s.sites.map(x=>x.id));if(s.lines.some(l=>l.siteId&&!ids.has(l.siteId)))ctx.addIssue({code:'custom',message:'Scope line refers to an absent site'});
 if(s.short.sitesByCountry.reduce((n,c)=>n+c.sites,0)!==s.sites.reduce((n,c)=>n+c.sites,0))ctx.addIssue({code:'custom',message:'Country and location site totals differ'});
 for(const country of s.short.sitesByCountry)if(s.sites.filter(x=>x.country===country.country).reduce((n,x)=>n+x.sites,0)!==country.sites)ctx.addIssue({code:'custom',message:'Country site totals differ'});
 if(new Set(s.short.sitesByCountry.map(x=>x.country)).size!==s.short.sitesByCountry.length)ctx.addIssue({code:'custom',message:'Duplicate country'});
 if(!s.sites.length&&!s.short.users)ctx.addIssue({code:'custom',message:'Provide one known site or user count'});
});
export type PricedScope=z.infer<typeof PricedScopeSchema>;
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):v;
export function pricingHash(value:unknown){return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export function scopeHash(value:PricedScope){return pricingHash(PricedScopeSchema.parse(value));}
export function scopeReadiness(value:PricedScope){
 const s=PricedScopeSchema.parse(value);const referral:string[]=[];
 if(!s.short.products.length&&!s.lines.some(l=>l.component==='connectivity'))referral.push('Products to price');
 if(!s.short.termMonths)referral.push('Contract term');
 if(s.lines.some(l=>l.quantity===null))referral.push('Quantities on scope lines');
 const broadband=s.sites.flatMap(p=>[...(!p.location?[p.name+': exact address']:[]),...(!p.accessType?[p.name+': access type']:[]),...(!p.bandwidthMbps?[p.name+': bandwidth']:[]),...(!p.resilience?[p.name+': resilience']:[])]);
 return {referredRequest:referral,sitePricing:broadband,estimate:['Approved, current supplier pricing evidence'],quotation:['Approved scope version','Participating supplier response']};
}

export const SupplierPricingSettingsSchema=z.object({contract:z.literal(SUPPLIER_SETTINGS_VERSION),supplierId:id,name:text,
 environment:z.enum(['test','live']),participation:z.enum(['unconfirmed','active','paused']),
 authorisedContact:z.object({name:text,email:z.string().email(),authorisedAt:date,evidenceRef:text}).strict().nullable(),
 consent:z.object({version:id,evidenceRef:text,acceptedAt:date,expiresAt:date.nullable()}).strict().nullable(),
 responseTargetHours:z.number().int().positive().max(8760).nullable(),
 components:z.array(z.object({component:components,mode,enabled:z.boolean(),sourceRef:id.nullable(),validFrom:date.nullable(),validUntil:date.nullable(),liveSourceVerifiedAt:date.nullable()}).strict()).max(30),
}).strict().superRefine((s,ctx)=>{
 if(new Set(s.components.map(x=>x.component)).size!==s.components.length)ctx.addIssue({code:'custom',message:'Duplicate supplier component'});
 for(const c of s.components){if(c.mode!=='referred'&&c.enabled&&(!c.sourceRef||!c.validFrom||!c.validUntil))ctx.addIssue({code:'custom',message:'Automatic pricing requires dated source evidence'});
 if(c.mode==='instant'&&c.enabled&&!c.liveSourceVerifiedAt)ctx.addIssue({code:'custom',message:'Live source has not been verified'});
 if(c.validFrom&&c.validUntil&&Date.parse(c.validFrom)>=Date.parse(c.validUntil))ctx.addIssue({code:'custom',message:'Invalid source validity interval'});}
});
export type SupplierPricingSettings=z.infer<typeof SupplierPricingSettingsSchema>;
const money=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const provenance=z.object({source:text,sourceRef:text,issuedAt:date,validUntil:date}).strict().refine(v=>Date.parse(v.validUntil)>Date.parse(v.issuedAt),'Invalid price validity');
const quoteLine=z.object({lineId:id.optional(),scopeLineId:id,status:z.enum(['firm','indicative','awaiting_supplier']),mode,level,
 source:provenance.nullable(),unit:z.enum(['site','user','device','licence','estate']),quantity:count.nullable(),currency:z.string().regex(/^[A-Z]{3}$/).nullable(),
 amountMinor:money.nullable(),charge:z.enum(['one_off','recurring']).nullable(),periodMonths:z.number().int().positive().max(120).nullable(),
 inclusions:z.array(text).max(100),exclusions:z.array(text).max(100),assumptions:z.array(text).max(100),
 extracted:z.boolean(),reviewedBy:id.nullable(),reviewedAt:date.nullable(),
}).strict().superRefine((l,ctx)=>{
 if(l.status==='awaiting_supplier'){if(l.amountMinor!==null||l.currency!==null||l.charge!==null||l.source!==null)ctx.addIssue({code:'custom',message:'Awaiting lines cannot contain a price'});}
 else if(l.amountMinor===null||!l.currency||!l.source||!l.quantity||!l.charge||l.charge==='recurring'&&!l.periodMonths||l.charge==='one_off'&&l.periodMonths!==null)ctx.addIssue({code:'custom',message:'A priced line needs complete terms and provenance'});
 if(l.extracted&&(!l.reviewedBy||!l.reviewedAt)&&l.status==='firm')ctx.addIssue({code:'custom',message:'Extracted prices require human review before firm status'});
 if(l.status==='firm'&&l.level==='indicative_estimate')ctx.addIssue({code:'custom',message:'An estimate cannot be firm'});
});
export const StructuredQuotationSchema=z.object({contract:z.literal(QUOTATION_VERSION),id,supplierId:id,projectId:id,
 environment:z.enum(['test','live']),scopeHash:z.string().regex(/^[a-f0-9]{64}$/),scopeRevision:z.number().int().positive(),
 receivedAt:date,reference:text,proposedServices:z.array(text).max(100).optional(),deliveryResponsibilities:z.array(z.object({organisation:text,responsibility:text}).strict()).max(100).optional(),dependencies:z.array(text).max(100).optional(),outstandingChecks:z.array(text).max(100).optional(),termMonths:z.number().int().positive().max(120),taxBasis:z.enum(['excluding_tax','including_tax','not_confirmed']),
 originalDocument:z.object({storageRef:text,sha256:z.string().regex(/^[a-f0-9]{64}$/),name:text}).strict().nullable(),
 lines:z.array(quoteLine).min(1).max(10000),supplierAssumptions:z.array(text).max(100),
}).strict().superRefine((q,ctx)=>{if(new Set(q.lines.map(l=>l.lineId??l.scopeLineId)).size!==q.lines.length)ctx.addIssue({code:'custom',message:'Duplicate quotation scope line'});if(q.lines.some(l=>l.extracted)&&!q.originalDocument)ctx.addIssue({code:'custom',message:'Extracted quotations must retain their original document'});});
export type StructuredQuotation=z.infer<typeof StructuredQuotationSchema>;
export function awaitingLines(scope:PricedScope):StructuredQuotation['lines']{return scope.lines.map(l=>({scopeLineId:l.id,status:'awaiting_supplier',mode:'referred',level:'supplier_quotation',source:null,unit:l.unit,quantity:l.quantity,currency:null,amountMinor:null,charge:null,periodMonths:null,inclusions:[],exclusions:[],assumptions:[],extracted:false,reviewedBy:null,reviewedAt:null}));}
export function compareQuotation(scope:PricedScope,value:unknown,now=new Date()){
 const q=StructuredQuotationSchema.parse(value),s=PricedScopeSchema.parse(scope);const differences:string[]=[];
 const scopeMatches=q.projectId===s.projectId&&q.scopeHash===scopeHash(s)&&q.scopeRevision===s.revision;
 if(!scopeMatches)differences.push('Quotation belongs to a different scope version');
 if(Date.parse(q.receivedAt)>now.getTime())differences.push('Quotation receipt is future-dated');
 if(q.termMonths!==s.short.termMonths)differences.push('Contract terms differ');
 if(q.taxBasis==='not_confirmed')differences.push('Tax basis is not confirmed');
 if(q.supplierAssumptions.length)differences.push('Supplier assumptions need review');
 if(q.dependencies?.length)differences.push('Supplier dependencies need review');
 if(q.outstandingChecks?.length)differences.push('Outstanding supplier checks need resolution');
 const byId=new Map(s.lines.map(l=>[l.id,l]));
 for(const l of q.lines){const expected=byId.get(l.scopeLineId);if(!expected)differences.push('Extra quotation line: '+l.scopeLineId);else if(expected.quantity!==l.quantity||expected.unit!==l.unit)differences.push('Quantity or unit differs: '+l.scopeLineId);
 if(l.source&&Date.parse(l.source.validUntil)<=now.getTime())differences.push('Expired price: '+l.scopeLineId);
 if(l.source&&Date.parse(l.source.issuedAt)>now.getTime())differences.push('Future-dated price: '+l.scopeLineId);
 if(l.status!=='awaiting_supplier'&&l.extracted&&(!l.reviewedBy||!l.reviewedAt))differences.push('Extraction awaits review: '+l.scopeLineId);
 if(l.assumptions.length||l.exclusions.length)differences.push('Line qualifications need review: '+l.scopeLineId);
 if(l.status!=='awaiting_supplier'&&l.charge==='recurring'&&q.termMonths%l.periodMonths!)differences.push('Billing periods do not divide the requested term: '+l.scopeLineId);}
 const awaiting=s.lines.filter(l=>{const offered=q.lines.filter(q=>q.scopeLineId===l.id);return !offered.length||offered.some(q=>q.status==='awaiting_supplier');}).map(l=>l.id);
 const currencies=[...new Set(q.lines.flatMap(l=>l.currency?[l.currency]:[]))];if(currencies.length!==1)differences.push('No single quotation currency');
 const safe=(n:bigint)=>{if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Price total exceeds safe supported precision');return Number(n);};
 let oneOff=BigInt(0),recurringOverTerm=BigInt(0);
 if(!differences.length)for(const l of q.lines.filter(l=>l.status!=='awaiting_supplier')){const amount=BigInt(l.amountMinor!)*BigInt(l.quantity!);if(l.charge==='one_off')oneOff+=amount;else recurringOverTerm+=amount*BigInt(q.termMonths/l.periodMonths!);}
 const complete=awaiting.length===0&&differences.length===0;
 const total=oneOff+recurringOverTerm,sites=s.short.sitesByCountry.reduce((n,c)=>n+c.sites,0);
 return {supplierId:q.supplierId,environment:q.environment,lineLabels:q.lines.map(l=>{const current=scopeMatches&&Date.parse(q.receivedAt)<=now.getTime()&&!!l.source&&Date.parse(l.source.issuedAt)<=now.getTime()&&Date.parse(l.source.validUntil)>now.getTime();return {id:l.scopeLineId,line_id:l.lineId??l.scopeLineId,source:l.source?.source??null,source_ref:l.source?.sourceRef??null,date:l.source?.issuedAt??null,valid_until:l.source?.validUntil??null,label:l.status==='awaiting_supplier'||!current?'awaiting supplier':l.status,originalStatus:l.status,current};}),awaiting,differences,complete,
 totals:differences.length?null:{currency:currencies[0],oneOffMinor:safe(oneOff),recurringOverTermMinor:safe(recurringOverTerm),pricedSubtotalMinor:safe(total),estateTotalMinor:complete?safe(total):null,
 perSitePerMonth:complete&&sites>0?{numeratorMinor:safe(total),denominator:sites*q.termMonths}:null,
 perUserPerMonth:complete&&s.short.users?{numeratorMinor:safe(total),denominator:s.short.users*q.termMonths}:null},
 comparable:complete,notice:complete?'Check scope and supplier qualifications before deciding.':'Incomplete or different scope. No complete estate price is available.'};
}

export type PricingPrincipal={buyerId:string;projectId:string;verifiedAt:string;environment:'test'|'live'};
export type PricingRequest={id:string;environment:'test'|'live';projectId:string;scope:PricedScope;scopeHash:string;recipients:{supplierId:string;name:string;contact:string;components:string[];responseTargetHours:number|null;responseDueAt:string|null}[];disclosedFields:string[];preparedAt:string;authorityHash?:string;delivery?:{channel:'email';mode:'internal_test_capture';actualDestination:'support@netify.com';sender:'not_configured'};previewHash:string;approvedAt:string|null;approvedBy:string|null;dispatch:'not_sent'|'test_recorded';introductions:{supplierId:string;at:string;scopeHash:string;environment:'test'|'live'}[]};
export function preparePricingRequest(scope:PricedScope,settings:SupplierPricingSettings[],environment:'test'|'live',now=new Date(),authorityHash?:string):PricingRequest{
 const s=PricedScopeSchema.parse(scope);if(scopeReadiness(s).referredRequest.some(gap=>gap!=='Quantities on scope lines'))throw Error('Complete the priced scope before preparing a request');
 if(!settings.length||new Set(settings.map(s=>s.supplierId)).size!==settings.length)throw Error('Choose distinct participating recipients');
 const recipients=settings.map(raw=>{const p=SupplierPricingSettingsSchema.parse(raw);
 if(p.environment!==environment||p.participation!=='active'||!p.authorisedContact||!p.consent||Date.parse(p.authorisedContact.authorisedAt)>now.getTime()||Date.parse(p.consent.acceptedAt)>now.getTime()||p.consent.expiresAt&&Date.parse(p.consent.expiresAt)<=now.getTime())throw Error('Supplier participation, authority or consent is not current');
 const components=p.components.filter(c=>c.enabled&&s.lines.some(l=>l.component===c.component));if(!components.length)throw Error('Supplier does not price these components');
 // Referred requests can ask the supplier to clarify an unknown licence metric.
 // Missing quantities remain explicit and never produce a comparable total.
 // Release one routes referred components only. No live connection is assumed.
 if(components.some(c=>c.mode!=='referred'))throw Error('Automatic pricing is not enabled in this release');
 return {supplierId:p.supplierId,name:p.name,contact:p.authorisedContact.email,components:components.map(c=>c.component),responseTargetHours:p.responseTargetHours,responseDueAt:null};});
 const base={id:crypto.randomUUID(),environment,projectId:s.projectId,scope:s,scopeHash:scopeHash(s),recipients,disclosedFields:['priced_scope'],preparedAt:now.toISOString(),...(authorityHash?{authorityHash}:{}),...(environment==='test'?{delivery:{channel:'email' as const,mode:'internal_test_capture' as const,actualDestination:'support@netify.com' as const,sender:'not_configured' as const}}:{})};
 return {...base,previewHash:pricingHash(base),approvedAt:null,approvedBy:null,dispatch:'not_sent',introductions:[]};
}
function requestPreviewHash(r:PricingRequest){const {previewHash,approvedAt,approvedBy,dispatch,introductions,...base}=r;return pricingHash(base);}
export function approveTestPricingRequest(value:PricingRequest,principal:PricingPrincipal,approvedPreviewHash:string,now=new Date()):PricingRequest{
 const r=structuredClone(value);if(r.environment!=='test'||principal.environment!=='test')throw Error('Live routing is not implemented. Nothing was sent.');
 if(principal.projectId!==r.projectId||!principal.buyerId||!Number.isFinite(Date.parse(principal.verifiedAt))||Date.parse(principal.verifiedAt)>now.getTime())throw Error('Verified project authority is required');
 if(r.previewHash!==approvedPreviewHash||requestPreviewHash(r)!==r.previewHash||scopeHash(r.scope)!==r.scopeHash)throw Error('Request changed. Review and approve a fresh preview');
 if(r.dispatch==='test_recorded')return r;
 r.approvedAt=now.toISOString();r.approvedBy=principal.buyerId;r.dispatch='test_recorded';
 r.introductions=r.recipients.map(p=>({supplierId:p.supplierId,at:r.approvedAt!,scopeHash:r.scopeHash,environment:'test'}));return r;
}
export function buyerPricingRequestView(r:PricingRequest){return {publisher:'Netify',contract:PRICED_SCOPE_VERSION,generatedAt:new Date().toISOString(),projectId:r.projectId,projectUrl:r.environment==='live'?'/sase/project/'+encodeURIComponent(r.projectId)+'/':null,projectEntryUrl:'/sase/shortlist/',environment:r.environment,
 dispatch:r.dispatch,scopeRevision:r.scope.revision,scopeHash:r.scopeHash,recipients:r.recipients.map(({contact,...publicRecipient})=>({...publicRecipient,asked:r.dispatch==='test_recorded'?'test only, not sent':'not asked',responseDueAt:r.dispatch==='not_sent'?null:publicRecipient.responseDueAt})),
 lines:r.scope.lines.map(l=>({...l,label:'awaiting supplier' as const})),notice:r.dispatch==='test_recorded'?'Test request recorded locally. No supplier was contacted.':'No supplier has been asked. Review and approve the recipients and scope.'};}

/** Append-only submission core. A changed bid needs a new approved request round. */
export function recordTestQuotation(request:PricingRequest,principal:{projectId:string;supplierId:string;environment:'test'|'live';role:'supplier'},raw:unknown,existing:StructuredQuotation|null){
 const q=StructuredQuotationSchema.parse(raw);
 if(request.environment!=='test'||principal.environment!=='test'||q.environment!=='test')throw Error('Live quotation submission is not enabled');
 const recipient=request.recipients.find(p=>p.supplierId===principal.supplierId);
 if(!recipient||principal.role!=='supplier'||principal.projectId!==request.projectId||q.projectId!==request.projectId||q.supplierId!==principal.supplierId||request.dispatch!=='test_recorded')throw Error('Supplier is not authorised for this request');
 if(q.scopeHash!==request.scopeHash||q.scopeRevision!==request.scope.revision)throw Error('Quotation must reference this approved scope version');
 const scopeByLine=new Map(request.scope.lines.map(l=>[l.id,l]));
 for(const line of q.lines){const expected=scopeByLine.get(line.scopeLineId);if(!expected||line.status!=='awaiting_supplier'&&!recipient.components.includes(expected.component))throw Error('Supplier was not asked to price this component');}
 if(existing){if(pricingHash(existing)===pricingHash(q))return existing;throw Error('Submitted quotation is fixed. A new approved request round is required');}
 return structuredClone(q);
}
export function compareQuotations(scope:PricedScope,raw:unknown[],environment:'test'|'live',now=new Date()){
 const quotes=raw.map(q=>StructuredQuotationSchema.parse(q));
 if(quotes.some(q=>q.environment!==environment))throw Error('Test and live quotations cannot be compared together');
 const results=quotes.map(q=>compareQuotation(scope,q,now));const differences:string[]=[];
 if(new Set(quotes.map(q=>q.taxBasis)).size>1)differences.push('Tax bases differ');
 if(new Set(quotes.flatMap(q=>q.lines.flatMap(l=>l.currency?[l.currency]:[]))).size>1)differences.push('Currencies differ; no exchange rate has been assumed');
 if(new Set(quotes.map(q=>q.supplierId)).size!==quotes.length)differences.push('More than one quotation for a supplier; select one request round');
 return {results,differences,likeForLike:quotes.length>1&&results.every(r=>r.comparable)&&!differences.length,allFirm:quotes.length>0&&results.every(r=>r.complete)&&quotes.every(q=>q.lines.every(l=>l.status==='firm')),environment};
}
