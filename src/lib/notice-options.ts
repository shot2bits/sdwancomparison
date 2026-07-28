/**
 * Option catalogues for the project notice builder, the public notice page and
 * the opportunity API. One source of truth so the wizard, server rendering and
 * validation never drift.
 */

export const SECTORS = [
  { key: "healthcare", label: "Healthcare & pharma" },
  { key: "financial_services", label: "Financial services" },
  { key: "retail_ecommerce", label: "Retail & e-commerce" },
  { key: "manufacturing", label: "Manufacturing" },
  { key: "energy_utilities", label: "Energy & utilities" },
  { key: "government_public_sector", label: "Government & public sector" },
  { key: "education", label: "Education" },
  { key: "transport_logistics", label: "Transport & logistics" },
  { key: "professional_services", label: "Professional services" },
  { key: "hospitality_leisure", label: "Hospitality & leisure" },
  { key: "other", label: "Other" },
  // Unstated is a value, not a gap to fill (the intake-truth law, 28 Jul
  // 2026). A buyer may explicitly decline to name a sector; the public
  // record then says "Not stated" and never a guess. The quality gate
  // requires one or the other before a notice reaches a public surface.
  { key: "not_stated", label: "Not stated" },
] as const;

export const SIZE_BANDS = [
  { key: "small", label: "Small (under 100 employees)" },
  { key: "mid_market", label: "Mid-market (100–1,000 employees)" },
  { key: "enterprise", label: "Enterprise (1,000–10,000 employees)" },
  { key: "large_global", label: "Large global (10,000+ employees)" },
] as const;

export const SITES_BANDS = [
  { key: "1-5", label: "1–5 sites" },
  { key: "6-20", label: "6–20 sites" },
  { key: "21-50", label: "21–50 sites" },
  { key: "51-200", label: "51–200 sites" },
  { key: "200+", label: "200+ sites" },
] as const;

/**
 * Public site bands (Robert's re-identification ruling, 28 Jul 2026: always
 * bands on the open surface). Exact site counts identify anonymous buyers in
 * combination with sector and region, so every public surface — board, notice
 * page, data.json twins, derived titles, MCP reads — renders the band, never
 * the figure. Exact counts stay with the buyer's own signed-in face and with
 * participating suppliers after the gate. This ladder is the ruled public
 * vocabulary; SITES_BANDS above stays the wizard's coarser input catalogue.
 */
export const SITE_PUBLIC_BANDS = [
  { key: "1-5", label: "1–5 sites", min: 1, max: 5 },
  { key: "6-20", label: "6–20 sites", min: 6, max: 20 },
  { key: "21-50", label: "21–50 sites", min: 21, max: 50 },
  { key: "51-200", label: "51–200 sites", min: 51, max: 200 },
  { key: "201-500", label: "201–500 sites", min: 201, max: 500 },
  { key: "501-1000", label: "501–1,000 sites", min: 501, max: 1000 },
  { key: "1000+", label: "1,000+ sites", min: 1001, max: Infinity },
] as const;

/** The public band label for an exact site count, or null when no count is stated. */
export function siteBandLabelFor(sites: number | null | undefined): string | null {
  if (typeof sites !== "number" || !Number.isFinite(sites) || sites < 1) return null;
  const band = SITE_PUBLIC_BANDS.find((b) => sites >= b.min && sites <= b.max);
  return band ? band.label : null;
}

export const USERS_BANDS = [
  { key: "under_100", label: "Under 100 users" },
  { key: "100-500", label: "100–500 users" },
  { key: "500-2500", label: "500–2,500 users" },
  { key: "2500-10000", label: "2,500–10,000 users" },
  { key: "10000+", label: "10,000+ users" },
] as const;

