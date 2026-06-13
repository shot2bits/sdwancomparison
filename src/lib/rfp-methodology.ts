/**
 * Canonical SASE Methodology v2026.1.
 * Derived from the 40-feature evaluation matrix that grades every vendor,
 * so the RFP agent cites real feature IDs and emits the exact RFP question
 * and evidence already attached to each feature. One source of truth across
 * grading, shortlisting and RFP generation.
 */

import { FEATURES, FEATURE_CATEGORIES, type FeatureDefinition } from "@/lib/vendors";
import { SECTOR_KEYS, SECTOR_LABELS, type SectorKey } from "@/lib/shortlist-core";

export const METHODOLOGY_VERSION = "2026.1";

export type MethodologyQuestion = {
  feature_id: string;
  number: number;
  category: string;
  feature_name: string;
  definition: string;
  rfp_question: string;
  evidence_requested: string;
};

/** Every feature, shaped as an RFP-ready question. */
export function methodologyQuestions(): MethodologyQuestion[] {
  return FEATURES.map((f: FeatureDefinition) => ({
    feature_id: f.id,
    number: f.number,
    category: f.category,
    feature_name: f.name,
    definition: f.definition,
    rfp_question: f.rfp_question,
    evidence_requested: f.rfp_evidence_requested,
  }));
}

/**
 * Sector requirement map: which feature ids the methodology treats as
 * required (hard) or recommended (soft) for each sector. Drives proactive
 * requirement synthesis. Required ids gate; recommended ids are suggested.
 */
export const SECTOR_REQUIREMENTS: Record<SectorKey, { required: string[]; recommended: string[] }> = {
  healthcare: {
    required: ["f30_zero_trust_network_access", "f33_data_loss_prevention", "f25_high_availability_design"],
    recommended: ["f31_secure_web_gateway", "f35_soc_siem_soar_integration", "f01_fully_managed_service", "f22_regional_breakout_and_data_residency"],
  },
  financial_services: {
    required: ["f30_zero_trust_network_access", "f33_data_loss_prevention", "f32_casb_capability", "f35_soc_siem_soar_integration"],
    recommended: ["f31_secure_web_gateway", "f26_sla_backed_service_fabric", "f22_regional_breakout_and_data_residency"],
  },
  retail_ecommerce: {
    required: ["f17_cellular_and_5g_support", "f24_flexible_edge_form_factors", "f27_integrated_next_generation_firewall"],
    recommended: ["f01_fully_managed_service", "f15_local_internet_breakout", "f36_centralised_orchestration"],
  },
  manufacturing: {
    required: ["f30_zero_trust_network_access", "f12_application_aware_routing", "f25_high_availability_design", "f27_integrated_next_generation_firewall"],
    recommended: ["f17_cellular_and_5g_support", "f35_soc_siem_soar_integration", "f24_flexible_edge_form_factors", "f36_centralised_orchestration"],
  },
  energy_utilities: {
    required: ["f30_zero_trust_network_access", "f25_high_availability_design", "f35_soc_siem_soar_integration"],
    recommended: ["f17_cellular_and_5g_support", "f27_integrated_next_generation_firewall", "f22_regional_breakout_and_data_residency"],
  },
  government_public_sector: {
    required: ["f22_regional_breakout_and_data_residency", "f30_zero_trust_network_access", "f33_data_loss_prevention", "f35_soc_siem_soar_integration"],
    recommended: ["f01_fully_managed_service", "f26_sla_backed_service_fabric"],
  },
  education: {
    required: ["f31_secure_web_gateway", "f34_remote_user_access"],
    recommended: ["f15_local_internet_breakout", "f37_customer_portal_and_rbac", "f08_flexible_commercial_model"],
  },
  transport_logistics: {
    required: ["f17_cellular_and_5g_support", "f24_flexible_edge_form_factors"],
    recommended: ["f25_high_availability_design", "f36_centralised_orchestration", "f10_dynamic_path_selection"],
  },
  professional_services: {
    required: ["f34_remote_user_access", "f30_zero_trust_network_access"],
    recommended: ["f31_secure_web_gateway", "f33_data_loss_prevention", "f18_cloud_on_ramp"],
  },
  hospitality_leisure: {
    required: ["f15_local_internet_breakout", "f27_integrated_next_generation_firewall"],
    recommended: ["f17_cellular_and_5g_support", "f01_fully_managed_service", "f24_flexible_edge_form_factors"],
  },
};

