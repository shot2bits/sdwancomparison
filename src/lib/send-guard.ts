/**
 * Abuse protection for anonymous sends (the Netify desk handoff and legacy
 * lead capture). One place for every limit: edit SEND_PROTECTION to change
 * them. Order of checks is deliberate:
 *   honeypot -> time on form -> contact email -> bot check -> rate limits
 * Cheap rejections run first, and the bot check runs before any counter is
 * touched so automated traffic cannot spend real buyers' quota.
 */
import {createHash} from 'node:crypto';
import {checkBotId} from 'botid/server';
import {kvConfigured,kvRaw} from './rfp-store';

export const SEND_PROTECTION={
 /** Fixed windows. Each IP is checked before the email and global counters, so one noisy IP cannot exhaust the global allowance. */
 limits:[
  {scope:'ip',windowSeconds:3600,max:3},
  {scope:'ip',windowSeconds:86400,max:10},
  {scope:'email',windowSeconds:86400,max:3},
  {scope:'global',windowSeconds:86400,max:50},
 ],
 /** A person reads the review before approving; scripts post instantly. */
 minFormMs:3000,
 /** Hosts that serve the marketplace page and may present a BotID challenge to this API (netify.co.uk proxies /marketplace/ here). */
 botAllowedHosts:['netify.co.uk','www.netify.co.uk'],
} as const;

export type SendChannel='desk'|'lead';
type Limit=(typeof SEND_PROTECTION.limits)[number];
export type BotVerdict='human'|'bot'|'unavailable';

export class SendGuardError extends Error{
 constructor(readonly status:number,readonly code:string,readonly userMessage:string,readonly retryAfterSeconds?:number){super(code);this.name='SendGuardError';}
}

/** Counter store: atomic increment with expiry. KV in deployments; memory only where KV is absent outside production. */
export type CounterStore={incr(key:string,ttlSeconds:number):Promise<number>};
const memory=new Map<string,{count:number;expires:number}>();
export const memoryCounterStore:CounterStore={async incr(key,ttl){const now=Date.now(),hit=memory.get(key);const next=hit&&hit.expires>now?{count:hit.count+1,expires:hit.expires}:{count:1,expires:now+ttl*1000};memory.set(key,next);return next.count;}};
export const kvCounterStore:CounterStore={async incr(key,ttl){const count=Number(await kvRaw(['INCR',key]));if(count===1)await kvRaw(['EXPIRE',key,ttl]);return count;}};
export function defaultCounterStore():CounterStore{
 if(kvConfigured())return kvCounterStore;
 if(process.env.VERCEL_ENV==='production')throw new SendGuardError(503,'send_protection_unavailable','Sending is briefly unavailable. Your project is saved. Please try again in a few minutes.');
 return memoryCounterStore;
}

/** Vercel BotID, checked server-side. BotID only classifies on Vercel; local development and local tests treat callers as human. */
export async function vercelBotCheck():Promise<BotVerdict>{
 if(!process.env.VERCEL)return 'human';
 try{const r=await checkBotId({advancedOptions:{checkLevel:'basic',extraAllowedHosts:[...SEND_PROTECTION.botAllowedHosts]}});return r.isBot?'bot':'human';}
 catch{return 'unavailable';}
}

/** Default dependencies. Tests swap `bot` to exercise the HTTP layer without Vercel. */
export const sendGuardRuntime:{bot:()=>Promise<BotVerdict>}={bot:vercelBotCheck};

const EMAIL=/^[-a-z0-9.!#$%&'*+/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;
/** Required, valid format. Not verified: the desk sees it marked unverified. */
export function contactEmail(value:unknown):string{
 const email=typeof value==='string'?value.trim().toLowerCase():'';
 if(!email||email.length>254||/[\r\n]/.test(email)||!EMAIL.test(email))throw new SendGuardError(422,'enter_contact_email','Enter a valid email address so the Netify desk can reply.');
 return email;
}

const hash=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,32);
function limitMessage(limit:Limit,retry:number){
 const wait=retry>=3600?'tomorrow':'in about '+Math.max(1,Math.ceil(retry/60))+' minutes';
 if(limit.scope==='global')return 'Netify has reached its daily limit for new requests during the beta. Your project is saved. Please try again '+wait+'.';
 if(limit.scope==='email')return 'This email address has sent '+limit.max+' requests today, the most allowed during the beta. Your project is saved. Please try again '+wait+'.';
 return 'Too many requests from your connection (up to '+limit.max+' per '+(limit.windowSeconds===3600?'hour':'day')+' during the beta). Your project is saved. Please try again '+wait+'.';
}

export async function enforceSendLimits(channel:SendChannel,ip:string,email:string,store:CounterStore=defaultCounterStore(),now=Date.now()){
 for(const limit of SEND_PROTECTION.limits){
  const bucket=Math.floor(now/1000/limit.windowSeconds),subject=limit.scope==='ip'?hash('ip:'+ip):limit.scope==='email'?hash('email:'+email):'all';
  const key='netify:send-limit:'+channel+':'+limit.scope+':'+limit.windowSeconds+':'+subject+':'+bucket;
  let count:number;try{count=await store.incr(key,limit.windowSeconds+60);}catch{throw new SendGuardError(503,'send_protection_unavailable','Sending is briefly unavailable. Your project is saved. Please try again in a few minutes.');}
  if(count>limit.max){const retry=Math.max(1,(bucket+1)*limit.windowSeconds-Math.floor(now/1000));throw new SendGuardError(429,'too_many_requests',limitMessage(limit,retry),retry);}
 }
}

export type GuardInput={channel:SendChannel;ip:string;email:unknown;honeypot:unknown;formElapsedMs:unknown};
export async function guardAnonymousSend(input:GuardInput,deps:{bot?:()=>Promise<BotVerdict>;store?:CounterStore;now?:number}={}){
 if(typeof input.honeypot==='string'?input.honeypot.trim()!=='':input.honeypot!==undefined&&input.honeypot!==null)throw new SendGuardError(400,'request_rejected','This request could not be sent. Please reload the page and try again.');
 const elapsed=Number(input.formElapsedMs);
 if(!Number.isFinite(elapsed)||elapsed<SEND_PROTECTION.minFormMs)throw new SendGuardError(400,'review_before_sending','Please read the review before sending, then try again.');
 const email=contactEmail(input.email);
 const verdict=await (deps.bot??sendGuardRuntime.bot)();
 if(verdict==='unavailable')throw new SendGuardError(503,'bot_check_unavailable','We could not confirm this request came from a browser. Please reload the page and try again.');
 if(verdict==='bot')throw new SendGuardError(403,'bot_check_failed','We could not confirm this request came from a browser. Please reload the page and try again.');
 await enforceSendLimits(input.channel,input.ip,email,deps.store??defaultCounterStore(),deps.now);
 return {email};
}
