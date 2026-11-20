import {createHash,randomBytes} from 'node:crypto';
import {kvRaw,kvConfigured,kvGetJson,newId} from './rfp-store';
import {finalEnabled,platformOwner} from './final-platform-flags';
import {activityMailKey,activityMailFetch} from './activity-mail';
import {activityEnvironment} from './activity-provenance';
import {defaultCounterStore} from './send-guard';
import {vendorName} from './opportunity';
import {VENDOR_DOMAINS} from './vendor-domains';
import {emailDomain} from './access-control';
import {MarketError} from './marketplace-mcp';
import {ownedOpportunity,type Identity} from './agent-access';

/**
 * Project conversations, built apart from the legacy opportunity feed.
 * A thread is private to one buyer and one provider (or the Netify team).
 * Providers reply from an emailed one-time link and need no account.
 * Sending to a provider is held unless SUPPLIER_DISPATCH is on, and provider
 * replies are refused unless SUPPLIER_INTAKE is on. Both are off in production.
 */
export const SITE='https://netify.co.uk/sase';
export type ThreadKind='provider'|'netify';
export type Sender='buyer'|'provider'|'netify_team'|'system';
export type MessageState='sent'|'held'|'delivery_failed';
export type Thread={id:string;opportunity_id:string;kind:ThreadKind;provider_slug:string|null;provider_name:string|null;title:string;buyer_email:string;created:number;updated:number;status:'open'|'closed';team_joined:string[];messages:number;last_from:Sender|null};
export type Message={id:string;from:Sender;name:string;body:string;at:number;state:MessageState;note?:string};

const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const emailKey=(email:string)=>sha('agent-email:'+email).slice(0,40);
const isProduction=()=>activityEnvironment()==='production';
const LINK_TTL=7*86400,SESSION_TTL=86400,MAX_BODY=4000;
export const TEST_PROVIDER={slug:'netify-test-vendor',name:'Netify Test Provider (not a real provider)'};

/* ---------- providers ---------- */
export const testProviderEnabled=()=>!isProduction();
export const isTestProvider=(slug:string)=>slug===TEST_PROVIDER.slug;
export function providerLabel(slug:string):string|null{if(isTestProvider(slug))return testProviderEnabled()?TEST_PROVIDER.name:null;return vendorName(slug);}
export type Contact={email:string;name:string};
export async function providerContact(slug:string):Promise<Contact|null>{
 if(isTestProvider(slug))return testProviderEnabled()?{email:(process.env.NETIFY_THREAD_TEST_VENDOR_EMAIL??'thread-test-provider@example.invalid').trim().toLowerCase(),name:'Test provider contact'}:null;
 return kvGetJson<Contact>('thr:contact:'+slug);
}
/** Netify sets a provider's contact. The address must sit on a domain approved for that provider. */
export async function setProviderContact(slug:unknown,emailRaw:unknown,name:unknown){
 if(typeof slug!=='string'||!vendorName(slug))throw new MarketError(422,'unknown_provider');
 const email=typeof emailRaw==='string'?emailRaw.trim().toLowerCase():'';const domain=emailDomain(email);
 if(!domain||!/^[^@\s]+@[^@\s]+$/.test(email))throw new MarketError(422,'invalid_email');
 if(!(VENDOR_DOMAINS[slug]??[]).includes(domain))throw new MarketError(422,'domain_not_approved_for_provider',{approved_domains:VENDOR_DOMAINS[slug]??[]});
 const c={email,name:typeof name==='string'&&name.trim()?name.trim().slice(0,80):'Sales team'};
 await kvRaw(['SET','thr:contact:'+slug,JSON.stringify(c)]);return {provider_slug:slug,contact:c};
}

