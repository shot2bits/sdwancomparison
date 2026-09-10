import { z } from "zod";

export const SECTOR_PROFILE_VERSION = "sector-profile/1.0.0" as const;
const RecommendationSchema = z.object({ code: z.string(), label: z.string(), reason: z.string(), question: z.string(), evidence_weight: z.number().min(0).max(2) }).strict();
export const GovernedSectorProfileSchema = z.object({ version: z.literal(SECTOR_PROFILE_VERSION), sector: z.enum(["healthcare", "manufacturing", "retail", "financial_services"]), source_url: z.string(), assumptions: z.array(z.string()), limitations: z.array(z.string()), recommendations: z.array(RecommendationSchema).min(4) }).strict();
export type GovernedSectorProfile = z.infer<typeof GovernedSectorProfileSchema>;

export const SECTOR_PROFILES: Record<GovernedSectorProfile["sector"], GovernedSectorProfile> = {
  healthcare: { version: SECTOR_PROFILE_VERSION, sector: "healthcare", source_url: "/sd-wan-for-healthcare/", assumptions: ["Clinical and administrative workloads may have different continuity needs."], limitations: ["DSPT applicability and clinical-safety obligations must be confirmed by the buyer."], recommendations: [
    { code: "clinical_resilience", label: "Clinical resilience", reason: "Clinical services may require explicit downtime and failover objectives.", question: "Which clinical services cannot tolerate loss of connectivity, and for how long?", evidence_weight: 1.5 },
    { code: "patient_data_controls", label: "Patient-data controls", reason: "Patient information needs an explicitly confirmed security and audit boundary.", question: "Which systems process patient data and which identities may access them?", evidence_weight: 1.5 },
    { code: "dsp_tooling", label: "DSPT applicability", reason: "NHS DSPT applicability must be established rather than assumed.", question: "Does the organisation or any supplier fall within NHS DSPT scope?", evidence_weight: 1.2 },
    { code: "monitored_devices", label: "Monitored devices", reason: "Clinical, alarm and monitored devices may depend on retained lines or segregated access.", question: "Which monitored devices depend on current network or analogue services?", evidence_weight: 1.3 },
    { code: "staff_guest_separation", label: "Staff and guest separation", reason: "Clinical, corporate, device and guest traffic require confirmed boundaries.", question: "Which user and device groups must remain isolated?", evidence_weight: 1.0 },
  ] },
  manufacturing: { version: SECTOR_PROFILE_VERSION, sector: "manufacturing", source_url: "/sd-wan-sase-for-manufacturing/", assumptions: ["Plant and office environments may have different change windows."], limitations: ["OT protocols and safety dependencies require site-specific confirmation."], recommendations: [
    { code: "plant_uptime", label: "Plant uptime", reason: "Production loss makes recovery objectives material to design.", question: "Which production processes are connectivity-critical and what outage can each tolerate?", evidence_weight: 1.5 },
    { code: "it_ot_separation", label: "IT/OT separation", reason: "IT and operational technology need explicit trust boundaries.", question: "Who owns IT/OT policy and which flows must cross the boundary?", evidence_weight: 1.6 },
    { code: "brownfield_estate", label: "Brownfield compatibility", reason: "Legacy industrial systems may constrain routing, security and cutover.", question: "Which legacy protocols, appliances or fixed-address dependencies must remain?", evidence_weight: 1.2 },
    { code: "remote_maintenance", label: "Remote maintenance", reason: "Supplier access to plant systems needs identity, approval and session controls.", question: "How should external engineers obtain and evidence temporary access?", evidence_weight: 1.3 },
    { code: "cutover_constraints", label: "Cutover constraints", reason: "Plant maintenance windows determine migration sequence and rollback.", question: "Which sites have fixed shutdown windows or no acceptable production-hours change?", evidence_weight: 1.2 },
  ] },
  retail: { version: SECTOR_PROFILE_VERSION, sector: "retail", source_url: "/sd-wan-sase-for-retail/", assumptions: ["Stores may combine payment, corporate, guest and IoT traffic."], limitations: ["PCI DSS scope and acquiring arrangements must be confirmed by the buyer."], recommendations: [
    { code: "payment_boundary", label: "Payment boundary", reason: "Payment traffic and systems need a confirmed scope and segmentation model.", question: "Which locations, systems and third parties sit within the payment environment?", evidence_weight: 1.6 },
    { code: "guest_wifi", label: "Guest Wi-Fi isolation", reason: "Guest access must not create a route into corporate or payment systems.", question: "How are guest, colleague, payment and device networks separated today?", evidence_weight: 1.1 },
    { code: "seasonal_capacity", label: "Seasonal capacity", reason: "Peak trading can change bandwidth and support requirements.", question: "What are the busiest periods and measured peak traffic by store type?", evidence_weight: 1.0 },
    { code: "store_rollout", label: "Store rollout", reason: "Openings, closures and refits require repeatable zero-touch deployment evidence.", question: "How many store changes are expected and what lead time is available?", evidence_weight: 1.1 },
    { code: "cellular_resilience", label: "Cellular resilience", reason: "Backup access may protect trading when fixed circuits fail.", question: "Which store functions must remain available on cellular failover?", evidence_weight: 1.2 },
  ] },
  financial_services: { version: SECTOR_PROFILE_VERSION, sector: "financial_services", source_url: "/sd-wan-sase-for-financial-services/", assumptions: ["Operational-resilience obligations depend on entity, service and jurisdiction."], limitations: ["DORA and other regulatory applicability require legal/compliance confirmation."], recommendations: [
    { code: "operational_resilience", label: "Operational resilience", reason: "Important business services need impact tolerances and tested recovery.", question: "Which important business services depend on the network and what impact tolerance applies?", evidence_weight: 1.6 },
    { code: "auditability", label: "Auditability", reason: "Control operation, changes and access may need durable evidence.", question: "What evidence retention and audit export does compliance require?", evidence_weight: 1.3 },
    { code: "third_party_diligence", label: "Third-party diligence", reason: "Provider and subcontractor dependencies need explicit oversight.", question: "Which due-diligence evidence and subcontractor disclosures are mandatory?", evidence_weight: 1.3 },
    { code: "concentration_risk", label: "Concentration risk", reason: "Shared platform, carrier and cloud dependencies may create correlated failure.", question: "Which concentration and correlated-failure scenarios must be tested?", evidence_weight: 1.2 },
    { code: "exit_planning", label: "Exit planning", reason: "Migration away from a provider needs data, configuration and continuity planning.", question: "What exit assistance, portability and transition period are required?", evidence_weight: 1.2 },
  ] },
};

export function projectSectorProfile(sector: GovernedSectorProfile["sector"]) {
  const profile = GovernedSectorProfileSchema.parse(SECTOR_PROFILES[sector]);
  return { profile_version: profile.version, sector: profile.sector, source_url: profile.source_url, recommendations: profile.recommendations.map((item) => ({ requirement_code: item.code, state: "recommended" as const, reason: item.reason })) };
}