/**
 * Compliance map: regulatory obligations to the features they most
 * directly evidence. Lets the agent justify questions by compliance need.
 */
import { COMPLIANCE_REQUIREMENTS, REGULATIONS } from "@/lib/rfp-compliance";
export { COMPLIANCE_REQUIREMENTS };

/** The full methodology document served at /methodology.json. */
export function buildMethodology() {
  return {
    name: "Netify SASE and SD-WAN Evaluation Methodology",
    version: METHODOLOGY_VERSION,
    published_by: "Netify Group Limited",
    description:
      "The canonical framework Netify uses to grade vendors, build shortlists and generate RFPs. 40 capability features across 6 categories, each with a ready-to-issue RFP question and the evidence a buyer should request. Sector and compliance maps link business context to required features.",
    categories: FEATURE_CATEGORIES,
    features: methodologyQuestions(),
    sectors: SECTOR_KEYS.map((k) => ({
      key: k,
      label: SECTOR_LABELS[k],
      required: SECTOR_REQUIREMENTS[k].required,
      recommended: SECTOR_REQUIREMENTS[k].recommended,
    })),
    compliance: REGULATIONS.map((r) => ({
      key: r.key,
      label: r.label,
      jurisdiction: r.jurisdiction,
      applies_to: r.applies_to,
      in_force: r.in_force,
      required_features: r.required_features,
      clauses: r.clauses,
      note: r.note,
    })),
  };
}

/** Resolve the methodology question for a feature id. */
export function questionForFeature(featureId: string): MethodologyQuestion | undefined {
  return methodologyQuestions().find((q) => q.feature_id === featureId);
}

/* ------------------------------------------------------------------ */
/* Requirement synthesis: buyer context -> RFP sections               */
/* ------------------------------------------------------------------ */

import type { BuyerContext, RfpSection, RfpQuestion, ProductScope } from "@/lib/rfp-types";

/**
 * Product scope decides which methodology categories and features are in
 * play. SD-WAN only drops the cloud-delivered security stack; SSE only
 * drops transport and backbone engineering; full SASE keeps everything.
 */
const SECURITY_FEATURES = new Set([
  "f27_integrated_next_generation_firewall", "f28_full_sase_platform", "f29_sse_ecosystem_integration",
  "f30_zero_trust_network_access", "f31_secure_web_gateway", "f32_casb_capability",
  "f33_data_loss_prevention", "f34_remote_user_access", "f35_soc_siem_soar_integration",
]);
const TRANSPORT_BACKBONE = new Set([
  "f09_encrypted_overlay_fabric", "f10_dynamic_path_selection", "f11_active_active_link_utilisation",
  "f12_application_aware_routing", "f13_qos_and_traffic_shaping", "f14_packet_loss_remediation",
  "f15_local_internet_breakout", "f16_mpls_coexistence_and_migration", "f17_cellular_and_5g_support",
  "f18_cloud_on_ramp", "f19_public_cloud_gateways", "f20_private_pops_dedicated_pops",
  "f21_private_global_backbone", "f23_multi_cloud_transit_fabric", "f24_flexible_edge_form_factors",
]);

export function featureInScope(featureId: string, scope: ProductScope): boolean {
  if (scope === "sdwan_only") return !SECURITY_FEATURES.has(featureId) || featureId === "f27_integrated_next_generation_firewall";
  if (scope === "sse_only") return !TRANSPORT_BACKBONE.has(featureId);
  // full_sase, single_vendor_sase, best_of_breed keep the whole matrix
  return true;
}

/**
 * Build RFP sections from buyer context. Every question traces to a
 * methodology feature and carries a rationale citing why it is included.
 * Pure function: the agent and the API both call it.
 */