/* ---------- mail ---------- */
async function sendMail(to:string,subject:string,text:string,replyTo?:string):Promise<boolean>{
 const key=activityMailKey();if(!key)return false;
 const html='<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">'+text.split(/\n\n/).map(p=>'<p>'+p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>').replace(/(https:\/\/[^\s<]+)/g,'<a href="$1">$1</a>')+'</p>').join('')+'</div>';
 try{const res=await activityMailFetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({from:process.env.AUTH_FROM_EMAIL??'no-reply@mail.netify.co.uk',to,subject,text,html,...(replyTo?{reply_to:replyTo}:{})})});return res.ok;}catch{return false;}
}
const base=()=>isProduction()?SITE:process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}/sase`:SITE;

/* ---------- store ---------- */
const TK=(id:string)=>'thr:'+id;
export const validThreadId=(id:unknown):id is string=>typeof id==='string'&&/^thr_[a-z0-9]{8,40}$/.test(id);
export async function getThread(id:unknown):Promise<Thread|null>{if(!validThreadId(id))return null;return kvGetJson<Thread>(TK(id));}
async function saveThread(t:Thread){await kvRaw(['SET',TK(t.id),JSON.stringify(t)]);}
export async function messagesOf(id:string,limit=200):Promise<Message[]>{
 const rows=(await kvRaw(['LRANGE',TK(id)+':m',0,limit-1])) as string[]|null;
 return (rows??[]).map(r=>{try{return JSON.parse(r) as Message;}catch{return null;}}).filter(Boolean).reverse() as Message[];
}
async function append(t:Thread,m:Omit<Message,'id'|'at'>):Promise<{thread:Thread;message:Message}>{
 const message:Message={id:newId('msg'),at:Date.now(),...m};
 await kvRaw(['LPUSH',TK(t.id)+':m',JSON.stringify(message)]);
 const next:Thread={...t,updated:message.at,messages:t.messages+1,last_from:m.from==='system'?t.last_from:m.from};await saveThread(next);return {thread:next,message};
}
async function ensureThread(opp:{id:string;title:string;owner_email?:string|null},kind:ThreadKind,buyer:string,provider?:{slug:string;name:string}):Promise<Thread>{
 const idxKey=`thr:idx:${opp.id||'general:'+emailKey(buyer)}:${kind}:${provider?.slug??'-'}`;
 const existing=(await kvRaw(['GET',idxKey])) as string|null;if(existing){const t=await getThread(existing);if(t)return t;}
 const t:Thread={id:newId('thr'),opportunity_id:opp.id,kind,provider_slug:provider?.slug??null,provider_name:provider?.name??null,title:opp.title,buyer_email:buyer,created:Date.now(),updated:Date.now(),status:'open',team_joined:[],messages:0,last_from:null};
 const won=await kvRaw(['SET',idxKey,t.id,'NX']);
 if(won!=='OK'){const again=(await kvRaw(['GET',idxKey])) as string|null;const found=again?await getThread(again):null;if(found)return found;}
 await saveThread(t);
 await kvRaw(['SADD','thr:buyer:'+emailKey(buyer),t.id]);await kvRaw(['SADD','thr:all',t.id]);if(opp.id)await kvRaw(['SADD','thr:opp:'+opp.id,t.id]);
 return t;
}
async function limit(key:string,max:number,ttl:number,code='message_limit'){let n:number;try{n=await defaultCounterStore().incr('netify:thr:'+key,ttl);}catch{throw new MarketError(503,'messaging_unavailable');}if(n>max)throw new MarketError(429,code,{message:'Too many messages. Please wait before sending more.'});}
const cleanBody=(v:unknown)=>{if(typeof v!=='string'||!v.trim())throw new MarketError(422,'message_required');if(v.length>MAX_BODY)throw new MarketError(422,'message_too_long',{max_characters:MAX_BODY});return v.trim();};

/* ---------- provider links and sessions ---------- */
async function issueLink(t:Thread){
 const token=randomBytes(32).toString('base64url');
 await kvRaw(['SET','thr:link:'+sha(token),JSON.stringify({thread_id:t.id,provider:t.provider_slug,created:Date.now()}),'EX',LINK_TTL]);
 return `${base()}/thread/open/#${token}`;
}
export async function exchangeLink(tokenRaw:unknown){
 if(!finalEnabled('intake'))throw new MarketError(404,'feature_not_enabled');
 if(typeof tokenRaw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(tokenRaw))throw new MarketError(410,'thread_link_unavailable',linkHelp());
 const key='thr:link:'+sha(tokenRaw),rec=await kvGetJson<{thread_id:string}>(key);
 if(!rec)throw new MarketError(410,'thread_link_unavailable',linkHelp());
 // DEL reports how many keys it removed, so only one caller can win a link.
 if((await kvRaw(['DEL',key]))!==1)throw new MarketError(410,'thread_link_unavailable',linkHelp());
 const t=await getThread(rec.thread_id);if(!t||t.status!=='open'||t.kind!=='provider')throw new MarketError(410,'thread_link_unavailable',linkHelp());
 const session=randomBytes(32).toString('base64url');
 await kvRaw(['SET','thr:ses:'+sha(session),JSON.stringify({thread_id:t.id,created:Date.now()}),'EX',SESSION_TTL]);
 return {thread_id:t.id,session,max_age:SESSION_TTL};
}
const linkHelp=()=>({message:'This link has already been used or has expired. Ask for a new link on the conversation page, or ask the buyer to message you again.'});
export const sessionCookieName=(threadId:string)=>'netify_thr_'+threadId;
export async function providerViewer(threadId:string,session:string|null){
 if(!session||!/^[A-Za-z0-9_-]{43}$/.test(session))return null;
 const rec=await kvGetJson<{thread_id:string}>('thr:ses:'+sha(session));return rec&&rec.thread_id===threadId?rec:null;
}
/** Sends a new link to the address on record only, so asking for one cannot redirect it. */
export async function relink(threadId:unknown){
 if(!finalEnabled('intake')||!finalEnabled('dispatch'))throw new MarketError(404,'feature_not_enabled');
 const t=await getThread(threadId);if(!t||t.kind!=='provider'||t.status!=='open'||!t.provider_slug)return {ok:true};
 await limit('relink:'+t.id,3,3900,'relink_limit');
 const c=await providerContact(t.provider_slug);if(!c)return {ok:true};
 const link=await issueLink(t);
 await sendMail(c.email,'Your link to the Netify conversation',`Here is a new link to the conversation about "${t.title}". It works once and expires in 7 days.\n\n${link}`,'support@netify.com');
 return {ok:true};
}

