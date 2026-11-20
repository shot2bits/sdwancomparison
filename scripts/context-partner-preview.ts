/** Loopback test adapter only. Test principals are server-created and cannot grant live rights. */
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {changePartnerPortfolio,emptyPartnerPortfolio,partnerPortfolioView,PartnerPortfolioSchema,partnerCanAccess,type PartnerPrincipal} from '../src/lib/reseller-projects';
const file=resolve('preview/context-space/.local/partner-portfolio.json');
const sessions=new Map<string,number>();
const operator:PartnerPrincipal={id:'local-test-partner',organisationId:'local-test-partner-org',environment:'test',verified:true,role:'partner'};
let queue:Promise<unknown>=Promise.resolve();
export function partnerPreviewCookie(){const token=randomBytes(32).toString('base64url');sessions.set(token,Date.now()+8*3600000);if(sessions.size>256)sessions.delete(sessions.keys().next().value!);for(const [key,expiry] of sessions)if(expiry<Date.now())sessions.delete(key);return 'netify_partner_preview='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800';}
function authenticate(cookie:string){const token=cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('netify_partner_preview='))?.split('=')[1];if(!token||!sessions.has(token)||sessions.get(token)!<=Date.now())throw Error('Open the local partner workspace to start a test session.');}
async function load(){try{return PartnerPortfolioSchema.parse(JSON.parse(await readFile(file,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return emptyPartnerPortfolio();throw Error('Saved partner records could not be validated. They have not been overwritten.');}}
export async function partnerPreviewAction(cookie:string,raw:unknown){
 authenticate(cookie);
 const operation=async()=>{
 const p=await load();const r=raw as Record<string,unknown>;
 if(!r||typeof r!=='object')throw Error('Invalid request.');
 if(r.action==='read')return partnerPortfolioView(p,operator);
 if(r.action==='access'){
 const projectId=String(r.projectId),op=p.opportunities.find(o=>o.projectId===projectId&&o.partnerOrgId===operator.organisationId);
 if(!op)throw Error('Project not found.');
 return {allowed:partnerCanAccess({portfolio:p,actor:operator,projectId,memberships:[{projectId,organisationId:operator.organisationId,role:'partner',active:true}],resource:'scope'}),environment:'test',projectId};
 }
 let command:unknown;
 let actor=operator;
 const shared={baseRevision:r.baseRevision,id:randomUUID(),at:new Date().toISOString()};
 if(r.action==='customer')command={...shared,action:'customer',name:r.name};
 else if(r.action==='opportunity')command={...shared,action:'opportunity',customerId:r.customerId,projectId:randomUUID(),name:r.name,source:r.source,buyerOrgId:'local-customer-'+String(r.customerId)};
 else if(r.action==='simulate_customer_approval'||r.action==='simulate_customer_revocation'){
  const a=p.authorities.find(a=>a.id===r.authorityId&&a.partnerOrgId===operator.organisationId);if(!a)throw Error('Authority not found.');
  actor={...operator,id:'local-simulated-customer',organisationId:a.buyerOrgId,role:'customer_reviewer'};
  command={...shared,action:'authority',authorityId:a.id,status:r.action==='simulate_customer_approval'?'approved':'revoked',evidenceRef:'LOCAL SIMULATION ONLY, not customer consent',expiresAt:r.action==='simulate_customer_approval'?new Date(Date.now()+86400000).toISOString():null,permissions:r.permissions??[],disclosedFields:r.disclosedFields??[]};
 }else throw Error('Unknown local partner operation.');
 const next=changePartnerPortfolio(p,command,actor);await mkdir(resolve(file,'..'),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(next,null,2),{mode:0o600});await rename(temp,file);return partnerPortfolioView(next,operator);
 };
 const task=queue.then(operation);queue=task.catch(()=>{});return task;
}
