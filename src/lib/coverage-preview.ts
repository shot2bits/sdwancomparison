import { buildShortlist, type ShortlistVendor, type ShortlistInput } from "./shortlist-core";

/** Missing sector evidence is not a negative suitability finding. Keep confirmed
 * eligibility unchanged and report this separate, non-eligible research count. */
export function sectorUnconfirmedCoverage(vendors: ShortlistVendor[], input: ShortlistInput): number {
  if (!input.sector) return 0;
  const sector = input.sector;
  const otherFilters = buildShortlist(vendors, { ...input, sector: null });
  return otherFilters.evaluation.filter(v => {
    if (!v.eligible) return false;
    const provider = vendors.find(row => row.slug === v.slug);
    return provider?.sectors[sector] === "unknown" || provider?.sectors[sector] === "not_confirmed";
  }).length;
}

export type CoveragePreview = { meets_all_mandatory_count: number; sector_unconfirmed_count?: number; considered_count: number };
export function coverageExplanation(preview: CoveragePreview): string {
  const confirmed = preview.meets_all_mandatory_count;
  const pending = preview.sector_unconfirmed_count ?? 0;
  if (confirmed > 0) return `${confirmed} providers meet the filters checked so far. This does not confirm every requirement or guarantee supplier responses.`;
  if (pending > 0) return `${pending} providers meet your other filters, but their suitability for your sector still needs confirmation. There are no fully verified matches yet. This is an evidence gap, not a finding that no supplier can help.`;
  return "No fully verified matches were found for these filters. This may reflect missing evidence or requirements that need review; it does not prove that no supplier can help. Review your filters or speak to Netify before deciding whether to publish.";
}