/* ---------- buyer actions ---------- */
export async function startOrReply(identity:Identity,a:{thread_id?:string;opportunity_id?:string;to?:'provider'|'netify_team';provider_slug?:string;body:unknown}){
 if(!kvConfigured())throw new MarketError(503,'messaging_unavailable');
 const body=cleanBody(a.body);await limit('buyer:'+emailKey(identity.email)+':'+Math.floor(Date.now()/86400000),40,90000);
 let t:Thread|null=null;
 if(a.thread_id){t=await getThread(a.thread_id);if(!t||t.buyer_email!==identity.email)throw new MarketError(404,'thread_not_found');}
 else{
  const opp=await ownedOpportunity(identity,a.opportunity_id);
  if(a.to==='netify_team'||!a.to&&!a.provider_slug)t=await ensureThread(opp,'netify',identity.email);
  else{
   const slug=a.provider_slug;if(!slug)throw new MarketError(422,'provider_slug_required',{message:'Say which provider to message, using its slug from list_responses or search_providers.'});
   const name=providerLabel(slug);if(!name)throw new MarketError(404,'unknown_provider');
   const engaged=isTestProvider(slug)||opp.invited.includes(slug)||opp.feed.some(f=>f.actor_type==='supplier'&&f.actor_slug===slug);
   if(!engaged)throw new MarketError(409,'provider_not_engaged',{message:'Netify invites providers to your requirement. You can message a provider once it has been invited or has responded. To ask for a provider to be added, use request_expert_help.'});
   t=await ensureThread(opp,'provider',identity.email,{slug,name});
  }
 }
 if(t.status!=='open')throw new MarketError(409,'thread_closed');
 if(t.kind==='netify'){
  const sent=await append(t,{from:'buyer',name:'Buyer',body,state:'sent'});
  await notifyOwner(sent.thread,body,identity.email);return {thread_id:t.id,message_id:sent.message.id,status:'sent',note:'The Netify team has been told and will reply in this thread. Use read_thread to see replies.'};
 }
 const d=await deliverToProvider(t,body);
 const sent=await append(t,{from:'buyer',name:'Buyer',body,state:d.state,...(d.note?{note:d.note}:{})});
 return {thread_id:t.id,message_id:sent.message.id,status:d.state==='sent'?'sent':'held',note:d.note??'Sent to the provider. They reply from a link in the email, with no sign-in. Use read_thread to see replies.',...(d.preview?{preview_provider_link:d.preview,preview_note:'Shown only on preview deployments for the test provider.'}:{})};
}
async function deliverToProvider(t:Thread,body:string):Promise<{state:MessageState;note?:string;preview?:string}>{
 if(!finalEnabled('dispatch'))return {state:'held',note:'Provider messaging is not switched on yet, so this message is held and has not been sent to the provider. The Netify team can see it.'};
 const c=t.provider_slug?await providerContact(t.provider_slug):null;
 if(!c)return {state:'held',note:'Netify does not have a verified contact for this provider yet, so the message is held. The Netify team can see it.'};
 const link=await issueLink(t);
 const ok=await sendMail(c.email,`A buyer has a question for ${t.provider_name??'you'} on Netify`,
  `A buyer who published a requirement on the Netify opportunity board has sent you a message.\n\nRequirement: ${t.title}\n\n${body}\n\nOpen the conversation and reply here. No sign-in is needed.\n${link}\n\nThe link works once and expires in 7 days. If you do not want these messages, reply to this email and we will stop them.`,'support@netify.com');
 const testOnPreview=!isProduction()&&Boolean(t.provider_slug)&&isTestProvider(t.provider_slug!);
 if(!ok&&!testOnPreview)return {state:'delivery_failed',note:'The email to the provider could not be delivered, so the message is held. The Netify team can see it.'};
 return {state:'sent',...(testOnPreview?{preview:link}:{})};
}
export async function requestExpertHelp(identity:Identity,a:{question:unknown;opportunity_id?:string}){
 if(!kvConfigured())throw new MarketError(503,'messaging_unavailable');
 const body=cleanBody(a.question);await limit('expert:'+emailKey(identity.email)+':'+Math.floor(Date.now()/86400000),5,90000,'expert_help_limit');
 const opp=a.opportunity_id?await ownedOpportunity(identity,a.opportunity_id):{id:'',title:'General question',owner_email:identity.email};
 const t=await ensureThread(opp,'netify',identity.email);
 if(t.status!=='open')throw new MarketError(409,'thread_closed');
 const sent=await append(t,{from:'buyer',name:'Buyer',body,state:'sent'});
 const notified=await notifyOwner(sent.thread,body,identity.email);
 return {thread_id:t.id,status:'sent',owner_notified:notified,note:'The Netify team has your question and will reply in this thread. Use read_thread to see replies.'};
}
async function notifyOwner(t:Thread,body:string,buyer:string):Promise<boolean>{
 return sendMail(platformOwner(),'Expert help requested: '+t.title,`A buyer has asked the Netify team for help.\n\nRequirement: ${t.title}${t.opportunity_id?` (${SITE}/opportunities/${t.opportunity_id}/)`:''}\nBuyer: ${buyer}\n\n${body}\n\nReply in the thread (sign in as Netify admin first):\n${base()}/thread/${t.id}/`,buyer);
}
export async function listThreads(identity:Identity,opportunityId?:string){
 const ids=((await kvRaw(['SMEMBERS','thr:buyer:'+emailKey(identity.email)])) as string[]|null)??[];const out=[];
 for(const id of ids){const t=await getThread(id);if(!t||t.buyer_email!==identity.email)continue;if(opportunityId&&t.opportunity_id!==opportunityId)continue;out.push(summary(t));}
 return {count:out.length,threads:out.sort((a,b)=>b.last_message_at.localeCompare(a.last_message_at))};
}
const summary=(t:Thread)=>({thread_id:t.id,with:t.kind==='netify'?'Netify team':t.provider_name,provider_slug:t.provider_slug,opportunity_id:t.opportunity_id||null,title:t.title,status:t.status,messages:t.messages,awaiting_your_reply:t.last_from==='provider'||t.last_from==='netify_team',netify_team_joined:t.team_joined.length>0,last_message_at:new Date(t.updated).toISOString()});
export async function readThread(identity:Identity,id:unknown){
 const t=await getThread(id);if(!t||t.buyer_email!==identity.email)throw new MarketError(404,'thread_not_found');
 return {...summary(t),messages:(await messagesOf(t.id)).map(m=>({from:m.from,name:m.name,body:m.body,at:new Date(m.at).toISOString(),state:m.state,...(m.note?{note:m.note}:{})}))};
}
export async function listResponses(identity:Identity,opportunityId:unknown){
 const o=await ownedOpportunity(identity,opportunityId);
 const responses=o.feed.filter(f=>f.actor_type==='supplier').map(f=>({id:f.id,provider:f.actor_name,provider_slug:f.actor_slug,type:f.type,summary:f.body.slice(0,800),pricing:f.pricing,links:f.links,answers:f.answers,at:new Date(f.created).toISOString()}));
 return {opportunity_id:o.id,status:o.status,invited_providers:o.invited.map(s=>({provider_slug:s,provider:vendorName(s)??s})),response_count:responses.length,responses,threads:(await listThreads(identity,o.id)).threads,
  note:responses.length?undefined:'No provider has responded yet. Netify invites curated providers and you will see their responses here.'};
}

