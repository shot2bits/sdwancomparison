import { bestFor } from "./shortlist-entity";
import { buildShortlist, type ShortlistVendor } from './shortlist-core';
import { publicEvidenceOutput } from './public-provider-evidence';
/** Public read-only evidence matching. Identity is required only for disclosure actions. */
export function publicShortlistPreview(vendors: ShortlistVendor[], input: unknown, featureNames: Record<string, string> = {}) {
  const result = buildShortlist(vendors, {...(input && typeof input === 'object' ? input : {}),shortlist_size:30}, featureNames);
  return publicEvidenceOutput({requires_publication:false,considered_count:result.considered,eligible_count:result.considered-result.excluded,
    criteria_summary:result.criteria_summary,input:result.input,
    matches:[...result.shortlist].sort((a,b)=>(vendors.find(v=>v.slug===b.slug)?.evidence_coverage_pct??0)-(vendors.find(v=>v.slug===a.slug)?.evidence_coverage_pct??0)||a.name.localeCompare(b.name)).map(v=>{const source=vendors.find(item=>item.slug===v.slug); return {...v,...(source ? bestFor(source) : {}),sector_status:result.input.sector ? source?.sectors[result.input.sector] ?? 'not_confirmed' : null,qualification_summary:source?.projection_provenance?.active_review?.qualification?.split(/(?<=[.!?])\s/)[0] ?? null,label:'Evidence match',sector_evidence:result.input.sector ? source?.sectors[result.input.sector] ?? 'unknown' : null,uk_sector_evidence:result.input.sector ? source?.projection_provenance?.active_review?.uk_sector_evidence?.[result.input.sector] ?? false : null,qualification:source?.projection_provenance?.active_review?.qualification ?? null,review_resolution:source?.projection_provenance?.resolution ?? null};}),
    next_step:'Ask Netify to prepare a sourcing plan. Review the anonymous brief and approve named recipients before any supplier receives a request.',
    methodology_note:'An evidence match meets the engine hard requirements in the current dataset. It is not a supplier-confirmed suitability assessment.'});
}
