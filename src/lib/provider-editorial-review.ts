import { createHash } from 'node:crypto';
import reviews from '../../data/provider-editorial-reviews.json';
import type { ShortlistVendor } from './shortlist-core';
export type ProviderEditorialReview = {
  buyer_fit:string; strengths:string[]; trade_offs:string[]; source_urls:string[];
  reviewer:string; role:string; approved_at:string; review_due:string;
  evidence_fingerprint:string;
};
/** Approval applies to this evidence state, not to future revisions of a provider. */
export function providerEvidenceFingerprint(v:ShortlistVendor) {
  const ordered=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify({date:v.last_verified,capabilities:ordered(v.capabilities),capability_evidence:ordered(v.capability_evidence ?? {}),sectors:ordered(v.sectors),regions:ordered(v.regions),uk:v.uk_delivery,uk_evidence:v.uk_evidence??null,provenance:v.projection_provenance ?? null})).digest('hex');
}
function validatedEditorialReview(v:ShortlistVendor, record:ProviderEditorialReview|undefined=(reviews as Record<string,ProviderEditorialReview>)[v.slug], now=Date.now()):ProviderEditorialReview|null {
  if(!record || !['buyer_fit','reviewer','role','approved_at','review_due','evidence_fingerprint'].every(key=>typeof record[key as keyof ProviderEditorialReview] === 'string') || ![record.strengths,record.trade_offs,record.source_urls].every(value=>Array.isArray(value) && value.every(item=>typeof item === 'string')))return null;
  if(!record.buyer_fit.trim() || !record.reviewer.trim() || !record.role.trim() || !record.strengths.length || !record.trade_offs.length || !record.source_urls.length) return null;
  const approved=Date.parse(record.approved_at),due=Date.parse(record.review_due);
  if(!Number.isFinite(approved)||!Number.isFinite(due)||approved>now||due<=now||due<=approved) return null;
  if(record.evidence_fingerprint!==providerEvidenceFingerprint(v))return null;
  if(![...record.strengths,...record.trade_offs].every(s=>s.trim()) || !record.source_urls.every(s=>{try{return ['https:','http:'].includes(new URL(s).protocol)}catch{return false}}))return null;
  return record;
}

export function editorialReviewStatus(v:ShortlistVendor, record:ProviderEditorialReview|undefined=(reviews as Record<string,ProviderEditorialReview>)[v.slug],now=Date.now()) {
  if(!record)return {status:'missing' as const,reason:'No approved assessment has been supplied.'};
  if(Number.isFinite(Date.parse(record.review_due)) && Date.parse(record.review_due)<=now)return {status:'expired' as const,reason:`Assessment expired ${record.review_due}`};
  if(record.evidence_fingerprint && record.evidence_fingerprint!==providerEvidenceFingerprint(v))return {status:'invalidated' as const,reason:'Provider evidence changed after approval.',approved_fingerprint:record.evidence_fingerprint,current_fingerprint:providerEvidenceFingerprint(v)};
  if(!validatedEditorialReview(v,record,now))return {status:'invalid' as const,reason:'Approval, dates, source URLs or required assessment fields are invalid.'};
  return {status:'approved' as const,reason:'Approval matches the current evidence.',review_due:record.review_due};
}
export function approvedEditorialReview(v:ShortlistVendor, record:ProviderEditorialReview|undefined=(reviews as Record<string,ProviderEditorialReview>)[v.slug],now=Date.now()):ProviderEditorialReview|null {
  const state=editorialReviewStatus(v,record,now);
  if(state.status==='invalidated'||state.status==='expired'||state.status==='invalid') console.error('Provider assessment withheld',v.slug,state);
  return state.status==='approved' ? record! : null;
}