export function synthesiseSections(buyer: BuyerContext): RfpSection[] {
  const required = new Set<string>();
  const recommended = new Set<string>();
  const reasons: Record<string, string[]> = {};

  const note = (fid: string, reason: string) => {
    (reasons[fid] ??= []).push(reason);
  };

  // Sector drivers
  if (buyer.sector && buyer.sector in SECTOR_REQUIREMENTS) {
    const sec = SECTOR_REQUIREMENTS[buyer.sector as SectorKey];
    const label = SECTOR_LABELS[buyer.sector as SectorKey];
    sec.required.forEach((f) => { required.add(f); note(f, `${label} sector requirement`); });
    sec.recommended.forEach((f) => { recommended.add(f); note(f, `recommended for ${label}`); });
  }

  // Compliance drivers
  for (const c of buyer.compliance) {
    const comp = COMPLIANCE_REQUIREMENTS[c];
    if (!comp) continue;
    comp.required.forEach((f) => { required.add(f); note(f, `${comp.label} compliance`); });
  }

  // Operating model driver
  if (buyer.operating_model === "managed") {
    required.add("f01_fully_managed_service");
    note("f01_fully_managed_service", "fully managed operating model requested");
    recommended.add("f40_managed_service_assurance");
    note("f40_managed_service_assurance", "managed service needs assured operations");
  } else if (buyer.operating_model === "co_managed") {
    required.add("f03_co_managed_service");
    note("f03_co_managed_service", "co-managed operating model requested");
    recommended.add("f37_customer_portal_and_rbac");
    note("f37_customer_portal_and_rbac", "co-managed needs portal and role-based access");
  } else if (buyer.operating_model === "diy") {
    required.add("f02_diy_self_managed_model");
    note("f02_diy_self_managed_model", "DIY self-managed model requested");
    recommended.add("f39_apis_and_automation");
    note("f39_apis_and_automation", "DIY operation relies on APIs and automation");
    recommended.add("f36_centralised_orchestration");
    note("f36_centralised_orchestration", "DIY teams need strong orchestration");
  }

  // Single-vendor vs best-of-breed scope driver
  if (buyer.product_scope === "single_vendor_sase") {
    required.add("f28_full_sase_platform");
    note("f28_full_sase_platform", "single-vendor SASE scope");
  } else if (buyer.product_scope === "best_of_breed") {
    required.add("f29_sse_ecosystem_integration");
    note("f29_sse_ecosystem_integration", "best-of-breed scope needs SSE ecosystem integration");
  }

  // Multi-site and regional drivers
  if (buyer.site_count && buyer.site_count >= 20) {
    recommended.add("f36_centralised_orchestration");
    note("f36_centralised_orchestration", `${buyer.site_count} sites need central orchestration`);
    recommended.add("f24_flexible_edge_form_factors");
    note("f24_flexible_edge_form_factors", "large estate benefits from flexible edge options");
  }
  if (buyer.regions.length > 1) {
    recommended.add("f21_private_global_backbone");
    note("f21_private_global_backbone", "multi-region estate benefits from backbone reach");
  }

  const all = methodologyQuestions();
  const sections: RfpSection[] = [];

  const scope = buyer.product_scope ?? "full_sase";
  for (const category of FEATURE_CATEGORIES) {
    const catFeatures = all.filter((q) => q.category === category && featureInScope(q.feature_id, scope));
    if (catFeatures.length === 0) continue;
    const questions: RfpQuestion[] = [];
    for (const q of catFeatures) {
      const isRequired = required.has(q.feature_id);
      const isRecommended = recommended.has(q.feature_id);
      // Always include required and recommended; include the rest as optional
      // so the buyer can opt in. Foundational features are recommended by default.
      const priority: RfpQuestion["priority"] = isRequired ? "required" : isRecommended ? "recommended" : "optional";
      const why = reasons[q.feature_id];
      const rationale = why && why.length
        ? `Included because: ${why.join("; ")} (per SASE Methodology v${METHODOLOGY_VERSION}, ${q.feature_id}).`
        : `Standard ${category.toLowerCase()} question (per SASE Methodology v${METHODOLOGY_VERSION}, ${q.feature_id}).`;
      questions.push({
        id: `q_${q.feature_id}`,
        feature_id: q.feature_id,
        text: q.rfp_question,
        evidence_requested: q.evidence_requested,
        rationale,
        priority,
        source: "methodology",
        buyer_lens: "",
        supplier_lens: "",
        mandatory: isRequired,
        weight: isRequired ? 4 : isRecommended ? 3 : 2,
      });
    }
    // Section is included by default if it has any required or recommended question
    const included = questions.some((x) => x.priority !== "optional") || true;
    sections.push({ category, included, questions });
  }
  return sections;
}
