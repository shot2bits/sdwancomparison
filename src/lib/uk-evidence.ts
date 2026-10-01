import type {ShortlistVendor} from './shortlist-core';
/** Entity existence, regional evidence and a buyer's actual contract are distinct. */
export type UKEvidence = {
 entity:{status:'evidenced'|'not_researched'|'not_evidenced'|'expired';name:string|null;source_urls:string[];checked_at:string|null;review_due:string|null;qualification:string};
 regional_delivery:{status:string;scope:string};
 buyer_contract:{status:'requires_supplier_confirmation';qualification:string};
};
export const CATO_UK_ENTITY = {
 name:'Cato Networks (UK) Limited',source_urls:['https://www.catonetworks.com/msa/'],
 checked_at:'2026-10-01T00:00:00Z',review_due:'2026-12-30T00:00:00Z',
 qualification:'The Cato Master Service Agreement, section 1.4, lists this UK contracting party. The entity identified in the buyer’s order determines the actual counterparty; this does not establish site coverage or managed-service scope.',
};
export function applyUKEvidence(v:ShortlistVendor,now=Date.now()) {
 const cato=v.slug==='cato-networks';
 const active=cato && now>=Date.parse(CATO_UK_ENTITY.checked_at) && now<Date.parse(CATO_UK_ENTITY.review_due);
 if(cato){v.uk_delivery=active?'uk_entity':'not_confirmed';v.uk_basis=active?CATO_UK_ENTITY.qualification:'UK entity evidence requires review.';}
 const known=['uk_hq','uk_entity'].includes(v.uk_delivery);
 const review=v.projection_provenance?.active_review;
 v.uk_evidence={
  entity:{status:active||known?'evidenced':cato&&now>=Date.parse(CATO_UK_ENTITY.review_due)?'expired':'not_researched',name:active?CATO_UK_ENTITY.name:null,source_urls:active?CATO_UK_ENTITY.source_urls:known?review?.source_urls??[]:[],checked_at:active?CATO_UK_ENTITY.checked_at:known?review?.reviewed_at??null:null,review_due:active?CATO_UK_ENTITY.review_due:known?review?.review_due??null:null,qualification:v.uk_basis},
  regional_delivery:{status:v.regions.uk_ireland,scope:'Published UK and Ireland regional evidence. Confirm delivery to each UK site separately; this is not contracting-entity evidence.'},
  buyer_contract:{status:'requires_supplier_confirmation',qualification:'Confirm the legal counterparty, delivery partner, operator and support responsibilities in the proposal and order.'},
 };
}
