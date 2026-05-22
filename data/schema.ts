import { z } from "zod";

/**
 * Vendor record schema for the SD-WAN comparison tool.
 *
 * Source of truth for the structure of every file in /data/vendors/*.json.
 * Validation runs at build time via /scripts/validate-vendors.ts.
 *
 * Capability status grades follow the matrix research methodology:
 * - yes:                        Public evidence found
 * - partial:                    Limited or indirect public evidence
 * - partner_integrated:         Available through partner/platform/service
 * - managed_service_dependent:  Provider-specific via managed service
 * - not_primary:                Not primary or not publicly positioned
 * - unknown:                    Not confirmed by reviewed public sources
 */

export const CapabilityStatus = z.enum([
  "yes",
  "partial",
  "partner_integrated",
  "managed_service_dependent",
  "not_primary",
  "unknown",
]);
export type CapabilityStatus = z.infer<typeof CapabilityStatus>;

export const PricingVisibility = z.enum([
  "public",
  "partial_public",
  "quote_based",
]);
export type PricingVisibility = z.infer<typeof PricingVisibility>;

/**
 * Capability matrix: one status grade per feature.
 * All 40 feature keys are required. Missing keys fail validation.
 */
export const Capabilities = z.object({
  f01_fully_managed_service: CapabilityStatus,
  f02_diy_self_managed_model: CapabilityStatus,
  f03_co_managed_service: CapabilityStatus,
  f04_multi_tenant_msp_white_label_support: CapabilityStatus,
  f05_professional_services_and_migration_support: CapabilityStatus,
  f06_last_mile_circuit_management: CapabilityStatus,
  f07_lifecycle_management: CapabilityStatus,
  f08_flexible_commercial_model: CapabilityStatus,
  f09_encrypted_overlay_fabric: CapabilityStatus,
  f10_dynamic_path_selection: CapabilityStatus,
  f11_active_active_link_utilisation: CapabilityStatus,
  f12_application_aware_routing: CapabilityStatus,
  f13_qos_and_traffic_shaping: CapabilityStatus,
  f14_packet_loss_remediation: CapabilityStatus,
  f15_local_internet_breakout: CapabilityStatus,
  f16_mpls_coexistence_and_migration: CapabilityStatus,
  f17_cellular_and_5g_support: CapabilityStatus,
  f18_cloud_on_ramp: CapabilityStatus,
  f19_public_cloud_gateways: CapabilityStatus,
  f20_private_pops_dedicated_pops: CapabilityStatus,
  f21_private_global_backbone: CapabilityStatus,
  f22_regional_breakout_and_data_residency: CapabilityStatus,
  f23_multi_cloud_transit_fabric: CapabilityStatus,
  f24_flexible_edge_form_factors: CapabilityStatus,
  f25_high_availability_design: CapabilityStatus,
  f26_sla_backed_service_fabric: CapabilityStatus,
  f27_integrated_next_generation_firewall: CapabilityStatus,
  f28_full_sase_platform: CapabilityStatus,
  f29_sse_ecosystem_integration: CapabilityStatus,
  f30_zero_trust_network_access: CapabilityStatus,
  f31_secure_web_gateway: CapabilityStatus,
  f32_casb_capability: CapabilityStatus,
  f33_data_loss_prevention: CapabilityStatus,
  f34_remote_user_access: CapabilityStatus,
  f35_soc_siem_soar_integration: CapabilityStatus,
  f36_centralised_orchestration: CapabilityStatus,
  f37_customer_portal_and_rbac: CapabilityStatus,
  f38_observability_and_digital_experience_monitoring: CapabilityStatus,
  f39_apis_and_automation: CapabilityStatus,
  f40_managed_service_assurance: CapabilityStatus,
}).strict();
export type Capabilities = z.infer<typeof Capabilities>;

/**
 * Score summary: derived counts and coverage percentage.
 * These can be computed at build time from capabilities, but are stored
 * explicitly so they're queryable without recomputation.
 */
export const ScoreSummary = z.object({
  yes_count: z.number().int().min(0).max(40),
  partial_count: z.number().int().min(0).max(40),
  partner_integrated_count: z.number().int().min(0).max(40),
  managed_service_dependent_count: z.number().int().min(0).max(40),
  unknown_count: z.number().int().min(0).max(40),
  not_primary_count: z.number().int().min(0).max(40),
  evidence_coverage_pct: z.number().min(0).max(1),
}).strict();
export type ScoreSummary = z.infer<typeof ScoreSummary>;

export const VendorSchema = z.object({
  // Identity
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, digits and hyphens only"),
  name: z.string().min(1),
  website: z.string().url(),
  category: z.string().min(1),

  // Optional identity enrichment (populate progressively)
  tagline: z.string().optional(),
  founded: z.number().int().min(1900).max(2100).optional(),
  headquarters: z.string().optional(),
  product_focus: z.string().optional(),

  // Evidence and sourcing
  primary_sources: z.array(z.string().url()).min(1),
  evidence_summary: z.string().min(1),

  // Cost
  cost_model: z.string().min(1),
  public_pricing_visibility: PricingVisibility,

  // Capability matrix (40 features)
  capabilities: Capabilities,
  score_summary: ScoreSummary,

  // Qualitative judgements (Netify editorial)
  key_differentiators: z.array(z.string().min(1)).min(1).max(6),
  best_fit_for: z.array(z.string().min(1)).min(1).max(6),
  watch_outs: z.array(z.string().min(1)).min(1).max(6),

  // Provenance
  last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "last_verified must be YYYY-MM-DD"),
  verification_notes: z.string().min(1),
}).strict();

export type Vendor = z.infer<typeof VendorSchema>;
