/** Interpret legacy imports without rewriting the underlying claim or its date. */
export const EVIDENCE_NORMALIZATION_VERSION='provider-evidence-normalization/2026-11-09.1';
export type EvidenceRow={support_state?:string;suitability_state?:string;freshness_state?:string;qualification?:string|null;confidence?:string;evidence_source_ids?:string[];[key:string]:unknown};
const gap=/not assessed|no (?:specific )?(?:case stud(?:y|ies)|evidence)|evidence gap|insufficient evidence|none found|not (?:independently )?confirmed|not researched/i;
const explicitNegative=/explicitly (?:not supported|unsupported)|(?:does not|cannot|can not|not available|not offered|unsupported)\b/i;
export function evidenceState(row:EvidenceRow):string{
  const original=row.support_state??row.suitability_state??'unknown';
  // Absence of a reference is not a documented inability to deliver.
  if(original==='not_supported'&&gap.test(row.qualification??'')&&!explicitNegative.test(row.qualification??''))return 'requires_confirmation';
  return original;
}
export function normalizeEvidenceRow<T extends EvidenceRow>(row:T):T{
  const original=row.support_state??row.suitability_state;
  const normalized=evidenceState(row);
  if(original===normalized)return {...row};
  return {...row,...(row.support_state!==undefined?{support_state:normalized}:{suitability_state:normalized}),normalization:{version:EVIDENCE_NORMALIZATION_VERSION,original_state:original,reason:'Legacy negative grade describes a research gap; no positive capability is inferred.'}};
}
export function normalizedProviderSections<T extends {capabilities:EvidenceRow[];sector_evidence:EvidenceRow[]}>(record:T):T{
  return {...record,capabilities:record.capabilities.map(normalizeEvidenceRow),sector_evidence:record.sector_evidence.map(normalizeEvidenceRow)};
}
