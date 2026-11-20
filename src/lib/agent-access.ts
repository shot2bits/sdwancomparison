import {createHash,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {kvRaw,kvConfigured,kvGetJson,saveOpportunity,getOpportunity,newId,newSecretToken} from './rfp-store';
import {OpportunitySchema,type Opportunity,type OppScope} from './opportunity-types';
import {addFeedItem} from './opportunity';
import {queueAdminAlert,tryAdminAlert} from './admin-alerts';
import {activityMailKey,activityMailFetch} from './activity-mail';
import {isBlockedDomainLive,isAcademicDomain,emailDomain} from './access-control';
import {defaultCounterStore,contactEmail,SendGuardError} from './send-guard';
import {anonymiseText,anonymiseList} from './agent-anonymise';
import {MarketError,RFP_INPUT_SCHEMA,buildRfp,search,type RfpInput} from './marketplace-mcp';
import {CONTEXT_PRODUCTS} from './context-product-catalogue';

/**
 * Verified business-email identity for people and their AI agents. One rule set
 * for both: a one-time code to a work address issues a scoped token, and
 * publishing needs explicit consent. The public board is anonymised unless the
 * buyer opts in, separately, to show their company.
 */
export const TOKEN_PREFIX='netify_buyer_';
const CODE_TTL=900,TOKEN_TTL=30*86400,MAX_ATTEMPTS=5;
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const emailKey=(email:string)=>sha('agent-email:'+email).slice(0,40);
const isPreview=()=>process.env.VERCEL_ENV==='preview';
export type Identity={email:string;domain:string;tokenHash:string};
export type Pending={requirement?:RfpInput;consent_publish?:boolean;show_company?:boolean;company_name?:string};

async function setEx(key:string,value:unknown,ttl:number){await kvRaw(['SET',key,JSON.stringify(value),'EX',ttl]);}
async function counters(ip:string,email:string){
 const store=defaultCounterStore(),hour=Math.floor(Date.now()/3600000),day=Math.floor(Date.now()/86400000);
 const checks:[string,number,number][]=[['ip:'+sha(ip).slice(0,24)+':'+hour,10,3900],['em:'+emailKey(email)+':'+hour,5,3900],['all:'+day,400,90000]];
 for(const [k,max,ttl] of checks){let n:number;try{n=await store.incr('netify:agent-otp:'+k,ttl);}catch{throw new MarketError(503,'sign_in_unavailable');}if(n>max)throw new MarketError(429,'too_many_requests',{retry_after_minutes:60,message:'Too many verification requests. Please wait before trying again.'});}
}

export async function businessEmail(value:unknown){
 let email:string;try{email=contactEmail(value);}catch(e){if(e instanceof SendGuardError)throw new MarketError(422,'enter_work_email',{message:'Enter a valid work email address.'});throw e;}
 const domain=emailDomain(email);if(!domain)throw new MarketError(422,'enter_work_email',{message:'Enter a valid work email address.'});
 if(await isBlockedDomainLive(domain))throw new MarketError(422,'work_email_required',{message:'Please use your work email. Free and personal email addresses such as Gmail, Outlook, Hotmail, Yahoo and iCloud cannot be used.'});
 if(isAcademicDomain(domain))throw new MarketError(422,'work_email_required',{message:'Academic addresses need a Netify review first. Please contact the Netify team or use an organisation address.'});
 return {email,domain};
}

async function sendCode(email:string,code:string,pending?:Pending){
 const key=activityMailKey();
 const publishes=pending?.consent_publish?'<p>Entering this code confirms you control this address. Because you agreed to publish, your requirement will then be posted to the Netify opportunity board'+(pending.show_company?' with your company name shown':', anonymised, with no names, emails, phone numbers or company shown')+', and made available to Netify\'s curated providers.</p>':'';
 const html=`<p>Your Netify verification code is:</p><p style="font-size:26px;letter-spacing:6px;font-weight:bold">${code}</p><p>It expires in 15 minutes and works once.</p>${publishes}<p>If you did not ask for this, ignore this email and nothing will be published.</p>`;
 const text=`Your Netify verification code is ${code}. It expires in 15 minutes and works once. If you did not ask for this, ignore this email.`;
 if(!key){if(isPreview())return false;throw new MarketError(503,'sign_in_unavailable');}
 try{const res=await activityMailFetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({from:process.env.AUTH_FROM_EMAIL??'no-reply@mail.netify.co.uk',to:email,subject:'Your Netify verification code',html,text})});if(!res.ok)throw new Error('delivery');return true;}
 catch{if(isPreview())return false;throw new MarketError(503,'sign_in_unavailable',{message:'We could not send the code. Please try again shortly.'});}
}

