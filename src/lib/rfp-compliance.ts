/**
 * Regulatory compliance engine for SASE and SD-WAN RFPs.
 * Maps regulatory obligations to the methodology features that evidence
 * them and to the contractual clauses a buyer should require of suppliers.
 *
 * Clause text is a starting template for the buyer's legal review, not
 * legal advice. Each regulation is dated so buyers can see currency.
 */

export type Regulation = {
  key: string;
  label: string;
  jurisdiction: string;
  applies_to: string;
  in_force: string;
  /** Methodology feature ids this regulation makes important. */
  required_features: string[];
  /** Contractual clauses to require of the winning supplier. */
  clauses: string[];
  /** One-line plain summary. */
  note: string;
};

export const REGULATIONS: Regulation[] = [
  {
    key: "uk_gdpr",
    label: "UK GDPR / DPA 2018 / Data (Use and Access) Act 2025",
    jurisdiction: "United Kingdom",
    applies_to: "Any organisation processing UK personal data.",
    in_force: "DUAA received Royal Assent 19 June 2025.",
    required_features: ["f33_data_loss_prevention", "f22_regional_breakout_and_data_residency"],
    clauses: [
      "Supplier shall act as processor under a UK GDPR Article 28 compliant data processing agreement, including sub-processor disclosure and approval.",
      "Supplier shall confirm the geographic locations in which personal data is processed and stored, and support UK or EU data residency on request.",
      "Supplier shall notify the buyer of any personal data breach without undue delay and within 72 hours of becoming aware.",
    ],
    note: "Personal data handling requires DLP, residency control and breach notification terms.",
  },
  {
    key: "pci_dss",
    label: "PCI DSS v4.0",
    jurisdiction: "Global (card schemes)",
    applies_to: "Any organisation storing, processing or transmitting cardholder data.",
    in_force: "v4.0 mandatory since 31 March 2025.",
    required_features: ["f27_integrated_next_generation_firewall", "f30_zero_trust_network_access"],
    clauses: [
      "Supplier shall support network segmentation that isolates the cardholder data environment from other networks.",
      "Supplier shall provide an Attestation of Compliance (AOC) or evidence of PCI DSS v4.0 controls relevant to the services supplied.",
    ],
    note: "Cardholder data environments require segmentation and access control with attestation.",
  },
  {
    key: "iec_62443",
    label: "IEC 62443 (OT / industrial control systems)",
    jurisdiction: "International standard",
    applies_to: "Operators of industrial control and OT environments.",
    in_force: "Current series.",
    required_features: ["f30_zero_trust_network_access", "f27_integrated_next_generation_firewall"],
    clauses: [
      "Supplier shall support the definition and enforcement of zones and conduits between IT and OT environments.",
      "Supplier shall evidence how the solution prevents lateral movement from enterprise IT into OT networks.",
    ],
    note: "OT security requires enforced zones and conduits between IT and OT.",
  },
  {
    key: "iso_27001",
    label: "ISO/IEC 27001",
    jurisdiction: "International standard",
    applies_to: "Organisations operating an information security management system.",
    in_force: "ISO/IEC 27001:2022.",
    required_features: ["f35_soc_siem_soar_integration", "f40_managed_service_assurance"],
    clauses: [
      "Supplier shall hold a current ISO/IEC 27001:2022 certificate covering the services supplied, and provide the certificate and statement of applicability scope on request.",
    ],
    note: "Treat ISO 27001 certification as a baseline, not a differentiator.",
  },
  {
    key: "cyber_resilience_bill",
    label: "UK Cyber Security and Resilience Bill",
    jurisdiction: "United Kingdom",
    applies_to: "Critical infrastructure and, increasingly, their suppliers.",
    in_force: "Introduced to Parliament 12 November 2025.",
    required_features: ["f35_soc_siem_soar_integration", "f25_high_availability_design", "f26_sla_backed_service_fabric"],
    clauses: [
      "Supplier shall support security incident detection, reporting and response aligned with the buyer's regulatory reporting obligations.",
      "Supplier shall evidence resilience and high-availability design appropriate to critical service continuity.",
    ],
    note: "Prepare for broadening scope: monitored operations and resilient design.",
  },
  {
    key: "dora",
    label: "EU DORA (Digital Operational Resilience Act)",
    jurisdiction: "European Union",
    applies_to: "Financial entities and their ICT third-party service providers.",
    in_force: "Applicable since 17 January 2025; first enforcement cycle 2026.",
    required_features: ["f35_soc_siem_soar_integration", "f26_sla_backed_service_fabric", "f25_high_availability_design", "f40_managed_service_assurance"],
    clauses: [
      "Supplier shall include DORA-compliant ICT third-party provisions: defined service levels, audit and access rights, incident reporting, and exit and subcontracting terms.",
      "Supplier shall support threat-led penetration testing and provide the information required for the buyer's Register of Information.",
      "Supplier shall report ICT-related incidents within the timeframes the buyer must meet under DORA.",
    ],
    note: "Financial-sector ICT contracts must carry DORA third-party clauses and incident reporting.",
  },
  {
    key: "nis2",
    label: "EU NIS2 Directive",
    jurisdiction: "European Union",
    applies_to: "Essential and important entities across critical sectors.",
    in_force: "National transposition deadlines through October 2026.",
    required_features: ["f35_soc_siem_soar_integration", "f30_zero_trust_network_access", "f25_high_availability_design"],
    clauses: [
      "Supplier shall support the buyer's NIS2 risk management and incident reporting obligations, including 24-hour early warning and 72-hour notification timeframes.",
      "Supplier shall evidence supply-chain security measures applied to its own operations.",
    ],
    note: "Baseline cyber risk management and incident reporting for essential and important entities.",
  },
];

export function regulation(key: string): Regulation | undefined {
  return REGULATIONS.find((r) => r.key === key);
}

/** Backward-compatible map used by the methodology synthesis. */
export const COMPLIANCE_REQUIREMENTS: Record<string, { label: string; required: string[]; note: string }> =
  Object.fromEntries(REGULATIONS.map((r) => [r.key, { label: r.label, required: r.required_features, note: r.note }]));

export type CoverageRow = {
  regulation: string;
  label: string;
  feature_id: string;
  covered: boolean;
  question_id: string | null;
};

/**
 * Coverage matrix: for each selected regulation's required features, is there
 * an active (non-optional) question in the RFP that evidences it?
 */
export function complianceCoverage(
  selected: string[],
  activeQuestionFeatureIds: { feature_id: string; id: string }[],
): { rows: CoverageRow[]; gaps: CoverageRow[] } {
  const byFeature = new Map(activeQuestionFeatureIds.map((q) => [q.feature_id, q.id]));
  const rows: CoverageRow[] = [];
  for (const key of selected) {
    const reg = regulation(key);
    if (!reg) continue;
    for (const fid of reg.required_features) {
      const qid = byFeature.get(fid) ?? null;
      rows.push({ regulation: key, label: reg.label, feature_id: fid, covered: Boolean(qid), question_id: qid });
    }
  }
  return { rows, gaps: rows.filter((r) => !r.covered) };
}

/** All clauses for the selected regulations. */
export function clausesFor(selected: string[]): { regulation: string; label: string; clauses: string[] }[] {
  return selected
    .map((k) => regulation(k))
    .filter((r): r is Regulation => Boolean(r))
    .map((r) => ({ regulation: r.key, label: r.label, clauses: r.clauses }));
}
