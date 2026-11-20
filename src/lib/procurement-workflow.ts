import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {PricingWorkflow,type PricingActor} from './pricing-workflow';
import {pricingHash,scopeHash,compareQuotation} from './priced-scope';
import {type PricingWorkflowState} from './pricing-workflow-store';
import {emptyProcurement,assertSupplierEligibility,partnerPermission,registerOperation,publicProcurementEvidence,TEST_MAIL_DESTINATION,OrganisationSchema,SupplierParticipationSchema,PartnerRegistrationSchema,PartnerAuthoritySchema,OpportunitySchema,CommissionAgreementSchema,CommissionEntrySchema,ProcurementEvidenceSchema,type ProcurementFoundation} from './procurement-foundation';
const id=z.string().min(1).max(160);
export const ProcurementCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('organisation'),key:id,organisation:OrganisationSchema,buyerOrganisation:z.boolean()}).strict(),
 z.object({action:z.literal('supplier'),key:id,participation:SupplierParticipationSchema}).strict(),
 z.object({action:z.literal('partner'),key:id,registration:PartnerRegistrationSchema}).strict(),
 z.object({action:z.literal('partner_authority'),key:id,authority:PartnerAuthoritySchema}).strict(),
 z.object({action:z.literal('opportunity'),key:id,opportunity:OpportunitySchema}).strict(),
 z.object({action:z.literal('opportunity_review'),key:id,opportunityId:id,decision:z.enum(['cleared','conflict']),ownerOrganisationId:id.nullable(),evidenceRef:z.string().min(1).max(20000)}).strict(),
 z.object({action:z.literal('commission_agreement'),key:id,agreement:CommissionAgreementSchema}).strict(),
 z.object({action:z.literal('commission_entry'),key:id,entry:CommissionEntrySchema}).strict(),
 z.object({action:z.literal('evidence'),key:id,evidence:ProcurementEvidenceSchema}).strict(),
]);
function foundation(p:PricingWorkflowState){return p.procurement??(p.procurement=emptyProcurement());}
function replaceBy<T>(rows:T[],value:T,match:(row:T)=>boolean){const i=rows.findIndex(match);if(i>=0)rows[i]=value;else rows.push(value);}
/** Extends the same priced project. No second map, RFP, financial model or tenant store. */
export class ProcurementWorkflow extends PricingWorkflow{
 protected override requestAuthorityHash(p:PricingWorkflowState,supplierIds:string[]){const f=foundation(p);return pricingHash(supplierIds.map(id=>assertSupplierEligibility(f,id,p.scopes.at(-1)!,this.now().getTime())));}
 private owner(p:PricingWorkflowState,actor:PricingActor,admin=false){this.authorize(p,actor,admin?'procurement:admin':'pricing:approve');if(actor.role!=='buyer'||!actor.verifiedWorkIdentity)throw Error('verified_project_owner_required');}
 private partnerOffers(p:PricingWorkflowState,actor:PricingActor){if(actor.role==='agent'&&p.procurement?.authorities.some(a=>a.subject===actor.subject)&&partnerPermission(p.procurement,actor.subject,'read_offers',this.now().getTime())!==true)throw Error('customer_offer_disclosure_required');}
 async govern(actor:PricingActor,raw:unknown){const command=ProcurementCommandSchema.parse(raw);return this.store.transaction(actor.projectId,p=>{
  if(!p)throw Error('pricing_project_not_found');this.owner(p,actor,command.action!=='partner_authority');const f=foundation(p);
  if(!registerOperation(f,command.key,command))return {state:p,result:this.envelope(p,'supplier_quotation',{recorded:true,replayed:true})};
  const now=this.now().getTime(),org=(orgId:string)=>{if(!f.organisations.some(o=>o.id===orgId))throw Error('organisation_record_required');};
  switch(command.action){
   case 'organisation':{
    const o=command.organisation;if(command.buyerOrganisation){if(!o.roles.includes('buyer')||f.buyerOrganisationId&&f.buyerOrganisationId!==o.id)throw Error('buyer_organisation_cannot_be_reassigned');f.buyerOrganisationId=o.id;}
    replaceBy(f.organisations,o,r=>r.id===o.id);break;
   }
   case 'supplier':{
    const s=command.participation;org(s.organisationId);if(s.environment!==p.environment)throw Error('participation_environment_mismatch');if(s.status==='confirmed'&&(!s.verifiedAt||Date.parse(s.verifiedAt)>now||!s.verifiedBy||!s.evidenceRef||!s.reviewAt||Date.parse(s.reviewAt)<=now||!s.commercialAgreementRef))throw Error('participation_confirmation_evidence_required');
    replaceBy(f.suppliers,s,r=>r.supplierId===s.supplierId);break;
   }
   case 'partner':{
    const r=command.registration;org(r.organisationId);if(r.status==='approved'&&(!r.reviewedBy||!r.reviewedAt||Date.parse(r.reviewedAt)>now||!r.evidenceRef))throw Error('partner_review_required');
    replaceBy(f.partners,r,v=>v.organisationId===r.organisationId&&v.role===r.role);break;
   }
   case 'partner_authority':{
    const a=command.authority;org(a.organisationId);if(a.customerOrganisationId!==f.buyerOrganisationId||!f.buyerOrganisationId)throw Error('customer_organisation_mismatch');if(a.status==='approved'&&(a.approvedBy!==actor.subject||!a.evidenceRef||!a.expiresAt||Date.parse(a.expiresAt)<=now))throw Error('customer_authority_evidence_required');
    replaceBy(f.authorities,a,r=>r.subject===a.subject);if(!p.agentSubjects.includes(a.subject))p.agentSubjects.push(a.subject);break;
   }
   case 'opportunity':{
    const o=command.opportunity;org(o.organisationId);if(o.projectId!==p.projectId||o.customerOrganisationId!==f.buyerOrganisationId||o.review!=='review_required'||o.ownerOrganisationId||o.reviewedBy||o.reviewEvidence||Date.parse(o.registeredAt)>now||f.opportunities.some(r=>r.id===o.id))throw Error('opportunity_needs_review');
    // Same account/deal is flagged rather than silently awarding ownership.
    f.opportunities.push(o);break;
   }
   case 'opportunity_review':{
    const o=f.opportunities.find(o=>o.id===command.opportunityId);if(!o)throw Error('opportunity_not_found');if(command.ownerOrganisationId)org(command.ownerOrganisationId);
    if(command.decision==='cleared'&&(!command.ownerOrganisationId||f.opportunities.some(other=>other.id!==o.id&&other.review==='cleared'&&other.accountRef===o.accountRef&&other.dealKey===o.dealKey)))throw Error('duplicate_or_existing_account_review_required');
    Object.assign(o,{review:command.decision,ownerOrganisationId:command.ownerOrganisationId,reviewedBy:actor.subject,reviewEvidence:command.evidenceRef});break;
   }
   case 'commission_agreement':{
    const a=command.agreement;org(a.partnerOrganisationId);if(f.agreements.some(r=>r.id===a.id))throw Error('agreement_is_append_only');if(!f.suppliers.some(s=>s.supplierId===a.supplierId))throw Error('supplier_record_required');f.agreements.push(a);break;
   }
   case 'commission_entry':{
    const e=command.entry,a=f.agreements.find(a=>a.id===e.agreementId),o=f.opportunities.find(o=>o.id===e.opportunityId);if(!a||!o||o.review!=='cleared'||o.ownerOrganisationId!==a.partnerOrganisationId||Date.parse(e.at)<Date.parse(a.validFrom)||Date.parse(e.at)>Date.parse(a.validUntil)||Date.parse(e.at)>now||e.recordedBy!==actor.subject||f.commission.some(r=>r.id===e.id))throw Error('agreed_commission_basis_required');
    const lines=f.commission.filter(r=>r.agreementId===e.agreementId&&r.opportunityId===e.opportunityId);if(lines.some(r=>r.currency!==e.currency))throw Error('commission_currency_mismatch');const total=(kind:string)=>lines.filter(l=>l.kind===kind).reduce((n,l)=>n+BigInt(l.amountMinor),BigInt(0)),amount=BigInt(e.amountMinor);
    if(e.kind==='collected'&&total('collected')+amount>total('accrued')-total('cancelled')-total('deducted')||e.kind==='paid'&&total('paid')+amount>total('collected')||['deducted','cancelled'].includes(e.kind)&&total('deducted')+total('cancelled')+amount>total('accrued')-total('collected'))throw Error('commission_entry_exceeds_evidenced_balance');
    f.commission.push(e);break;
   }
   case 'evidence':{
    const e=command.evidence;org(e.responsibleOrganisationId);if(e.environment!==p.environment||e.projectId!==p.projectId||!p.scopes.some(s=>scopeHash(s)===e.scopeHash)||Date.parse(e.observedAt)>now||Date.parse(e.reviewAt)<=Date.parse(e.observedAt)||f.evidence.some(r=>r.id===e.id))throw Error('evidence_provenance_invalid');
    if(e.environment==='test'&&(e.kind==='supplier_confirmation'||e.publication.status==='approved'))throw Error('test_activity_cannot_be_supplier_confirmed_or_published');
    if(e.kind==='supplier_confirmation'&&(!e.supplierId||!f.suppliers.some(s=>s.supplierId===e.supplierId&&s.organisationId===e.responsibleOrganisationId&&s.status==='confirmed'&&s.environment==='live')))throw Error('supplier_confirmation_authority_required');
    if(e.publication.status==='approved'&&(!e.publication.approvedBy||!e.publication.approvedAt||Date.parse(e.publication.approvedAt)>now||!e.publication.permissionRef||e.confidentiality!=='public'))throw Error('publication_permission_required');
    f.evidence.push(e);break;
   }
  }
  f.changes.push({key:command.key,at:this.now().toISOString(),actor:actor.subject,payload:structuredClone(command)});this.audit(p,actor.subject,'procurement_'+command.action);return {state:p,result:this.envelope(p,'supplier_quotation',{recorded:true,replayed:false})};
 });}
 async procurementStatus(actor:PricingActor){const p=await this.project(actor);this.partnerOffers(p,actor);const f=foundation(p);return this.envelope(p,'supplier_quotation',{procurementContract:f.contract,buyerOrganisationId:f.buyerOrganisationId,participation:f.suppliers.map(s=>({supplierId:s.supplierId,status:s.status,environment:s.environment,services:s.services,territories:s.territories,reviewAt:s.reviewAt,actions:s.actions})),unansweredRequirements:p.scopes.at(-1)!.lines.map(l=>l.id),handoffs:f.handoffs.map(h=>({...h,requiresFreshReview:h.scopeHash!==scopeHash(p.scopes.at(-1)!)})),notice:'Local test records only. No supplier participation is asserted for the live marketplace.'});}
 async qualify(actor:PricingActor,supplierId:string){const p=await this.project(actor),f=foundation(p);try{const s=assertSupplierEligibility(f,supplierId,p.scopes.at(-1)!,this.now().getTime());return this.envelope(p,'supplier_quotation',{supplierId,researchSuitability:'separate_research_evidence',participation:s.status,environment:'test',eligible:s.status==='confirmed',testRequestAvailable:true,actualDestination:TEST_MAIL_DESTINATION,permissions:s.actions,outstandingChecks:['Real marketplace participation and commercial authority remain to be agreed.']});}catch(error){return this.envelope(p,'supplier_quotation',{supplierId,researchSuitability:'separate_research_evidence',participation:f.suppliers.find(s=>s.supplierId===supplierId)?.status??'research_only',eligible:false,testRequestAvailable:false,outstandingChecks:[error instanceof Error?error.message:'participation_review_required']});}}
 override async prepare(actor:PricingActor,supplierIds:string[],supersedes:string|null=null){const p=await this.project(actor,'pricing:prepare');for(const supplierId of supplierIds)assertSupplierEligibility(foundation(p),supplierId,p.scopes.at(-1)!,this.now().getTime());return super.prepare(actor,supplierIds,supersedes);}
 override async approve(actor:PricingActor,requestId:string,hash:string){const p=await this.project(actor,'pricing:approve'),r=p.requests.find(r=>r.request.id===requestId);if(!r)throw Error('request_not_found');for(const recipient of r.request.recipients)assertSupplierEligibility(foundation(p),recipient.supplierId,r.request.scope,this.now().getTime());return super.approve(actor,requestId,hash);}
 override async send(actor:PricingActor,requestId:string,approvalId:string){const p=await this.project(actor,'pricing:send'),r=p.requests.find(r=>r.request.id===requestId);if(!r)throw Error('request_not_found');for(const recipient of r.request.recipients)assertSupplierEligibility(foundation(p),recipient.supplierId,r.request.scope,this.now().getTime());const result=await super.send(actor,requestId,approvalId);await this.store.transaction(actor.projectId,current=>{
  if(!current)throw Error('pricing_project_not_found');this.authorize(current,actor,'pricing:read');const f=foundation(current),row=current.requests.find(r=>r.request.id===requestId)!;
  for(const box of row.outbox.filter(b=>b.state==='delivered')){if(f.conversations.some(c=>c.messageId===box.key))continue;f.conversations.push({id:randomUUID(),requestId,supplierId:box.supplierId,intendedSupplierId:box.supplierId,channel:'email',direction:'outbound',environment:'test',actualSender:'not_configured',actualRecipients:[TEST_MAIL_DESTINATION],at:box.at!,status:'captured_not_sent',messageId:box.key,replyToMessageId:null,correlationHash:pricingHash({projectId:current.projectId,requestId,supplierId:box.supplierId,key:box.key}),body:JSON.stringify(row.request.scope),origin:'netify_test',netifyVerified:false});}
  this.audit(current,actor.subject,'test_conversations_recorded',requestId);return {state:current,result:true};
 });return result;}
 override async quotations(actor:PricingActor){const p=await this.project(actor);this.partnerOffers(p,actor);return super.quotations(actor);}
 override async compare(actor:PricingActor,requestId:string){const p=await this.project(actor);this.partnerOffers(p,actor);return super.compare(actor,requestId);}
 async recordInternalReply(actor:PricingActor,raw:unknown){const input=z.object({requestId:id,supplierId:id,messageId:id,replyToMessageId:id,body:z.string().min(1).max(200000)}).strict().parse(raw);return this.store.transaction(actor.projectId,p=>{
  if(!p)throw Error('pricing_project_not_found');this.owner(p,actor,true);const f=foundation(p),thread=f.conversations.find(c=>c.direction==='outbound'&&c.requestId===input.requestId&&c.supplierId===input.supplierId&&c.messageId===input.replyToMessageId&&c.status==='captured_not_sent');if(!thread)throw Error('reply_correlation_not_found');
  const hash=pricingHash(input),old=f.conversations.find(c=>c.direction==='inbound'&&c.messageId===input.messageId);if(old){if(old.correlationHash!==thread.correlationHash||pricingHash({requestId:old.requestId,supplierId:old.supplierId,messageId:old.messageId,replyToMessageId:old.replyToMessageId,body:old.body})!==hash)throw Error('reply_reference_conflict');return {state:p,result:this.envelope(p,'supplier_quotation',{received:true,replayed:true,origin:'internal_test_not_supplier_confirmation'})};}
  f.conversations.push({id:randomUUID(),...input,intendedSupplierId:input.supplierId,channel:'email',direction:'inbound',environment:'test',actualSender:TEST_MAIL_DESTINATION,actualRecipients:[TEST_MAIL_DESTINATION],at:this.now().toISOString(),status:'received_internal_test',correlationHash:thread.correlationHash,origin:'netify_test',netifyVerified:false});this.audit(p,actor.subject,'internal_test_reply_recorded',input.requestId,input.supplierId);return {state:p,result:this.envelope(p,'supplier_quotation',{received:true,replayed:false,origin:'internal_test_not_supplier_confirmation'})};
 });}
 async conversations(actor:PricingActor,supplierId?:string){const p=await this.project(actor);this.partnerOffers(p,actor);return this.envelope(p,'supplier_quotation',{conversations:foundation(p).conversations.filter(c=>!supplierId||c.supplierId===supplierId),channels:{email:'local_capture_only',teams:'connection_required',whatsapp:'connection_and_destination_consent_required'}});}
 async evidence(actor:PricingActor){const p=await this.project(actor);this.partnerOffers(p,actor);return this.envelope(p,'supplier_quotation',{evidence:foundation(p).evidence,publiclyEligible:publicProcurementEvidence(foundation(p).evidence,this.now().getTime()),notice:'Supplier confirmation is not independent verification. Location proximity is not availability.'});}
 async selectOffer(actor:PricingActor,raw:unknown){const input=z.object({requestId:id,quotationId:id,scopeHash:z.string(),scopeRevision:z.number().int().positive(),quotationHash:z.string()}).strict().parse(raw);return this.store.transaction(actor.projectId,p=>{
  if(!p)throw Error('pricing_project_not_found');this.owner(p,actor);const scope=p.scopes.at(-1)!,q=p.quotations.find(q=>q.requestId===input.requestId&&q.quotation.id===input.quotationId);if(!q||input.scopeHash!==scopeHash(scope)||input.scopeRevision!==scope.revision||input.quotationHash!==pricingHash(q.quotation))throw Error('fresh_exact_offer_review_required');
  const comparison=compareQuotation(scope,q.quotation,this.now());if(!comparison.complete)throw Error('offer_differences_need_resolution');const f=foundation(p),hash=pricingHash(input),old=f.handoffs.find(h=>h.selectionHash===hash);if(old)return {state:p,result:this.envelope(p,'supplier_quotation',{handoff:old,replayed:true})};
  const handoff={id:randomUUID(),requestId:input.requestId,quotationId:input.quotationId,scopeHash:input.scopeHash,scopeRevision:input.scopeRevision,preparedAt:this.now().toISOString(),preparedBy:actor.subject,selectionHash:hash,status:'selected_for_review_not_ordered' as const,bindingAcceptance:false as const,blockers:['Test offer only. No supplier commitment or live order.','Separate buyer purchasing approval required.','Supplier ordering authority and contractual terms not configured.','Fulfilment connection not configured.']};f.handoffs.push(handoff);this.audit(p,actor.subject,'offer_selected_for_non_binding_review',input.requestId,q.quotation.supplierId);return {state:p,result:this.envelope(p,'supplier_quotation',{handoff,replayed:false})};
 });}
 async previewHandoff(actor:PricingActor,requestId:string,quotationId:string){const p=await this.project(actor);this.partnerOffers(p,actor);const q=p.quotations.find(q=>q.requestId===requestId&&q.quotation.id===quotationId);if(!q)throw Error('offer_not_found');return this.envelope(p,'supplier_quotation',{requestId,quotation:q.quotation,quotationHash:pricingHash(q.quotation),comparison:compareQuotation(p.scopes.at(-1)!,q.quotation,this.now()),requiresSeparateBuyerSelection:true,bindingAcceptance:false,ordering:'authority_terms_and_delivery_connection_required'});}
 async programmeEligibility(actor:PricingActor){const p=await this.project(actor),f=foundation(p);return this.envelope(p,'supplier_quotation',{programme:'Netify Reseller Programme',roles:['referral_partner','customer_project_partner','supplying_partner'],registrationDoesNotGrantVendorResaleAuthority:true,requirements:['Verified organisation and programme approval','Customer authorisation per project','Supplier-specific commercial agreement for resale or commission'],partnerAuthorities:f.authorities.filter(a=>a.subject===actor.subject).map(a=>({organisationId:a.organisationId,status:a.status,permissions:a.permissions,expiresAt:a.expiresAt})),entrance:'Existing Buyer/Reseller switch retained. New entrance design awaits approval.'});}
 async commercialRecords(actor:PricingActor){const p=await this.project(actor);this.owner(p,actor,true);const f=foundation(p);return this.envelope(p,'supplier_quotation',{opportunities:f.opportunities,agreements:f.agreements,entries:f.commission,notice:'Amounts are recorded only against actual referenced agreements. No default BT split or computed earnings.'});}
 async measures(actor:PricingActor){const p=await this.project(actor);this.owner(p,actor,true);return this.envelope(p,'supplier_quotation',{qualifiedOpportunities:0,substantiveSupplierResponses:0,collectedCommission:[],originalPublicEvidence:0,excludedTestProjects:1,testActivity:p.audit.reduce<Record<string,number>>((totals,event)=>{const kind=event.actorKind??'not_classified';totals[kind]=(totals[kind]??0)+1;return totals;},{}),notice:'This adapter accepts test projects only. No fixture enters live metrics.',dependencies:['Live identity and event attribution','Operational effort time capture','Citations and agent-use instrumentation']});}
}