export async function requestAccessCode(emailRaw:unknown,ip:string,pending?:Pending){
 if(!kvConfigured())throw new MarketError(503,'sign_in_unavailable');
 const {email}=await businessEmail(emailRaw);await counters(ip,email);
 const code=String(randomInt(0,1000000)).padStart(6,'0');
 await setEx('agent:otp:'+emailKey(email),{codeHash:sha(code+':'+emailKey(email)),attempts:0,created:Date.now(),pending:pending??null},CODE_TTL);
 let delivered=false;try{delivered=await sendCode(email,code,pending);}catch(e){await kvRaw(['DEL','agent:otp:'+emailKey(email)]);throw e;}
 return {sent:true,expires_in_minutes:15,delivered,...(isPreview()?{preview_code:code,preview_note:'Shown only on isolated preview deployments. Never returned in production.'}:{})};
}

export async function verifyAccessCode(emailRaw:unknown,codeRaw:unknown){
 const {email}=await businessEmail(emailRaw);const code=String(codeRaw??'').replace(/\s+/g,'');
 if(!/^\d{6}$/.test(code))throw new MarketError(422,'invalid_code',{message:'The code is six digits.'});
 const key='agent:otp:'+emailKey(email),rec=await kvGetJson<{codeHash:string;attempts:number;pending:Pending|null}>(key);
 if(!rec)throw new MarketError(401,'code_expired',{message:'No active code for this address. Request a new one.'});
 if(rec.attempts>=MAX_ATTEMPTS){await kvRaw(['DEL',key]);throw new MarketError(429,'too_many_attempts',{message:'Too many wrong codes. Request a new one.'});}
 const ok=(()=>{const a=Buffer.from(sha(code+':'+emailKey(email))),b=Buffer.from(rec.codeHash);return a.length===b.length&&timingSafeEqual(a,b);})();
 if(!ok){await setEx(key,{...rec,attempts:rec.attempts+1},CODE_TTL);throw new MarketError(401,'wrong_code',{attempts_left:MAX_ATTEMPTS-rec.attempts-1});}
 await kvRaw(['DEL',key]);
 const token=TOKEN_PREFIX+randomBytes(32).toString('base64url');
 await setEx('agent:tok:'+sha(token),{email,created:Date.now(),published:0},TOKEN_TTL);
 return {token,email,pending:rec.pending,expires_in_days:30};
}

export async function authenticate(raw:unknown):Promise<Identity>{
 const token=typeof raw==='string'?raw.trim().replace(/^Bearer /,''):'';
 if(!token.startsWith(TOKEN_PREFIX)||token.length<40||token.length>120)throw new MarketError(401,'verified_email_required',needHelp());
 const h=sha(token),rec=await kvGetJson<{email:string}>('agent:tok:'+h);
 if(!rec)throw new MarketError(401,'verified_email_required',needHelp());
 return {email:rec.email,domain:emailDomain(rec.email)??'',tokenHash:h};
}
const needHelp=()=>({message:'This needs a verified work email. Call request_access_code with your work email, then verify_access_code with the six digit code, and pass the returned access_token.'});
export async function revokeToken(id:Identity){await kvRaw(['DEL','agent:tok:'+id.tokenHash]);return {revoked:true};}

