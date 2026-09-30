import { ShortlistInputSchema, describeCriteria, type ShortlistVendor } from "./shortlist-core";
import { PROVIDER_SUMMARY_COPY } from "./provider-summary-copy";
export const PUBLIC_EVIDENCE_CONTRACT = "public-provider-evidence/4.0.0";
export const PUBLIC_EVIDENCE_ORDER = "evidence_coverage_pct desc, provider name asc, slug asc";
export const PUBLIC_EVIDENCE_NOTICE = "All researched providers are ordered by evidence coverage, highest first, then name. Coverage is the proportion of capability fields carrying an evidence grade; it is not fit, quality or a recommendation. Commission does not affect this order. Research and evidence matching are open.";
export const provenEvidenceCount = (vendor: ShortlistVendor) => Object.values(vendor.capabilities).filter(status => status === "yes").length;
const textOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function orderPublicEvidence(vendors: ShortlistVendor[]) {
  return [...vendors].sort((a,b) => b.evidence_coverage_pct-a.evidence_coverage_pct || textOrder(a.name.toLowerCase(),b.name.toLowerCase()) || textOrder(a.slug,b.slug));
}
/** Public status vocabulary preserves uncertainty without publishing the legacy unknown token.
 * Strip scoring outputs defensively, including unexpected imported fields. Source grades stay intact. */
export function publicEvidenceOutput<T>(value: T): T {
  if (value === "unknown") return "not_confirmed" as T;
  if (Array.isArray(value)) return value.map(publicEvidenceOutput) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(rank|score|ranking|fit_score|match_percentage|match_pct|balanced_setting_score|default_shortlist|top_providers_at_balanced_setting)$/.test(key)).map(([key,child]) => [key,publicEvidenceOutput(child)])) as T;
}
export function publicEvidenceProviders(vendors: ShortlistVendor[]) {
  return orderPublicEvidence(vendors).map((v,index) => {
    const copy = PROVIDER_SUMMARY_COPY[v.slug];
    return publicEvidenceOutput({...v, ...(copy ? {
      shortlist_summary: copy.summary, key_differentiators: [copy.summary], best_fit_for: [copy.buyerContext],
      summary_source: copy.source,
    } : {}), position:index+1, proven_evidence_count:provenEvidenceCount(v)});
  });
}
export function publicProviderEvidence(vendors: ShortlistVendor[], input: unknown = {}) {
  const parsed = ShortlistInputSchema.safeParse(input);
  const criteria = parsed.success ? parsed.data : ShortlistInputSchema.parse({});
  return { contract_version: PUBLIC_EVIDENCE_CONTRACT, requires_publication: false, ordered_by: PUBLIC_EVIDENCE_ORDER,
    input: criteria, criteria_summary: describeCriteria(criteria, {}),
    shortlist: publicEvidenceProviders(vendors).map(v => ({...v,gaps:[] as string[]})), methodology_note: PUBLIC_EVIDENCE_NOTICE };
}
