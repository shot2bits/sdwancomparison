import type { CapabilityStatus, ShortlistVendor } from './shortlist-core';

/** Narrow, dated editorial corrections to the comparison projection. These are
 * vendor-documented capabilities, not procurement guarantees or independent tests.
 * Never overwrite a newer governed review, and expire rather than silently age.
 */
export type ComparisonEvidence = {
  grade?: CapabilityStatus;
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
  'bt-business': {
    f12_application_aware_routing: { source_url: 'https://business.bt.com/content/dam/bt-business/pdfs/terms/managed-services/btl-bte-frtnt-sdwan-annex-to-mngd-srvcs-sch.pdf', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'Fortinet annex clause 2.5 documents application-aware routing. BT implements agreed categories; two enabling links optimise operation.' },
    f24_flexible_edge_form_factors: { source_url: 'https://business.bt.com/content/dam/bt-business/pdfs/terms/managed-services/btl-bte-frtnt-sdwan-annex-to-mngd-srvcs-sch.pdf', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'Physical and virtual SD-WAN devices are documented. Cloud deployment and customer-provided devices depend on the order and compatibility.' },
    f11_active_active_link_utilisation: { grade: 'partial', source_url: 'https://business.bt.com/content/dam/bt-business/pdfs/terms/managed-services/btl-bte-frtnt-sdwan-annex-to-mngd-srvcs-sch.pdf', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'Active-active mobile access is an optional 5G service. This does not establish active-active operation across all access types.' },
    f37_customer_portal_and_rbac: { grade: 'partial', source_url: 'https://business.bt.com/content/dam/bt-business/pdfs/terms/managed-services/btl-bte-frtnt-sdwan-annex-to-mngd-srvcs-sch.pdf', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'Customer monitoring and reporting portals are documented in clauses 2.3 and 2.8. Granular role-based permissions remain unconfirmed.' },
    f38_observability_and_digital_experience_monitoring: { grade: 'partial', source_url: 'https://business.bt.com/content/dam/bt-business/pdfs/terms/managed-services/btl-bte-frtnt-sdwan-annex-to-mngd-srvcs-sch.pdf', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'The portal exposes application performance, flows and troubleshooting. These findings do not establish a full digital experience monitoring service.' },
  },
  'virgin-media-o2': {
    f05_professional_services_and_migration_support: { grade: 'partial', source_url: 'https://www.virginmediabusiness.co.uk/connectivity/sdwan/sdwan-end-to-end-service/', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'VMO2 describes experts supporting network and cloud migration with customer teams. A site trial is offered; rollback and training scope require confirmation.' },
    f16_mpls_coexistence_and_migration: { source_url: 'https://www.virginmediabusiness.co.uk/connectivity/sdwan/sdwan-how-it-works/', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'Service gateways connect existing MPLS IP VPN and new SD-WAN networks during transition. Confirm the design for each site.' },
    f37_customer_portal_and_rbac: { grade: 'partial', source_url: 'https://www.virginmediabusiness.co.uk/pdf/legal-documents/vmbusiness-service-schedule-sdwan-v5.0.pdf', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'Clause 14 and Appendix 1 document customer portals and individual user access. Granular role-based permissions remain unconfirmed.' },
    f26_sla_backed_service_fabric: { grade: 'partial', source_url: 'https://www.virginmediabusiness.co.uk/pdf/legal-documents/vmbusiness-service-schedule-sdwan-v5.0.pdf', reviewed_at: '2026-10-10T00:00:00Z', review_due: '2027-01-08T00:00:00Z', qualification: 'Appendix 2 provides conditional service gateway targets and credits. This is not a blanket end-to-end performance guarantee.' },
  },
  aryaka: {
    f02_diy_self_managed_model:{source_url:'https://www.aryaka.com/use-cases/network-and-security-convergence/',reviewed_at:'2026-10-01T00:00:00Z',review_due:'2026-12-30T00:00:00Z',qualification:'Aryaka explicitly offers fully managed, co-managed and self-managed delivery. Confirm the buyer’s retained tasks and service scope; self-management is not evidence of a standalone appliance purchase.'},
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
  provider.capability_evidence ??= {};
  for (const [feature, evidence] of Object.entries(REVIEWED_COMPARISON_EVIDENCE[provider.slug] ?? {})) {
    if (now < Date.parse(evidence.reviewed_at) || now >= Date.parse(evidence.review_due)) continue;
    // A later approved dataset supersedes this bounded correction. No permanent overrides.
    if (governedReview && Date.parse(governedReview) >= Date.parse(evidence.reviewed_at)) continue;
    provider.capabilities[feature] = evidence.grade ?? 'yes';
    provider.capability_evidence[feature] = evidence;
  }
}