/* ---------- publishing ---------- */
const REGION_KEYS:[RegExp,string][]=[[/\b(uk|united kingdom|great britain|britain|england|scotland|wales|northern ireland|ireland|london)\b/i,'uk'],[/europe|eu\b|emea/i,'europe'],[/north america|usa|united states|canada/i,'north_america'],[/asia|apac|pacific|india|japan|singapore|australia/i,'asia_pacific'],[/middle east|africa|gulf|uae/i,'middle_east_africa'],[/latin|south america|brazil|mexico/i,'latin_america']];
const SCOPE_OF:Record<string,OppScope>={sdwan:'sd_wan',sse:'sse',ztna:'ztna',firewall:'firewall_fwaas',mdr:'managed_security',dlp:'sse'};
const usersBand=(n:number)=>n<100?'under_100':n<=500?'100-500':n<=2500?'500-2500':n<=10000?'2500-10000':'10000+';
const SECTOR_LABEL:Record<string,string>={retail_ecommerce:'Retail and e-commerce',manufacturing:'Manufacturing',financial_services:'Financial services',healthcare:'Healthcare and pharma',government_public_sector:'Government and public sector',education:'Education',energy_utilities:'Energy and utilities',transport_logistics:'Transport and logistics',professional_services:'Professional services',hospitality_leisure:'Hospitality and leisure',other:''};
const RESEARCH_SECTOR:Record<string,string>={retail_ecommerce:'retail',manufacturing:'manufacturing',financial_services:'financial-services',healthcare:'healthcare',government_public_sector:'government',education:'education',energy_utilities:'energy-and-utilities',transport_logistics:'transport-and-logistics',professional_services:'professional-services',hospitality_leisure:'hospitality'};
const label=(id:string)=>CONTEXT_PRODUCTS.find(p=>p.id===id)?.label??id;

/** Gate for file downloads from the shortlist: a verified token that has agreed to publish at least once. */
export async function requireDownloadAccess(header:string|null){
 const id=await authenticate(header),rec=await kvGetJson<{published?:number}>('agent:tok:'+id.tokenHash);
 if(!rec||!(rec.published&&rec.published>0))throw new MarketError(403,'publish_consent_required',{message:'Downloads need a verified work email and your agreement to publish your requirement to the opportunity board.'});
 return id;
}

export const PublishArgs=z.object({
 requirement:RFP_INPUT_SCHEMA,
 consent_publish:z.literal(true,{error:'You must agree to publish this requirement to the opportunity board.'}),
 show_company:z.boolean().default(false),
 company_name:z.string().max(120).optional()
}).strict();
export type PublishInput=z.infer<typeof PublishArgs>;

/** Free text cannot be anonymised reliably (names, short company names), so it is only published on the show-company opt-in and always stays in the private bundle. */
export function publicFacts(r:RfpInput,identity:{email:string},opts:{show_company:boolean;company_name?:string}){
 const ctx={company:opts.company_name,email:identity.email,keepCompany:opts.show_company};
 const labels=r.products.map(label),sector=SECTOR_LABEL[r.organisation.sector]??'';
 const scope=[...new Set(r.products.map(p=>SCOPE_OF[p]).filter(Boolean))] as OppScope[];
 if(r.products.includes('sdwan')&&r.products.some(p=>p==='sse'||p==='ztna'))scope.push('sase');
 if(r.operating_model==='fully_managed'||r.operating_model==='co_managed')scope.push('managed_service');
 const regions=[...new Set((r.sites.regions??[]).map(x=>REGION_KEYS.find(([re])=>re.test(x.replace(/_/g,' ')))?.[1]).filter(Boolean) as string[])];
 const title=`${labels.slice(0,3).join(', ')} requirement${sector?': '+sector:''}`.slice(0,140);
 const summary=anonymiseText(`An organisation is seeking ${labels.join(', ')} across ${r.sites.count} site${r.sites.count===1?'':'s'} and ${r.users.count} users${r.users.remote?` (${r.users.remote} remote)`:''}.${opts.show_company?' '+(r.organisation.description??''):''}`,ctx,1500);
 return {title,scope:scope.length?scope:(['not_sure'] as OppScope[]),regions,summary,
  current_environment:opts.show_company?anonymiseText(r.current_environment??'',ctx,2000):'',desired_outcomes:opts.show_company?anonymiseText(r.desired_outcomes??'',ctx,2000):'',
  compliance_requirements:anonymiseList(r.compliance,ctx,80,12),evaluation_priorities:anonymiseList(r.priorities,ctx,120,10)};
}

