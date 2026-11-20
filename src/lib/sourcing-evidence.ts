import { publicShortlistPreview } from './public-shortlist';
import { REGION_LABELS, SECTOR_LABELS, STATUS_LABELS, type CapabilityStatus, type ShortlistVendor } from './shortlist-core';
import type { SourcingBrief } from './sourcing-contract';

const supported = (status: CapabilityStatus | undefined) =>
  ['yes', 'partial', 'partner_integrated', 'managed_service_dependent'].includes(status ?? 'unknown');
const missing = (status: CapabilityStatus | undefined) => !status || ['unknown', 'not_confirmed'].includes(status);
export type InvestigationProvider = { slug: string; name: string; reasons: string[] };

/** Keep strict matches intact. Investigation options carry explicit unresolved criteria. */
export function sourcingEvidence(vendors: ShortlistVendor[], brief: SourcingBrief) {
  const feature = brief.need === 'sdwan' ? 'f09_encrypted_overlay_fabric'
    : brief.need === 'sase' ? 'f28_full_sase_platform'
    : brief.need === 'secure_access' ? 'f30_zero_trust_network_access' : null;
  const preview = publicShortlistPreview(vendors, {
    sector: brief.sector, required_regions: [brief.region],
    uk_provider_only: brief.uk_provider_only ?? false,
    required_features: feature ? [feature] : [],
  });
  const matched = new Set(preview.matches.map(v => v.slug));
  const investigation: InvestigationProvider[] = [];
  for (const v of vendors) {
    if (matched.has(v.slug)) continue;
    // Scope evidence must exist. Do not suggest providers with an unsupported service.
    if (feature && !supported(v.capabilities[feature])) continue;
    const region = v.regions[brief.region];
    const sector = brief.sector ? v.sectors[brief.sector] : null;
    if (!supported(region) && !missing(region)) continue;
    if (sector && !supported(sector) && !missing(sector)) continue;
    // At least one context criterion must have evidence; entirely unresearched options stay in the directory.
    if (!supported(region) && !(brief.sector && supported(sector ?? undefined))) continue;
    const reasons: string[] = [];
    if (missing(region)) reasons.push(`${REGION_LABELS[brief.region]} delivery evidence needs review.`);
    else if (region !== 'yes') reasons.push(`${REGION_LABELS[brief.region]}: ${STATUS_LABELS[region]}.`);
    if (brief.sector && missing(sector ?? undefined)) reasons.push(`${SECTOR_LABELS[brief.sector]} sector evidence needs review.`);
    else if (brief.sector && sector && sector !== 'yes') reasons.push(`${SECTOR_LABELS[brief.sector]}: ${STATUS_LABELS[sector]}.`);
    if (brief.uk_provider_only && !['uk_hq', 'uk_entity'].includes(v.uk_delivery)) reasons.push('UK headquarters or contracting entity is not yet evidenced.');
    if (reasons.length) investigation.push({ slug: v.slug, name: v.name, reasons });
  }
  const checks = [
    ...(!preview.matches.length ? [
      `${REGION_LABELS[brief.region]} delivery`,
      ...(brief.sector ? [`${SECTOR_LABELS[brief.sector]} experience`] : []),
      ...(feature ? ['the requested service scope'] : []),
      ...(brief.uk_provider_only ? ['a UK headquarters or contracting entity'] : []),
    ] : []),
  ];
  return { ...preview, investigation, outstanding_checks: checks };
}
