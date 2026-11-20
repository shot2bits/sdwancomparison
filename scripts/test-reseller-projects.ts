import assert from 'node:assert/strict';
import {changePartnerPortfolio,emptyPartnerPortfolio,partnerCanAccess,partnerPortfolioView,type PartnerPrincipal,type ProjectMembership} from '../src/lib/reseller-projects';
const now=Date.parse('2026-11-12T12:00:00Z'),at=new Date(now).toISOString();
const partner:PartnerPrincipal={id:'user-a',organisationId:'msp-a',environment:'test',verified:true,role:'partner'};
const other={...partner,id:'user-b',organisationId:'msp-b'};
let p=changePartnerPortfolio(emptyPartnerPortfolio(),{action:'customer',baseRevision:0,id:'customer-a',at,name:'Buyer A'},partner);
p=changePartnerPortfolio(p,{action:'opportunity',baseRevision:1,id:'opportunity-a',at,customerId:'customer-a',projectId:'project-a',buyerOrgId:'buyer-a',name:'Estate review',source:'sase_reselling'},partner);
assert.equal(p.opportunities[0].attribution.status,'recorded_not_registered');assert.equal(p.opportunities[0].dealRegistration,'not_agreed');
assert.throws(()=>changePartnerPortfolio(p,{action:'opportunity',baseRevision:2,id:'opportunity-b',at,customerId:'customer-a',projectId:'project-b',buyerOrgId:'buyer-a',name:'Stolen customer',source:'programme'},other),/Customer not found/);
const approval={action:'authority',baseRevision:2,id:'approval-a',at,authorityId:'opportunity-a-authority',status:'approved',evidenceRef:'customer approval reference',expiresAt:new Date(now+86400000).toISOString(),permissions:['edit_scope','read_proposals','prepare_pricing'],disclosedFields:['estate','requirements']};
assert.throws(()=>changePartnerPortfolio(p,approval,partner),/Only the verified customer/);
assert.throws(()=>changePartnerPortfolio(p,approval,{...partner,role:'customer_reviewer',organisationId:'buyer-b'}),/Only the verified customer/);
const buyer={...partner,id:'customer-representative',role:'customer_reviewer' as const,organisationId:'buyer-a'};
let memberships:ProjectMembership[]=[{projectId:'project-a',organisationId:'msp-a',role:'partner',active:true}];
const access=(resource:Parameters<typeof partnerCanAccess>[0]['resource'],projectId='project-a',principal=partner)=>partnerCanAccess({portfolio:p,actor:principal,projectId,memberships,resource,now});
assert.equal(access('scope'),false);p=changePartnerPortfolio(p,approval,buyer);assert.equal(access('scope'),true);const limited=structuredClone(p);limited.authorities[0].disclosedFields=[];assert.equal(partnerCanAccess({portfolio:limited,actor:partner,projectId:'project-a',memberships,resource:'scope',now}),false);assert.equal(access('proposal'),true);assert.equal(access('message_draft'),false);assert.equal(access('send'),false);assert.equal(access('private_rate_card'),false);assert.equal(access('competitor_proposal'),false);assert.equal(access('scope','project-other'),false);assert.equal(access('scope','project-a',other),false);assert.equal(access('scope','project-a',{...partner,verified:false}),false);assert.equal(access('scope','project-a',{...partner,environment:'live'}),false);
// An MSP can supply a different project without losing its legitimate customer role here.
memberships.push({projectId:'project-b',organisationId:'msp-a',role:'supplier',active:true});assert.equal(access('scope'),true);
// A bidder on this project cannot also inspect the buyer's private workspace.
memberships.push({projectId:'project-a',organisationId:'msp-a',role:'supplier',active:true});assert.equal(access('scope'),false);assert.equal(access('proposal'),false);memberships=memberships.filter(m=>m.role!=='supplier');
assert.equal(partnerCanAccess({portfolio:p,actor:partner,projectId:'project-a',memberships,resource:'scope',now:now+86400000}),false);
assert.throws(()=>changePartnerPortfolio(p,{...approval,id:'stale'},buyer),/Workspace changed/);
const projected=partnerPortfolioView(p,other);assert.equal(projected.customers.length,0);assert.equal(projected.opportunities.length,0);assert.equal(projected.authorities.length,0);assert.equal(projected.audit.length,0);assert.equal(projected.commercial.earnings,null);
const revoke={...approval,id:'revoke-a',baseRevision:3,status:'revoked',permissions:[],disclosedFields:[],expiresAt:null};p=changePartnerPortfolio(p,revoke,buyer);assert.equal(access('scope'),false);assert.equal(p.opportunities[0].attribution.recordedBy,'user-a');assert.equal(p.audit.length,4);
console.log('PASS reseller customer ownership, project-scoped roles, customer-only approval, granular permissions, expiry, revocation, bid conflict, environment isolation, immutable introduction and inactive commercial rights.');
