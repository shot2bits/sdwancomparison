import {z} from 'zod';
import {RESEARCH,SECTORS,providerName,providerResearch,researchSource,pricingSource,sectorResearch,money,priceLabels,formatDate,type Finding} from './workbook-research';
import {vendorProfileHref} from './vendor-links';
import {canonicalQuestions,sectorPack} from './rfp-question-bank';
import {CONTEXT_PRODUCTS} from './context-product-catalogue';
import {listPublicOpportunities,kvConfigured} from './rfp-store';

/**
 * Open marketplace tools for people's own AI agents. Phase A is read-only and
 * reads the same published research the public pages use. Identity-bound tools
 * live in marketplace-mcp-buyer.ts and are added to MARKET_TOOLS there.
 */
export const MARKET_VERSION='netify-marketplace-tools/1-20261120';
export class MarketError extends Error{constructor(public status:number,public code:string,public detail:Record<string,unknown>={}){super(code);}}
export type MarketTool={name:string;title:string;description:string;inputSchema:unknown;annotations:{readOnlyHint:boolean;destructiveHint:boolean;idempotentHint:boolean;openWorldHint:boolean};access:'open'|'buyer'|'vendor';handler:(args:unknown,ctx:MarketContext)=>Promise<unknown>};
export type MarketContext={origin:string;token:string;request?:Request;ip:string};