export async function publishOpportunity(identity:Identity,input:PublishInput){
 if(!kvConfigured())throw new MarketError(503,'board_unavailable');
 const a=PublishArgs.safeParse(input);if(!a.success)throw new MarketError(422,'invalid_arguments',{issues:a.error.issues.slice(0,6).map(i=>({path:i.path.join('.'),message:i.message}))});
 const {requirement:r,show_company}=a.data;
 if(show_company&&!(a.data.company_name??'').trim())throw new MarketError(422,'company_name_required',{message:'Give the company name to show, or leave show_company off.'});
 const store=defaultCounterStore(),day=Math.floor(Date.now()/86400000);
 if(await store.incr('netify:agent-publish:'+emailKey(identity.email)+':'+day,90000)>5)throw new MarketError(429,'publish_limit',{message:'You can publish up to five requirements a day.'});
 const f=publicFacts(r,identity,{show_company,company_name:a.data.company_name});
 const now=Date.now(),id=newId('opp');
 const parsed=OpportunitySchema.safeParse({
  id,created:now,updated:now,buyer_org:show_company?(a.data.company_name??'').trim().slice(0,120):'',title:f.title,scope:f.scope,sites:r.sites.count,regions:f.regions,summary:f.summary,
  budget_note:'',timeline_note:r.go_live_target?anonymiseText('Target go-live '+r.go_live_target,{},120):'Not decided',status:'open',engagement_type:'quote_room',auction_format:'open',deadline:null,eligibility:'invited',visibility:'public',
  awarded_vendor_slug:null,buyer_token:newSecretToken('btok'),invited:[],feed:[],buyer_visibility:show_company?'named':'anonymous',buyer_public_opt_in:show_company,
  buyer_sector:r.organisation.sector==='other'?'other':r.organisation.sector,buyer_size_band:'',users_band:usersBand(r.users.count),remote_users_band:r.users.remote?usersBand(r.users.remote):'',cloud_platforms:[],
  current_environment:f.current_environment,desired_outcomes:f.desired_outcomes,compliance_requirements:f.compliance_requirements,evidence_requested:[],evaluation_priorities:f.evaluation_priorities,
  response_mode:'written_responses',response_deadline:null,decision_target:null,go_live_target:null,ai_summary:'',ai_assumptions:[],ai_gap_flags:[],methodology_version:'sase-marketplace-2026.1',owner_email:identity.email});
 if(!parsed.success)throw new MarketError(422,'invalid_opportunity',{issues:parsed.error.issues.slice(0,5).map(i=>i.path.join('.'))});
 const alertId=await queueAdminAlert({kind:'opportunity',reference:id});
 let opp=await saveOpportunity(parsed.data);
 opp=await addFeedItem(opp,'buyer',null,show_company?opp.buyer_org:'Buyer','post',opp.summary||opp.title);
 await tryAdminAlert(alertId);
 await kvRaw(['SADD','agent:opps:'+emailKey(identity.email),id]);
 await setEx('agent:req:'+id,{email:identity.email,requirement:r,consent_publish:true,show_company,company_name:show_company?a.data.company_name:undefined,created:now},400*86400);
 const rec=await kvGetJson<{email:string;created:number;published?:number}>('agent:tok:'+identity.tokenHash);
 if(rec)await setEx('agent:tok:'+identity.tokenHash,{...rec,published:(rec.published??0)+1},TOKEN_TTL);
 return {opportunity_id:id,notice_url:`https://netify.co.uk/sase/opportunities/${id}/`,public_preview:publicView(opp),published:true,company_shown_publicly:show_company,
  next:'Netify reviews the requirement and invites curated providers. Use get_rfp_bundle to download your RFP and recommended providers.'};
}
const publicView=(o:Opportunity)=>({title:o.title,summary:o.summary,scope:o.scope,regions:o.regions,sites:o.sites,buyer:o.buyer_visibility==='named'?o.buyer_org:'Anonymous buyer',status:o.status});

