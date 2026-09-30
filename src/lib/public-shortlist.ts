import { buildShortlist, type ShortlistVendor } from './shortlist-core';
import { publicEvidenceOutput } from './public-provider-evidence';
/** Public read-only evidence matching. Identity is required only for disclosure actions. */
export function publicShortlistPreview(vendors: ShortlistVendor[], input: unknown, featureNames: Record<string, string> = {}) {
  const result = buildShortlist(vendors, {...(input && typeof input === 'object' ? input : {}),shortlist_size:30}, featureNames);
  return publicEvidenceOutput({requires_publication:false,considered_count:result.considered,eligible_count:result.considered-result.excluded,
    criteria_summary:result.criteria_summary,input:result.input,
    matches:[...result.shortlist].sort((a,b)=>(vendors.find(v=>v.slug===b.slug)?.evidence_coverage_pct??0)-(vendors.find(v=>v.slug===a.slug)?.evidence_coverage_pct??0)||a.name.localeCompare(b.name)).map(v=>({...v,label:'Evidence match'})),
    next_step:'Ask Netify to prepare a sourcing plan. Review the anonymous brief and approve named recipients before any supplier receives a request.',
    methodology_note:'An evidence match meets the engine hard requirements in the current dataset. It is not a supplier-confirmed suitability assessment.'});
}