const slug=z.string().regex(/^[a-z0-9-]+$/).max(80);
const sectorSlugs=SECTORS.map(s=>s.slug) as [string,...string[]];
const lc=(s:unknown)=>String(s??'').toLowerCase();
const SOURCE_NOTE='Desk research from provider-published or third-party sources, each with an access date. These are unverified claims, not Netify endorsements. Research presence does not mean a provider has agreed to take part.';
const ROLE_LABEL:Record<string,string>={technology_vendor:'technology vendor',managed_service_provider:'managed service provider',carrier_network_provider:'carrier or network provider',hybrid_provider:'hybrid provider',integrator:'integrator'};
const sourceUrl=(id:string|null|undefined)=>researchSource(id)?.url??pricingSource(id)?.url??null;
const clip=(s:string|null|undefined,n=240)=>{const t=(s??'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1)+'…':t;};
const findingView=(f:Finding)=>({field_id:f.field_id,theme:f.theme,question:f.question,outcome:f.outcome,answer:clip(f.answer,300),claim:f.claim,accessed:f.accessed_date,source_url:sourceUrl(f.source_id)});
const providerCard=(p:{slug:string;name:string;roles:string[]})=>({slug:p.slug,name:p.name,roles:p.roles.map(r=>ROLE_LABEL[r]??r),profile_url:vendorProfileHref(p.slug),evidence_url:`https://netify.co.uk/sase/research/providers/${p.slug}/`});

const searchSchema=z.object({query:z.string().max(200).optional(),sector:z.enum(sectorSlugs).optional(),need:z.string().max(300).optional(),location:z.string().max(100).optional(),role:z.enum(['technology_vendor','managed_service_provider','carrier_network_provider','hybrid_provider','integrator']).optional(),limit:z.number().int().min(1).max(30).default(10)}).strict();
function search(a:z.infer<typeof searchSchema>){
 const terms=(s?:string)=>lc(s).split(/[^a-z0-9+]+/).filter(w=>w.length>2);
 const needTerms=[...new Set([...terms(a.need),...terms(a.query)])],loc=lc(a.location).trim();
 const rows=RESEARCH.providers.filter(p=>!a.role||p.roles.includes(a.role)).map(p=>{
  const r=providerResearch(p.slug);let score=0;const why:string[]=[];
  if(a.query&&(lc(p.name).includes(lc(a.query))||p.slug.includes(lc(a.query).replace(/\s+/g,'-')))){score+=20;why.push('name matches the query');}
  if(a.sector){const n=r.cases.filter(c=>c.sector_slug===a.sector).length;if(n){score+=5+Math.min(n,10);why.push(`${n} published customer case${n>1?'s':''} in this sector`);}}
  let matched:Finding[]=[];
  if(needTerms.length){matched=r.findings.map(f=>({f,h:needTerms.filter(t=>lc(f.question+' '+f.answer+' '+f.theme+' '+f.scope).includes(t)).length})).filter(x=>x.h>0).sort((x,y)=>y.h-x.h).slice(0,40).map(x=>x.f);if(matched.length){score+=Math.min(matched.length,15);why.push(`${matched.length} evidenced finding${matched.length>1?'s':''} mention your need`);}
   const prod=r.products.filter(x=>needTerms.some(t=>lc(x.name).includes(t))).length;if(prod){score+=3;why.push('named product matches');}}
  if(loc){const d=r.siteDelivery.filter(x=>lc(x.country+' '+x.service+' '+x.location_type).includes(loc)),f=r.findings.filter(x=>lc(x.scope+' '+x.answer).includes(loc)&&/location|region|country|uk|deliver/i.test(x.theme+' '+x.question)).length;if(d.length||f){score+=Math.min(d.length+f,8);why.push('evidence mentions this location');}}
  return {p,r,score,why,matched};
 });
 const any=!!(a.sector||needTerms.length||loc||a.query);
 const ranked=rows.filter(x=>!any||x.score>0).sort((x,y)=>y.score-x.score||x.p.name.localeCompare(y.p.name)).slice(0,a.limit);
 return {count:ranked.length,of_total_researched:RESEARCH.providers.length,ordering:any?'Ordered by how much published evidence matches your filters. This is not a quality ranking.':'No filter given. Alphabetical.',note:SOURCE_NOTE,providers:ranked.map(x=>({...providerCard(x.p),match_reasons:x.why,evidenced_findings:x.r.findings.length,published_customer_cases:x.r.cases.length,published_list_price_lines:x.r.priceLines.filter(l=>l.amount!==null).length,top_matches:x.matched.slice(0,3).map(findingView)}))};
}

const compareSchema=z.object({providers:z.array(slug).min(2).max(5),theme:z.string().max(100).optional(),limit:z.number().int().min(1).max(80).default(30)}).strict();
function compare(a:z.infer<typeof compareSchema>){
 const unknown=a.providers.filter(s=>!RESEARCH.providers.some(p=>p.slug===s));if(unknown.length)throw new MarketError(404,'unknown_provider',{unknown,hint:'Use search_providers or list_providers for valid slugs.'});
 const per=a.providers.map(s=>({slug:s,r:providerResearch(s)}));
 const fields=new Map<string,{theme:string;question:string;by:Map<string,Finding>}>();
 for(const x of per)for(const f of x.r.findings){if(a.theme&&!lc(f.theme).includes(lc(a.theme)))continue;const e=fields.get(f.field_id)??{theme:f.theme,question:f.question,by:new Map()};e.by.set(x.slug,f);fields.set(f.field_id,e);}
 const shared=[...fields.entries()].filter(([,e])=>e.by.size>=2).sort((x,y)=>y[1].by.size-x[1].by.size||x[0].localeCompare(y[0]));
 return {providers:per.map(x=>({...providerCard({slug:x.slug,name:providerName(x.slug),roles:x.r.provider?.roles??[]}),evidenced_findings:x.r.findings.length,published_customer_cases:x.r.cases.length,published_list_price_lines:x.r.priceLines.filter(l=>l.amount!==null).length,last_evidence_update:x.r.updated})),questions_with_evidence_for_two_or_more:shared.length,rows_returned:Math.min(shared.length,a.limit),rows:shared.slice(0,a.limit).map(([field,e])=>({field_id:field,theme:e.theme,question:e.question,answers:a.providers.map(s=>{const f=e.by.get(s);return f?{provider:s,outcome:f.outcome,answer:clip(f.answer,200),source_url:sourceUrl(f.source_id),accessed:f.accessed_date}:{provider:s,outcome:'no evidence captured'};})})),note:SOURCE_NOTE+' A blank means no evidence was captured, not that the capability is absent.'};
}

const sectorSchema=z.object({sector:z.enum(sectorSlugs)}).strict();
function sectorShortlist(a:z.infer<typeof sectorSchema>){
 const s=sectorResearch(a.sector);const by=new Map<string,typeof s.rows>();for(const r of s.rows)by.set(r.case.slug,[...(by.get(r.case.slug)??[]),r]);
 const providers=[...by.entries()].map(([sl,rows])=>({...providerCard({slug:sl,name:providerName(sl),roles:RESEARCH.providers.find(p=>p.slug===sl)?.roles??[]}),published_cases_in_sector:rows.length,largest_published_site_count:rows.reduce((m,r)=>Math.max(m,r.case.site_count??0),0)||null,evidenced_findings:rows[0].evidence,cases:rows.slice(0,3).map(r=>({customer:r.case.customer,sites:r.case.site_count,sites_qualifier:r.case.site_count_qualifier,users:r.case.user_count,source_url:sourceUrl(r.case.source_id),accessed:r.case.accessed_date,claim:r.case.claim}))})).sort((x,y)=>y.published_cases_in_sector-x.published_cases_in_sector||(y.largest_published_site_count??0)-(x.largest_published_site_count??0)||x.name.localeCompare(y.name));
 return {sector:s.sector,page:`https://netify.co.uk/sase/research/sectors/${a.sector}/`,updated:s.updated,thin_evidence:s.thin,ordering:'Ordered by published customer cases in this sector, then size of the largest published case. This reflects published evidence only. It is not a ranking of quality or fit.',note:SOURCE_NOTE,provider_count:providers.length,providers};
}

const priceSchema=z.object({provider:slug.optional(),component:z.string().max(100).optional(),uk_only:z.boolean().default(false),limit:z.number().int().min(1).max(60).default(25)}).strict();
function listPrices(a:z.infer<typeof priceSchema>){
 let lines=RESEARCH.price_lines.filter(l=>l.amount!==null&&!l.historical);
 if(a.provider)lines=lines.filter(l=>l.slug===a.provider);if(a.uk_only)lines=lines.filter(l=>!l.non_uk);
 if(a.component){const c=lc(a.component);lines=lines.filter(l=>lc(l.component+' '+l.product+' '+l.charge_unit).includes(c));}
 const rules=a.provider?RESEARCH.price_rules.filter(r=>r.slug===a.provider).slice(0,10).map(r=>({rule:clip(r.rule,300),source_url:sourceUrl(r.source_id)})):[];
 return {count:lines.length,returned:Math.min(lines.length,a.limit),status:'Published list prices found in desk research. They are not quotes and do not include discounts, circuits, taxes or services unless the line says so.',lines:lines.slice(0,a.limit).map(l=>({provider:l.slug,provider_name:providerName(l.slug),product:l.product,component:l.component,price:money(l.amount,l.currency),amount:l.amount,currency:l.currency,per:l.charge_unit,period:l.period,term_months:l.contract_term_months,qualifier:l.qualifier,labels:priceLabels(l),observed:l.observed_date,source_url:sourceUrl(l.source_id)})),price_rules:rules,research_updated:formatDate(RESEARCH.updated_date)};
}

const productIds=CONTEXT_PRODUCTS.map(p=>p.id) as [string,...string[]];
const rfpSchema=z.object({
 organisation:z.object({sector:z.enum(['retail_ecommerce','manufacturing','financial_services','healthcare','other']).default('other'),size_band:z.string().max(60).optional(),description:z.string().max(1500).optional()}).strict().default({sector:'other'}),
 products:z.array(z.enum(productIds)).min(1).max(13),
 sites:z.object({count:z.number().int().min(1).max(100000),regions:z.array(z.string().max(60)).max(20).default([]),notes:z.string().max(1500).optional()}).strict(),
 users:z.object({count:z.number().int().min(1).max(1000000),remote:z.number().int().min(0).max(1000000).default(0)}).strict(),
 current_environment:z.string().max(2000).optional(),
 desired_outcomes:z.string().max(2000).optional(),
 operating_model:z.enum(['self_managed','co_managed','fully_managed','undecided']).default('undecided'),
 compliance:z.array(z.string().max(80)).max(12).default([]),
 priorities:z.array(z.string().max(120)).max(10).default([]),
 response_deadline:z.string().max(40).optional(),
 go_live_target:z.string().max(40).optional(),
 question_limit:z.number().int().min(5).max(80).default(30)
}).strict();
export type RfpInput=z.infer<typeof rfpSchema>;
export function buildRfp(a:RfpInput){
 const label=(id:string)=>CONTEXT_PRODUCTS.find(p=>p.id===id)?.label??id;
 const pack=a.organisation.sector==='other'?null:sectorPack(a.organisation.sector);
 const canon=canonicalQuestions();
 const words=new Set(a.products.flatMap(id=>lc(label(id)).split(/[^a-z]+/).filter(w=>w.length>2)));
 const scored=canon.map(q=>({q,s:[...words].filter(w=>lc(q.category+' '+q.text).includes(w)).length}));
 const picked=[...scored.filter(x=>x.s>0).sort((x,y)=>y.s-x.s).map(x=>x.q),...scored.filter(x=>x.s===0).map(x=>x.q)].slice(0,Math.ceil(a.question_limit*0.7));
 const sectorQs=(pack?.sections??[]).flatMap(s=>s.questions.map(q=>({id:q.id,category:pack!.label+' / '+s.title,text:q.text}))).slice(0,a.question_limit-picked.length);
 const questions=[...picked,...sectorQs];
 const operating={self_managed:'Self-managed: the buyer operates the service',co_managed:'Co-managed: responsibilities shared with the supplier',fully_managed:'Fully managed: the supplier operates the service',undecided:'Operating model not yet decided. Suppliers should price the options they offer'}[a.operating_model];
 const sections=[
  {id:'background',title:'Background',body:[a.organisation.description??'The buyer has not supplied a description.','Sector: '+(a.organisation.sector==='other'?'not stated':a.organisation.sector.replaceAll('_',' '))+(a.organisation.size_band?'. Size: '+a.organisation.size_band:'')+'.',a.current_environment?'Current environment: '+a.current_environment:'Current environment: not described.'].join('\n')},
  {id:'scope',title:'Scope of services',body:['Services requested: '+a.products.map(label).join(', ')+'.',operating+'.',`Sites: ${a.sites.count}${a.sites.regions.length?' across '+a.sites.regions.join(', '):''}.${a.sites.notes?' '+a.sites.notes:''}`,`Users: ${a.users.count}${a.users.remote?`, of whom ${a.users.remote} work remotely`:''}.`].join('\n')},
  {id:'outcomes',title:'Outcomes and priorities',body:[a.desired_outcomes??'Outcomes not stated.',a.priorities.length?'Evaluation priorities, in order: '+a.priorities.map((p,i)=>`${i+1}. ${p}`).join('; ')+'.':'No evaluation priorities stated.'].join('\n')},
  {id:'compliance',title:'Compliance and assurance',body:a.compliance.length?'Suppliers must state how they meet: '+a.compliance.join(', ')+'.':'No specific compliance requirements stated. Suppliers should list the certifications they hold.'},
  {id:'commercial',title:'Commercial response',body:'Price each component separately: licences (state the unit, such as per user, per site or per device), hardware, circuits and connectivity, onboarding, managed service fees, support tiers and exit costs. State contract terms, minimum commitments, price-hold period and what is excluded. Quotations are valid only if they state assumptions.'},
  {id:'timeline',title:'Timeline',body:`Response deadline: ${a.response_deadline??'to be agreed'}. Target go-live: ${a.go_live_target??'to be agreed'}.`},
  {id:'instructions',title:'Response instructions',body:'Answer every question. Mark each answer as supported, partial, partner-delivered or not supported, and attach evidence. Supplier claims are verified before award. Unanswered questions are treated as not supported.'}
 ];
 const markdown=['# Request for proposal: SD-WAN and SASE services','_Draft prepared with the Netify RFP Builder. Review before use._',...sections.map(s=>`\n## ${s.title}\n${s.body}`),'\n## Questions for suppliers',...questions.map((q,i)=>`${i+1}. [${q.category}] ${q.text}`)].join('\n');
 return {status:'draft',persisted:false,question_bank:'Netify question bank v2026.1',sections,questions,markdown};
}

const boardSchema=z.object({limit:z.number().int().min(1).max(50).default(20),scope:z.string().max(40).optional()}).strict();
async function board(a:z.infer<typeof boardSchema>){
 if(!kvConfigured())throw new MarketError(503,'board_unavailable');
 let list=await listPublicOpportunities();if(a.scope)list=list.filter(o=>(o.scope??[]).includes(a.scope as never));
 return {public_only:true,anonymised:'Buyer identity is not published unless the buyer opted in. No pricing amounts or contact details appear here.',board_url:'https://netify.co.uk/sase/opportunities/board/',count:list.length,opportunities:list.slice(0,a.limit).map(o=>({...o,notice_url:`https://netify.co.uk/sase/opportunities/${o.id}/`}))};
}

const tool=<T extends z.ZodType>(name:string,title:string,description:string,schema:T,run:(a:z.infer<T>,ctx:MarketContext)=>unknown|Promise<unknown>,access:MarketTool['access']='open',readOnly=true):MarketTool=>({name,title,description,access,inputSchema:z.toJSONSchema(schema),annotations:{readOnlyHint:readOnly,destructiveHint:false,idempotentHint:readOnly,openWorldHint:false},handler:async(args,ctx)=>{const p=schema.safeParse(args??{});if(!p.success)throw new MarketError(422,'invalid_arguments',{issues:p.error.issues.slice(0,8).map(i=>({path:i.path.join('.'),message:i.message}))});return run(p.data,ctx);}});
export const defineMarketTool=tool;
const wrap=(data:unknown)=>({publisher:'Netify',contract_version:MARKET_VERSION,generated_at:new Date().toISOString(),data});
export const OPEN_TOOLS:MarketTool[]=[
 tool('search_providers','Search SD-WAN and SASE providers','Find researched UK SD-WAN and SASE providers by sector, need, location or role. Returns evidence-backed matches with sources. Open, no sign-in. Not a quality ranking.',searchSchema,a=>wrap(search(a))),
 tool('compare_providers','Compare providers side by side','Compare two to five providers on the questions where published evidence exists, with sources and access dates. Open, no sign-in.',compareSchema,a=>wrap(compare(a))),
 tool('get_sector_shortlist','Sector shortlist','Providers with published customer cases in a UK sector (financial-services, government, retail, healthcare, manufacturing, energy-and-utilities, education, transport-and-logistics, professional-services, hospitality), with case sources. Open, no sign-in.',sectorSchema,a=>wrap(sectorShortlist(a))),
 tool('get_list_prices','Published list prices','Published list-price lines from desk research, with units, terms and source links. These are not quotes. Filter by provider or component. Open, no sign-in.',priceSchema,a=>wrap(listPrices(a))),
 tool('build_rfp','Build an RFP draft','Turn requirements into a structured RFP draft with sections, supplier questions from the Netify question bank and Markdown text. Saves and sends nothing. Open, no sign-in.',rfpSchema,a=>{const structured=Object.fromEntries(Object.entries(buildRfp(a)).filter(([k])=>k!=='markdown'));return wrap({...structured,note:'Structured draft returned for your assistant to use. Nothing is saved or sent. The formatted RFP document and the recommended-providers pack are a single bundle for verified work emails.'});}),
 tool('get_opportunity_board','Read the opportunity board','Read open public opportunities, anonymised unless the buyer opted in to show their company. No pricing or contact details. Open, no sign-in.',boardSchema,async a=>wrap(await board(a)))
];
export const RFP_INPUT_SCHEMA=rfpSchema;