export async function listMine(identity:Identity){
 const ids=(await kvRaw(['SMEMBERS','agent:opps:'+emailKey(identity.email)])) as string[]|null;
 const out=[];for(const id of ids??[]){const o=await getOpportunity(id);if(!o||o.owner_email!==identity.email)continue;
  out.push({opportunity_id:o.id,title:o.title,status:o.status,listed_publicly:o.visibility==='public'&&o.status==='open',company_shown_publicly:Boolean((o as {buyer_public_opt_in?:boolean}).buyer_public_opt_in),created:new Date(o.created).toISOString(),invited_providers:o.invited.length,responses:o.feed.filter(f=>f.actor_type==='supplier').length,notice_url:`https://netify.co.uk/sase/opportunities/${o.id}/`});}
 return {count:out.length,opportunities:out.sort((x,y)=>y.created.localeCompare(x.created))};
}
export async function ownedOpportunity(identity:Identity,id:unknown){
 if(typeof id!=='string'||!/^opp_[a-z0-9]{6,40}$/.test(id))throw new MarketError(422,'invalid_opportunity_id');
 const o=await getOpportunity(id);if(!o||o.owner_email!==identity.email)throw new MarketError(404,'opportunity_not_found');return o;
}
export async function withdrawOpportunity(identity:Identity,id:unknown){
 const o=await ownedOpportunity(identity,id);const now=Date.now();
 const next=await saveOpportunity({...o,status:'closed',visibility:'unlisted',closed_at:now,updated:now});
 return {opportunity_id:next.id,status:next.status,listed_publicly:false,message:'Withdrawn. It no longer appears on the public board.'};
}

/* ---------- bundle: RFP document plus recommended providers ---------- */
export function vendorPack(r:RfpInput,limit=6){
 const sector=RESEARCH_SECTOR[r.organisation.sector];
 const need=[...r.products.map(label),...r.priorities].join(' ');
 const res=search({sector:sector as never,need,limit,location:undefined,query:undefined,role:undefined} as never) as {providers:{slug:string;name:string;roles:string[];profile_url:string;evidence_url:string;match_reasons:string[];evidenced_findings:number;published_customer_cases:number;published_list_price_lines:number;top_matches:{question:string;answer:string;source_url:string|null}[]}[];note:string;ordering:string};
 const md=['## Recommended providers to approach',`_${res.ordering} ${res.note}_`,...res.providers.map((p,i)=>[`\n### ${i+1}. ${p.name}`,`Type: ${p.roles.join(', ')||'not stated'}. Evidence: ${p.evidenced_findings} findings, ${p.published_customer_cases} published customer cases, ${p.published_list_price_lines} published list-price lines.`,p.match_reasons.length?`Why it matched: ${p.match_reasons.join('; ')}.`:'',`Profile: ${p.profile_url}`,`Evidence: ${p.evidence_url}`,...p.top_matches.map(m=>`- ${m.question} ${m.answer}${m.source_url?` (${m.source_url})`:''}`)].filter(Boolean).join('\n')),
  '\n## Before you contact them','Ask each provider to confirm in writing that it can serve your sites, to price each component separately and to state assumptions. Published evidence is desk research and not a quotation.'].join('\n');
 return {providers:res.providers.map(p=>({slug:p.slug,name:p.name,profile_url:p.profile_url,evidence_url:p.evidence_url,match_reasons:p.match_reasons})),markdown:md};
}
export async function bundleFor(identity:Identity,id:unknown){
 const o=await ownedOpportunity(identity,id);
 const rec=await kvGetJson<{requirement:RfpInput;consent_publish:boolean}>('agent:req:'+o.id);
 if(!rec?.consent_publish)throw new MarketError(403,'publish_consent_required',{message:'The bundle is released for requirements you have agreed to publish.'});
 const rfp=buildRfp(rec.requirement),pack=vendorPack(rec.requirement);
 const markdown=rfp.markdown+'\n\n---\n\n'+pack.markdown;
 return {opportunity_id:o.id,rfp:{sections:rfp.sections,questions:rfp.questions},recommended_providers:pack.providers,markdown,formats:['markdown','docx','json']};
}
export {getOpportunity};