export const REGIONS = [
  { key: "uk_ireland", label: "UK & Ireland" },
  { key: "europe", label: "Europe" },
  { key: "north_america", label: "North America" },
  { key: "asia_pacific", label: "Asia Pacific" },
  { key: "middle_east_africa", label: "Middle East & Africa" },
  { key: "latin_america", label: "Latin America" },
] as const;

export const CLOUD_PLATFORMS = [
  { key: "aws", label: "AWS" },
  { key: "azure", label: "Microsoft Azure" },
  { key: "gcp", label: "Google Cloud" },
  { key: "oracle_cloud", label: "Oracle Cloud" },
  { key: "microsoft_365", label: "Microsoft 365" },
  { key: "private_dc", label: "Private data centre" },
] as const;

export const COMPLIANCE_OPTIONS = [
  { key: "uk_gdpr", label: "UK GDPR" },
  { key: "iso_27001", label: "ISO 27001" },
  { key: "pci_dss", label: "PCI DSS" },
  { key: "cyber_essentials", label: "Cyber Essentials" },
  { key: "dora", label: "DORA" },
  { key: "nis2", label: "NIS2" },
  { key: "hipaa", label: "HIPAA" },
  { key: "soc2", label: "SOC 2" },
] as const;

export const EVIDENCE_OPTIONS = [
  { key: "sector_references", label: "Sector references at similar scale" },
  { key: "coverage_evidence", label: "Coverage / PoP evidence for our regions" },
  { key: "security_certifications", label: "Security certifications and attestations" },
  { key: "sla_schedule", label: "SLA schedule and service credits" },
  { key: "migration_plan", label: "Migration approach and plan outline" },
  { key: "support_model", label: "Support model and escalation path" },
  { key: "pricing_structure", label: "Pricing structure and rate card" },
  { key: "case_studies", label: "Case studies with measurable outcomes" },
] as const;

export const EVALUATION_PRIORITIES = [
  { key: "price", label: "Price" },
  { key: "coverage", label: "Coverage" },
  { key: "security_capability", label: "Security capability" },
  { key: "managed_service", label: "Managed service quality" },
  { key: "sla", label: "SLA" },
  { key: "sector_experience", label: "Sector experience" },
  { key: "migration_approach", label: "Migration approach" },
  { key: "commercial_flexibility", label: "Commercial flexibility" },
  { key: "references", label: "References" },
] as const;

/** Board scope tags (opportunity-types OPP_SCOPES), in buyer English.
 *  Added 24 July 2026 (Harry: the room read "Scope: sase, managed_service").
 *  Every surface that renders scope tags speaks through this catalogue. */
export const OPP_SCOPE_TAGS = [
  { key: "underlay_circuits", label: "Underlay circuits" },
  { key: "sd_wan", label: "SD-WAN" },
  { key: "sse", label: "SSE" },
  { key: "sase", label: "SASE" },
  { key: "managed_service", label: "Managed service" },
  { key: "firewall_fwaas", label: "Firewall & FWaaS" },
  { key: "ztna", label: "ZTNA" },
  { key: "swg", label: "SWG" },
  { key: "casb", label: "CASB" },
  { key: "connectivity", label: "Connectivity" },
  { key: "managed_security", label: "Managed security" },
  { key: "not_sure", label: "Scope to be confirmed" },
] as const;

/** Organisation sizes as the RFP data model states them (distinct keys from
 *  the notice wizard's SIZE_BANDS). Added 24 July 2026 so publish emails and
 *  documents stop rendering "large global enterprise" in lowercase. */
export const RFP_ORG_SIZES = [
  { key: "large_global_enterprise", label: "Large global enterprise" },
  { key: "mid_market", label: "Mid-market" },
  { key: "small_business", label: "Small business" },
] as const;

export function labelFor(list: readonly { key: string; label: string }[], key: string): string {
  return list.find((o) => o.key === key)?.label ?? key;
}

export function labelsFor(list: readonly { key: string; label: string }[], keys: string[]): string[] {
  return keys.map((k) => labelFor(list, k));
}
