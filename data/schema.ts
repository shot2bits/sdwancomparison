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


/**
 * Extended dimensions added June 2026 for the SASE shortlist builder.
 * Grades use the same CapabilityStatus scale as the 40-feature matrix.
 * "unknown" is the honest default where public evidence was not reviewed.
 */
export const DeploymentSpeed = z.enum([
  "hours",
  "days",
  "weeks",
  "months",
  "unknown",
]);
export type DeploymentSpeed = z.infer<typeof DeploymentSpeed>;

export const Regions = z.object({
  uk_ireland: CapabilityStatus,
  europe: CapabilityStatus,
  north_america: CapabilityStatus,
  asia_pacific: CapabilityStatus,
  middle_east_africa: CapabilityStatus,
  latin_america: CapabilityStatus,
  china_mainland: CapabilityStatus,
}).strict();
export type Regions = z.infer<typeof Regions>;

export const SupportedClouds = z.object({
  aws: CapabilityStatus,
  azure: CapabilityStatus,
  gcp: CapabilityStatus,
  oracle_cloud: CapabilityStatus,
  alibaba_cloud: CapabilityStatus,
}).strict();
export type SupportedClouds = z.infer<typeof SupportedClouds>;

export const AiCapability = z.object({
  ai_driven_operations: CapabilityStatus,
  ai_security_analytics: CapabilityStatus,
  ai_assistant: CapabilityStatus,
  note: z.string().min(1),
}).strict();
export type AiCapability = z.infer<typeof AiCapability>;

export const Resilience = z.object({
  disaster_recovery: CapabilityStatus,
  note: z.string().min(1),
}).strict();
export type Resilience = z.infer<typeof Resilience>;


/**
 * Sector capability grades. Evidence basis: case studies, dedicated
 * sector offerings, certifications and named references in public sources.
 */
export const Sectors = z.object({
  healthcare: CapabilityStatus,
  financial_services: CapabilityStatus,
  retail_ecommerce: CapabilityStatus,
  manufacturing: CapabilityStatus,
  energy_utilities: CapabilityStatus,
  government_public_sector: CapabilityStatus,
  education: CapabilityStatus,
  transport_logistics: CapabilityStatus,
  professional_services: CapabilityStatus,
  hospitality_leisure: CapabilityStatus,
}).strict();
export type Sectors = z.infer<typeof Sectors>;

export const OrganisationFit = z.object({
  large_global_enterprise: CapabilityStatus,
  mid_market: CapabilityStatus,
  small_business: CapabilityStatus,
}).strict();
export type OrganisationFit = z.infer<typeof OrganisationFit>;

export const PricingUnit = z.enum([
  "per_user",
  "per_site",
  "per_bandwidth",
  "bundle",
  "custom_quote",
]);
export type PricingUnit = z.infer<typeof PricingUnit>;

export const IdentityProviders = z.object({
  entra_id: CapabilityStatus,
  okta: CapabilityStatus,
  ping: CapabilityStatus,
  google_workspace: CapabilityStatus,
}).strict();
export type IdentityProviders = z.infer<typeof IdentityProviders>;

export const AgentPlatforms = z.object({
  windows: CapabilityStatus,
  macos: CapabilityStatus,
  ios: CapabilityStatus,
  android: CapabilityStatus,
  linux: CapabilityStatus,
  chromeos: CapabilityStatus,
  agentless: CapabilityStatus,
}).strict();
export type AgentPlatforms = z.infer<typeof AgentPlatforms>;

export const SupportModel = z.object({
  follow_the_sun_24x7: CapabilityStatus,
  uk_support_desk: CapabilityStatus,
  named_tam: CapabilityStatus,
}).strict();
export type SupportModel = z.infer<typeof SupportModel>;

export const Logging = z.object({
  siem_export: CapabilityStatus,
  log_retention_days: z.number().int().positive().nullable(),
}).strict();
export type Logging = z.infer<typeof Logging>;

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

  // Extended dimensions (June 2026): regional coverage, cloud support,
  // AI capability, resilience and deployment velocity
  deployment_speed: DeploymentSpeed,
  regions: Regions,
  supported_clouds: SupportedClouds,
  ai_capability: AiCapability,
  resilience: Resilience,

  // Tier 1 buyer data points and sector capability (June 2026, indicative)
  sectors: Sectors,
  organisation_fit: OrganisationFit,
  pricing_units: z.array(PricingUnit).min(1),
  identity_providers: IdentityProviders,
  device_posture: CapabilityStatus,
  agent_platforms: AgentPlatforms,
  pop_count: z.number().int().positive().nullable(),
  sla_availability_pct: z.number().min(90).max(100).nullable(),
  support_model: SupportModel,
  logging: Logging,

  // Qualitative judgements (Netify editorial)
  key_differentiators: z.array(z.string().min(1)).min(1).max(6),
  best_fit_for: z.array(z.string().min(1)).min(1).max(6),
  watch_outs: z.array(z.string().min(1)).min(1).max(6),

  // Netify marketplace contact route
  marketplace_url: z.string().url().nullable(),

  // One-paragraph card summary shown on the shortlist builder (writer: Harry, June 2026)
  shortlist_summary: z.string().min(60),

  // Editorial profile (Netify desk research, June 2026)
  profile: z.object({
    platform_architecture: z.string().min(100),
    security_sase: z.string().min(100),
    service_support_channel: z.string().min(100),
    commercials_verdict: z.string().min(100),
  }).strict(),
  vendor_faqs: z.array(z.object({
    q: z.string().min(10),
    a: z.string().min(40),
  }).strict()).min(2).max(5),

  // Provenance
  last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "last_verified must be YYYY-MM-DD"),
  verification_notes: z.string().min(1),
}).strict();

export type Vendor = z.infer<typeof VendorSchema>;
