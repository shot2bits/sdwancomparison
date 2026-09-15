import { ShortlistInputSchema, describeCriteria, type ShortlistVendor } from "./shortlist-core";
import { PROVIDER_SUMMARY_COPY } from "./provider-summary-copy";
export const PUBLIC_EVIDENCE_CONTRACT = "public-provider-evidence/3.0.0";
export const PUBLIC_EVIDENCE_ORDER = "proven_evidence_count desc, last_verified desc (missing last), provider name asc, slug asc";
export const PUBLIC_EVIDENCE_NOTICE = "Evidence order: most proven capability items first, then most recent verification date, then provider name (slug breaks identical names). Only published capability grades of yes count; partial, partner-delivered and unconfirmed items do not. Missing dates come last. Positions are evidence order, not recommendations. Computed fit and scoring-model rankings require authorised access after verified project publication.";
export const provenEvidenceCount = (vendor: ShortlistVendor) => Object.values(vendor.capabilities).filter(status => status === "yes").length;
const textOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const dateValue = (date: string) => Number.isFinite(Date.parse(date)) ? Date.parse(date) : -Infinity;
export function orderPublicEvidence(vendors: ShortlistVendor[]) {
  return [...vendors].sort((a,b) => provenEvidenceCount(b)-provenEvidenceCount(a) || (dateValue(b.last_verified) === dateValue(a.last_verified) ? 0 : dateValue(b.last_verified)>dateValue(a.last_verified) ? 1 : -1) || textOrder(a.name.toLowerCase(),b.name.toLowerCase()) || textOrder(a.slug,b.slug));
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
  return { contract_version: PUBLIC_EVIDENCE_CONTRACT, requires_publication: true, ordered_by: PUBLIC_EVIDENCE_ORDER,
    input: criteria, criteria_summary: describeCriteria(criteria, {}),
    shortlist: publicEvidenceProviders(vendors).map(v => ({...v,gaps:[] as string[]})), methodology_note: PUBLIC_EVIDENCE_NOTICE };
}
