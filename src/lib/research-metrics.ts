import definitions from '../../data/feature-definitions.json';
import type { ShortlistVendor } from './shortlist-core';

export const RESEARCH_METRIC_METHOD = 'Research completeness counts graded fields across the published capability framework. Supported, partial, partner-delivered, managed-service dependent and not-primary grades count as reviewed. Unconfirmed or missing fields do not. This measures research completeness, not provider quality, suitability or the number of supported capabilities.';
/** One public denominator for live and snapshot records. Ignore extra imported fields. */
export function researchMetrics(v: Pick<ShortlistVendor, 'capabilities'>) {
  const counts = { supported: 0, partial: 0, partner_delivered: 0, managed_service_dependent: 0, not_primary: 0, unconfirmed: 0 };
  for (const { id } of definitions.features) {
    switch (v.capabilities[id]) {
      case 'yes': counts.supported++; break;
      case 'partial': counts.partial++; break;
      case 'partner_integrated': counts.partner_delivered++; break;
      case 'managed_service_dependent': counts.managed_service_dependent++; break;
      case 'not_primary': counts.not_primary++; break;
      default: counts.unconfirmed++;
    }
  }
  const total = definitions.features.length;
  const reviewed = total - counts.unconfirmed;
  return { ...counts, total, reviewed, completeness: total ? reviewed / total : 0 };
}