/* ---------- provider and Netify team actions ---------- */
export async function providerReply(threadId:string,body:unknown){
 if(!finalEnabled('intake'))throw new MarketError(404,'feature_not_enabled');
 const t=await getThread(threadId);if(!t||t.kind!=='provider')throw new MarketError(404,'thread_not_found');if(t.status!=='open')throw new MarketError(409,'thread_closed');
 const text=cleanBody(body);await limit('prov:'+t.id+':'+Math.floor(Date.now()/3600000),20,3900);
 const sent=await append(t,{from:'provider',name:t.provider_name??'Provider',body:text,state:'sent'});
 await sendMail(t.buyer_email,`${t.provider_name??'A provider'} replied on your Netify requirement`,`${t.provider_name??'A provider'} has replied about "${t.title}".\n\n${text}\n\nUse your assistant's read_thread tool with thread ${t.id} to read the whole conversation and reply.`,'support@netify.com');
 return sent.message;
}
export async function teamPost(threadId:string,adminEmail:string,body:unknown){
 const t=await getThread(threadId);if(!t)throw new MarketError(404,'thread_not_found');
 const text=cleanBody(body);let cur=t;
 if(!cur.team_joined.includes(adminEmail)){cur={...cur,team_joined:[...cur.team_joined,adminEmail]};await saveThread(cur);cur=(await append(cur,{from:'system',name:'Netify',body:'The Netify team has joined this conversation.',state:'sent'})).thread;}
 const sent=await append(cur,{from:'netify_team',name:'Netify team',body:text,state:'sent'});cur=sent.thread;
 await sendMail(cur.buyer_email,'The Netify team replied on your requirement',`The Netify team has replied about "${cur.title}".\n\n${text}\n\nUse your assistant's read_thread tool with thread ${cur.id} to read the whole conversation and reply.`,'support@netify.com');
 if(cur.kind==='provider'&&finalEnabled('dispatch')&&cur.provider_slug){const c=await providerContact(cur.provider_slug);if(c){const link=await issueLink(cur);await sendMail(c.email,`Netify team message for ${cur.provider_name??'you'}`,`The Netify team has added a message to your conversation about "${cur.title}".\n\n${text}\n\nReply here. No sign-in is needed.\n${link}`,'support@netify.com');}}
 return sent.message;
}
export async function teamView(threadId:string){
 const t=await getThread(threadId);if(!t)throw new MarketError(404,'thread_not_found');return {thread:t,messages:await messagesOf(t.id)};
}
export async function teamList(){
 const ids=((await kvRaw(['SMEMBERS','thr:all'])) as string[]|null)??[];const out:Thread[]=[];
 for(const id of ids){const t=await getThread(id);if(t)out.push(t);}
 return out.sort((a,b)=>b.updated-a.updated).slice(0,100);
}
export async function providerView(threadId:string){
 const t=await getThread(threadId);if(!t)throw new MarketError(404,'thread_not_found');
 return {thread:{id:t.id,title:t.title,provider:t.provider_name,status:t.status},messages:(await messagesOf(t.id)).filter(m=>m.state!=='held').map(m=>({from:m.from,name:m.from==='buyer'?'Buyer':m.name,body:m.body,at:m.at}))};
}
