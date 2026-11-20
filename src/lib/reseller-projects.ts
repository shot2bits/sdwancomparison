/** Shared marketplace extension. No duplicate estate, evidence, pricing or messaging engine. */
import {z} from 'zod';
const id=z.string().min(1).max(160);
const date=z.iso.datetime();
export const PARTNER_CONTRACT='netify-partner-projects/1.0.0' as const;
const Customer=z.object({id,partnerOrgId:id,name:z.string().trim().min(1).max(300),createdAt:date}).strict();
const Authority=z.object({id,customerId:id,projectId:id,partnerOrgId:id,buyerOrgId:id,status:z.enum(['pending','approved','revoked']),permissions:z.array(z.enum(['edit_scope','read_proposals','draft_messages','prepare_pricing'])),disclosedFields:z.array(z.enum(['estate','requirements','contacts'])),evidenceRef:z.string().max(1000).nullable(),approvedBy:id.nullable(),expiresAt:date.nullable()}).strict();
const Opportunity=z.object({id,customerId:id,projectId:id,partnerOrgId:id,name:z.string().trim().min(1).max(300),createdAt:date,attribution:z.object({introducedByOrgId:id,recordedBy:id,recordedAt:date,source:z.enum(['sase_reselling','sdwan_reselling','programme']),status:z.literal('recorded_not_registered')}).strict(),dealRegistration:z.literal('not_agreed')}).strict();
const Audit=z.object({id,at:date,actor:id,action:z.string(),ref:id}).strict();
export const PartnerPortfolioSchema=z.object({contract:z.literal(PARTNER_CONTRACT),environment:z.enum(['test','live']),revision:z.number().int().nonnegative(),customers:z.array(Customer),opportunities:z.array(Opportunity),authorities:z.array(Authority),audit:z.array(Audit)}).strict();
export type PartnerPortfolio=z.infer<typeof PartnerPortfolioSchema>;
export type PartnerPrincipal={id:string;organisationId:string;environment:'test'|'live';verified:boolean;role:'partner'|'customer_reviewer'};
export function emptyPartnerPortfolio(environment:'test'|'live'='test'):PartnerPortfolio{return {contract:PARTNER_CONTRACT,environment,revision:0,customers:[],opportunities:[],authorities:[],audit:[]};}
const base={baseRevision:z.number().int().nonnegative(),id,at:date};
export const PartnerCommandSchema=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('customer'),name:z.string().trim().min(1).max(300)}).strict(),
 z.object({...base,action:z.literal('opportunity'),customerId:id,projectId:id,name:z.string().trim().min(1).max(300),source:z.enum(['sase_reselling','sdwan_reselling','programme']),buyerOrgId:id}).strict(),
 z.object({...base,action:z.literal('authority'),authorityId:id,status:z.enum(['approved','revoked']),evidenceRef:z.string().trim().min(1).max(1000),expiresAt:date.nullable(),permissions:Authority.shape.permissions,disclosedFields:Authority.shape.disclosedFields}).strict(),
]);
export function changePartnerPortfolio(raw:unknown,command:unknown,actor:PartnerPrincipal){
 const p=PartnerPortfolioSchema.parse(raw),c=PartnerCommandSchema.parse(command);
 if(!actor.verified||actor.environment!==p.environment)throw Error('Verified identity in this environment required.');
 if(c.baseRevision!==p.revision)throw Error('Workspace changed. Reload before saving.');
 if(p.audit.some(a=>a.id===c.id))throw Error('Operation reference already used.');
 const next=structuredClone(p);
 if(c.action==='customer'){
  if(actor.role!=='partner')throw Error('Partner membership required.');
  if(next.customers.some(x=>x.id===c.id))throw Error('Customer reference already exists.');
  next.customers.push({id:c.id,partnerOrgId:actor.organisationId,name:c.name,createdAt:c.at});
 }else if(c.action==='opportunity'){
  if(actor.role!=='partner'||!p.customers.some(x=>x.id===c.customerId&&x.partnerOrgId===actor.organisationId))throw Error('Customer not found.');
  if(next.opportunities.some(x=>x.projectId===c.projectId))throw Error('This project already has an attribution record.');
  if(c.buyerOrgId===actor.organisationId)throw Error('A customer project needs a separate buyer organisation.');
  next.opportunities.push({id:c.id,customerId:c.customerId,projectId:c.projectId,partnerOrgId:actor.organisationId,name:c.name,createdAt:c.at,attribution:{introducedByOrgId:actor.organisationId,recordedBy:actor.id,recordedAt:c.at,source:c.source,status:'recorded_not_registered'},dealRegistration:'not_agreed'});
  next.authorities.push({id:c.id+'-authority',customerId:c.customerId,projectId:c.projectId,partnerOrgId:actor.organisationId,buyerOrgId:c.buyerOrgId,status:'pending',permissions:[],disclosedFields:[],evidenceRef:null,approvedBy:null,expiresAt:null});
 }else{
  const authority=next.authorities.find(x=>x.id===c.authorityId);
  if(!authority||actor.role!=='customer_reviewer'||actor.organisationId!==authority.buyerOrgId)throw Error('Only the verified customer can authorise its partner.');
  if(c.status==='approved'&&(!c.expiresAt||Date.parse(c.expiresAt)<=Date.parse(c.at)))throw Error('Approval needs a future expiry date.');
  Object.assign(authority,{status:c.status,evidenceRef:c.evidenceRef,approvedBy:actor.id,expiresAt:c.expiresAt,permissions:c.status==='approved'?c.permissions:[],disclosedFields:c.status==='approved'?c.disclosedFields:[]});
 }
 next.revision++;next.audit.push({id:c.id,at:c.at,actor:actor.id,action:c.action,ref:c.action==='authority'?c.authorityId:c.id});
 return PartnerPortfolioSchema.parse(next);
}
export type ProjectMembership={projectId:string;organisationId:string;role:'buyer'|'partner'|'supplier';active:boolean};
/** Authenticated membership comes from server storage, never a requested UI mode. */
export function partnerCanAccess(input:{portfolio:PartnerPortfolio;actor:PartnerPrincipal;projectId:string;memberships:ProjectMembership[];resource:'scope'|'proposal'|'message_draft'|'pricing_preview'|'send'|'competitor_proposal'|'private_rate_card';now?:number}){
 const {portfolio:p,actor,projectId,resource,memberships}=input;
 if(!actor.verified||actor.environment!==p.environment||actor.role!=='partner')return false;
 if(['send','competitor_proposal','private_rate_card'].includes(resource))return false;
 const roles=memberships.filter(m=>m.active&&m.projectId===projectId&&m.organisationId===actor.organisationId).map(m=>m.role);
 if(!roles.includes('partner')||roles.includes('supplier'))return false;
 const grant=p.authorities.find(a=>a.projectId===projectId&&a.partnerOrgId===actor.organisationId&&a.status==='approved');
 if(!grant?.approvedBy||!grant.evidenceRef||!grant.expiresAt||Date.parse(grant.expiresAt)<=(input.now??Date.now()))return false;
 if(['scope','pricing_preview'].includes(resource)&&!['estate','requirements'].every(field=>grant.disclosedFields.includes(field as 'estate'|'requirements')))return false;
 const needed={scope:'edit_scope',proposal:'read_proposals',message_draft:'draft_messages',pricing_preview:'prepare_pricing'}[resource as 'scope'|'proposal'|'message_draft'|'pricing_preview'];
 return !!needed&&grant.permissions.includes(needed as typeof grant.permissions[number]);
}
export function partnerPortfolioView(raw:unknown,actor:PartnerPrincipal){
 const p=PartnerPortfolioSchema.parse(raw);if(!actor.verified||actor.environment!==p.environment||actor.role!=='partner')throw Error('Partner membership required.');
 const owns=(org:string)=>org===actor.organisationId;
 const opportunities=p.opportunities.filter(o=>owns(o.partnerOrgId));
 return {...p,customers:p.customers.filter(c=>owns(c.partnerOrgId)),opportunities,authorities:p.authorities.filter(a=>owns(a.partnerOrgId)),audit:p.audit.filter(a=>opportunities.some(o=>o.id===a.ref)||p.customers.some(c=>c.id===a.ref&&owns(c.partnerOrgId))||p.authorities.some(x=>x.id===a.ref&&owns(x.partnerOrgId))),commercial:{status:'not_agreed' as const,earnings:null,commissionAgreements:[],statements:[],payments:[],notice:'No supplier reselling authority, commission rate, deal protection or earnings is granted by programme access.'}};
}
