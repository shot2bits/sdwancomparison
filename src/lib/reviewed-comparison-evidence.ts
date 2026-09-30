import type { ShortlistVendor } from './shortlist-core';

/** Narrow, dated editorial corrections to the comparison projection. These are
 * vendor-documented capabilities, not procurement guarantees or independent tests.
 * Never overwrite a newer governed review, and expire rather than silently age.
 */
export type ComparisonEvidence = {
  source_url: string;
  reviewed_at: string;
  review_due: string;
  qualification: string;
};
const reviewed = '2026-09-19T00:00:00.000Z';
const due = '2026-10-19T00:00:00.000Z';
const aryaka = 'https://www.aryaka.com/unified-sase-platform/';
const cato = 'https://knowledge.catonetworks.com/docs/hardware';
export const REVIEWED_COMPARISON_EVIDENCE: Record<string, Record<string, ComparisonEvidence>> = {
  aryaka: {
    f01_fully_managed_service: { source_url: aryaka, reviewed_at: reviewed, review_due: due, qualification: 'Aryaka-managed delivery is an available service model; scope and responsibilities must be agreed in the service contract.' },
    f03_co_managed_service: { source_url: aryaka, reviewed_at: reviewed, review_due: due, qualification: 'Co-managed delivery is offered; confirm the division of responsibilities with Aryaka or its delivery partner.' },
    f21_private_global_backbone: { source_url: aryaka, reviewed_at: reviewed, review_due: due, qualification: 'Aryaka documents a global private network. This does not establish private last-mile access, every-country coverage or a site-specific SLA.' },
    f25_high_availability_design: { source_url: aryaka, reviewed_at: reviewed, review_due: due, qualification: 'ANAP high-availability configurations are available; validate appliance, circuit and implementation requirements for each site.' },
  },
  'cato-networks': {
    f11_active_active_link_utilisation: { source_url: cato, reviewed_at: reviewed, review_due: due, qualification: 'Cato Socket WAN links support active/active operation. Link design and policy must be configured for the deployment.' },
    f25_high_availability_design: { source_url: cato, reviewed_at: reviewed, review_due: due, qualification: 'WAN redundancy and optional Socket redundancy are documented. HA Sockets require their own licences; resilience depends on the deployed design.' },
  },
};

export function applyReviewedComparisonEvidence(provider: ShortlistVendor, governedReview?: string, now = Date.now()): void {
  provider.capability_evidence = {};
  for (const [feature, evidence] of Object.entries(REVIEWED_COMPARISON_EVIDENCE[provider.slug] ?? {})) {
    if (now < Date.parse(evidence.reviewed_at) || now >= Date.parse(evidence.review_due)) continue;
    // A later approved dataset supersedes this bounded correction. No permanent overrides.
    if (governedReview && Date.parse(governedReview) >= Date.parse(evidence.reviewed_at)) continue;
    provider.capabilities[feature] = 'yes';
    provider.capability_evidence[feature] = evidence;
  }
}
