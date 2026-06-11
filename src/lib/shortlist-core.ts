/**
 * Shortlist engine core. Client-safe: no Node imports, pure functions only.
 *
 * One source of truth for:
 *  - the page client island (ShortlistBuilder)
 *  - the MCP tool at /api/mcp/
 *  - the Claude agent at /api/agent/
 *  - the JSON twin at /shortlist/data.json
 *
 * Keep these consumers in lockstep. If you change scoring here, every
 * surface changes together, which is the point.
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Types mirrored from data/schema.ts (kept dependency-free)           */
/* ------------------------------------------------------------------ */

export type CapabilityStatus =
  | "yes"
  | "partial"
  | "partner_integrated"
  | "managed_service_dependent"
  | "not_primary"
  | "unknown";

export type DeploymentSpeed = "hours" | "days" | "weeks" | "months" | "unknown";

export const REGION_KEYS = [
  "uk_ireland",
  "europe",
  "north_america",
  "asia_pacific",
  "middle_east_africa",
  "latin_america",
  "china_mainland",
] as const;
export type RegionKey = (typeof REGION_KEYS)[number];

export const CLOUD_KEYS = [
  "aws",
  "azure",
  "gcp",
  "oracle_cloud",
  "alibaba_cloud",
] as const;
export type CloudKey = (typeof CLOUD_KEYS)[number];

export const AI_KEYS = [
  "ai_driven_operations",
  "ai_security_analytics",
  "ai_assistant",
] as const;
export type AiKey = (typeof AI_KEYS)[number];

export const REGION_LABELS: Record<RegionKey, string> = {
  uk_ireland: "UK and Ireland",
  europe: "Europe",
  north_america: "North America",
  asia_pacific: "Asia Pacific",
  middle_east_africa: "Middle East and Africa",
  latin_america: "Latin America",
  china_mainland: "China (mainland)",
};

export const CLOUD_LABELS: Record<CloudKey, string> = {
  aws: "AWS",
  azure: "Microsoft Azure",
  gcp: "Google Cloud",
  oracle_cloud: "Oracle Cloud",
  alibaba_cloud: "Alibaba Cloud",
};

export const AI_LABELS: Record<AiKey, string> = {
  ai_driven_operations: "AI-driven operations (AIOps)",
  ai_security_analytics: "AI security analytics",
  ai_assistant: "AI assistant / copilot",
};

export const SECTOR_KEYS = [
  "healthcare",
  "financial_services",
  "retail_ecommerce",
  "manufacturing",
  "energy_utilities",
  "government_public_sector",
  "education",
  "transport_logistics",
  "professional_services",
  "hospitality_leisure",
] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];

export const SECTOR_LABELS: Record<SectorKey, string> = {
  healthcare: "Healthcare",
  financial_services: "Financial services",
  retail_ecommerce: "Retail and e-commerce",
  manufacturing: "Manufacturing",
  energy_utilities: "Energy and utilities",
  government_public_sector: "Government and public sector",
  education: "Education",
  transport_logistics: "Transport and logistics",
  professional_services: "Professional services",
  hospitality_leisure: "Hospitality and leisure",
};

export const ORG_SIZE_KEYS = [
  "large_global_enterprise",
  "mid_market",
  "small_business",
] as const;
export type OrgSizeKey = (typeof ORG_SIZE_KEYS)[number];

export const ORG_SIZE_LABELS: Record<OrgSizeKey, string> = {
  large_global_enterprise: "Large global enterprise",
  mid_market: "Mid-market",
  small_business: "Small business",
};

export const INTENT_KEYS = [
  "cost_saving",
  "mpls_migration",
  "rapid_deployment",
  "remote_workforce",
  "security_consolidation",
  "global_expansion",
] as const;
export type IntentKey = (typeof INTENT_KEYS)[number];

export const INTENT_LABELS: Record<IntentKey, string> = {
  cost_saving: "Cost saving",
  mpls_migration: "MPLS migration",
  rapid_deployment: "Rapid deployment",
  remote_workforce: "Remote and hybrid workforce",
  security_consolidation: "Security consolidation",
  global_expansion: "Global expansion",
};

/** Buyer intent presets: extra preferred features and optional overrides. */
export const INTENT_PRESETS: Record<
  IntentKey,
  { preferred: string[]; weight_preset?: WeightPreset; max_speed?: "hours" | "days" | "weeks" | "months" }
> = {
  cost_saving: {
    preferred: ["f08_flexible_commercial_model", "f15_local_internet_breakout", "f16_mpls_coexistence_and_migration"],
  },
  mpls_migration: {
    preferred: ["f16_mpls_coexistence_and_migration", "f10_dynamic_path_selection", "f06_last_mile_circuit_management"],
    weight_preset: "network_led",
  },
  rapid_deployment: {
    preferred: ["f24_flexible_edge_form_factors", "f17_cellular_and_5g_support"],
    max_speed: "weeks",
  },
  remote_workforce: {
    preferred: ["f34_remote_user_access", "f30_zero_trust_network_access", "f31_secure_web_gateway"],
  },
  security_consolidation: {
    preferred: ["f28_full_sase_platform", "f27_integrated_next_generation_firewall", "f36_centralised_orchestration"],
    weight_preset: "security_led",
  },
  global_expansion: {
    preferred: ["f21_private_global_backbone", "f22_regional_breakout_and_data_residency", "f20_private_pops_dedicated_pops"],
    weight_preset: "cloud_first",
  },
};

export const STATUS_LABELS: Record<CapabilityStatus, string> = {
  yes: "Yes, public evidence",
  partial: "Partial",
  partner_integrated: "Via partner",
  managed_service_dependent: "Via managed service",
  not_primary: "Not primary",
  unknown: "Not confirmed",
};

/** Compact vendor record shipped to the client and used by every surface. */
export type ShortlistVendor = {
  slug: string;
  name: string;
  website: string;
  category: string;
  product_focus?: string;
  cost_model: string;
  public_pricing_visibility: "public" | "partial_public" | "quote_based";
  capabilities: Record<string, CapabilityStatus>;
  deployment_speed: DeploymentSpeed;
  regions: Record<RegionKey, CapabilityStatus>;
  supported_clouds: Record<CloudKey, CapabilityStatus>;
  ai_capability: Record<AiKey, CapabilityStatus> & { note: string };
  resilience: { disaster_recovery: CapabilityStatus; note: string };
  sectors: Record<SectorKey, CapabilityStatus>;
  organisation_fit: Record<OrgSizeKey, CapabilityStatus>;
  pricing_units: string[];
  identity_providers: Record<string, CapabilityStatus>;
  device_posture: CapabilityStatus;
  agent_platforms: Record<string, CapabilityStatus>;
  pop_count: number | null;
  sla_availability_pct: number | null;
  support_model: Record<string, CapabilityStatus>;
  logging: { siem_export: CapabilityStatus; log_retention_days: number | null };
  marketplace_url: string | null;
  key_differentiators: string[];
  best_fit_for: string[];
  watch_outs: string[];
  evidence_coverage_pct: number;
  last_verified: string;
};

/* ------------------------------------------------------------------ */
/* Input schema (Zod). Shared by UI, MCP tool and agent.               */
/* ------------------------------------------------------------------ */

export const SERVICE_MODELS = ["managed", "co_managed", "diy", "any"] as const;
export const WEIGHT_PRESETS = [
  "balanced",
  "security_led",
  "network_led",
  "cloud_first",
  "managed_service_led",
] as const;
export type WeightPreset = (typeof WEIGHT_PRESETS)[number];

export const ShortlistInputSchema = z.object({
  service_model: z.enum(SERVICE_MODELS).default("any"),
  required_features: z.array(z.string()).default([]),
  preferred_features: z.array(z.string()).default([]),
  required_regions: z.array(z.enum(REGION_KEYS)).default([]),
  required_clouds: z.array(z.enum(CLOUD_KEYS)).default([]),
  ai_requirements: z.array(z.enum(AI_KEYS)).default([]),
  disaster_recovery_required: z.boolean().default(false),
  max_deployment_speed: z
    .enum(["hours", "days", "weeks", "months", "any"])
    .default("any"),
  weight_preset: z.enum(WEIGHT_PRESETS).default("balanced"),
  shortlist_size: z.number().int().min(3).max(30).default(8),
  sector: z.enum(SECTOR_KEYS).nullable().default(null),
  organisation_size: z.enum([...ORG_SIZE_KEYS, "any"] as const).default("any"),
  intent: z.enum([...INTENT_KEYS, "none"] as const).default("none"),
});
export type ShortlistInput = z.infer<typeof ShortlistInputSchema>;

export const DEFAULT_INPUT: ShortlistInput = ShortlistInputSchema.parse({});

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** Evidence-weighted points per status grade. */
export const STATUS_POINTS: Record<CapabilityStatus, number> = {
  yes: 1.0,
  partner_integrated: 0.75,
  managed_service_dependent: 0.65,
  partial: 0.5,
  unknown: 0.15,
  not_primary: 0,
};

/** A status that satisfies a hard requirement. */
const SATISFIES: CapabilityStatus[] = [
  "yes",
  "partial",
  "partner_integrated",
  "managed_service_dependent",
];

const SPEED_ORDER: Record<DeploymentSpeed, number> = {
  hours: 1,
  days: 2,
  weeks: 3,
  months: 4,
  unknown: 5,
};

/** Feature id prefix to category weighting bucket. */
type Bucket = "service" | "network" | "backbone" | "security" | "operations";

function featureBucket(featureId: string): Bucket {
  const n = parseInt(featureId.slice(1, 3), 10);
  if (n <= 8) return "service";
  if (n <= 18) return "network";
  if (n <= 26) return "backbone";
  if (n <= 35) return "security";
  return "operations";
}

const PRESET_WEIGHTS: Record<WeightPreset, Record<Bucket, number>> = {
  balanced: { service: 1, network: 1, backbone: 1, security: 1, operations: 1 },
  security_led: { service: 0.8, network: 0.8, backbone: 0.9, security: 1.8, operations: 1 },
  network_led: { service: 0.9, network: 1.7, backbone: 1.4, security: 0.8, operations: 1 },
  cloud_first: { service: 0.8, network: 1.2, backbone: 1.5, security: 1.2, operations: 1 },
  managed_service_led: { service: 1.9, network: 1, backbone: 1, security: 1, operations: 1.3 },
};

export type VendorVerdict = {
  slug: string;
  name: string;
  rank: number;
  score: number;
  eligible: boolean;
  gating_failures: string[];
  matched_requirements: string[];
  gaps: string[];
  summary: string;
  category: string;
  deployment_speed: DeploymentSpeed;
  cost_model: string;
  key_differentiators: string[];
  best_fit_for: string[];
  watch_outs: string[];
  evidence_coverage_pct: number;
  website: string;
  marketplace_url: string | null;
};

export type ShortlistResult = {
  input: ShortlistInput;
  criteria_summary: string;
  considered: number;
  excluded: number;
  shortlist: VendorVerdict[];
  near_misses: VendorVerdict[];
  generated_at: string;
  methodology_note: string;
};

const SERVICE_MODEL_FEATURE: Record<string, string> = {
  managed: "f01_fully_managed_service",
  co_managed: "f03_co_managed_service",
  diy: "f02_diy_self_managed_model",
};

export function describeCriteria(input: ShortlistInput, featureNames: Record<string, string>): string {
  const parts: string[] = [];
  if (input.service_model !== "any") {
    const labels: Record<string, string> = {
      managed: "fully managed service",
      co_managed: "co-managed service",
      diy: "DIY / self-managed",
    };
    parts.push(`Operating model: ${labels[input.service_model]}`);
  }
  if (input.required_features.length > 0) {
    parts.push(
      `Required: ${input.required_features.map((f) => featureNames[f] ?? f).join(", ")}`,
    );
  }
  if (input.preferred_features.length > 0) {
    parts.push(
      `Preferred: ${input.preferred_features.map((f) => featureNames[f] ?? f).join(", ")}`,
    );
  }
  if (input.required_regions.length > 0) {
    parts.push(`Regions: ${input.required_regions.map((r) => REGION_LABELS[r]).join(", ")}`);
  }
  if (input.required_clouds.length > 0) {
    parts.push(`Clouds: ${input.required_clouds.map((c) => CLOUD_LABELS[c]).join(", ")}`);
  }
  if (input.ai_requirements.length > 0) {
    parts.push(`AI: ${input.ai_requirements.map((a) => AI_LABELS[a]).join(", ")}`);
  }
  if (input.disaster_recovery_required) parts.push("Disaster recovery evidence required");
  if (input.max_deployment_speed !== "any") {
    parts.push(`Deployment within: ${input.max_deployment_speed}`);
  }
  if (input.sector) parts.unshift(`Sector: ${SECTOR_LABELS[input.sector]}`);
  if (input.organisation_size !== "any") {
    parts.unshift(`Organisation: ${ORG_SIZE_LABELS[input.organisation_size]}`);
  }
  if (input.intent !== "none") parts.unshift(`Priority: ${INTENT_LABELS[input.intent]}`);
  parts.push(`Scoring profile: ${input.weight_preset.replace(/_/g, " ")}`);
  return parts.join(". ") + ".";
}

/**
 * Build the shortlist. Pure function: same inputs always give the same output.
 * Verdict logic is mirrored nowhere; every surface calls this directly.
 */
export function buildShortlist(
  vendors: ShortlistVendor[],
  rawInput: unknown,
  featureNames: Record<string, string> = {},
): ShortlistResult {
  const parsed = ShortlistInputSchema.parse(rawInput ?? {});
  // Apply buyer intent preset (non-destructive: merges preferences)
  const preset = parsed.intent !== "none" ? INTENT_PRESETS[parsed.intent] : null;
  const input: ShortlistInput = preset
    ? {
        ...parsed,
        preferred_features: Array.from(new Set([...parsed.preferred_features, ...preset.preferred])),
        weight_preset:
          parsed.weight_preset === "balanced" && preset.weight_preset
            ? preset.weight_preset
            : parsed.weight_preset,
        max_deployment_speed:
          parsed.max_deployment_speed === "any" && preset.max_speed
            ? preset.max_speed
            : parsed.max_deployment_speed,
      }
    : parsed;
  const verdicts: VendorVerdict[] = [];

  for (const v of vendors) {
    const gating: string[] = [];
    const matched: string[] = [];
    const gaps: string[] = [];

    // Gate 1: operating model
    if (input.service_model !== "any") {
      const fid = SERVICE_MODEL_FEATURE[input.service_model];
      const status = v.capabilities[fid] ?? "unknown";
      if (!SATISFIES.includes(status)) {
        gating.push(`No evidence of ${input.service_model.replace(/_/g, "-")} model`);
      } else {
        matched.push(featureNames[fid] ?? fid);
      }
    }

    // Gate 2: required features
    for (const fid of input.required_features) {
      const status = v.capabilities[fid] ?? "unknown";
      const label = featureNames[fid] ?? fid;
      if (!SATISFIES.includes(status)) {
        gating.push(`Missing required: ${label}`);
      } else {
        matched.push(label);
        if (status !== "yes") gaps.push(`${label}: ${STATUS_LABELS[status]}`);
      }
    }

    // Gate 3: regions
    for (const r of input.required_regions) {
      const status = v.regions[r];
      if (!SATISFIES.includes(status)) {
        gating.push(`No confirmed coverage: ${REGION_LABELS[r]}`);
      } else {
        matched.push(`Coverage: ${REGION_LABELS[r]}`);
        if (status !== "yes") gaps.push(`${REGION_LABELS[r]}: ${STATUS_LABELS[status]}`);
      }
    }

    // Gate 4: clouds
    for (const c of input.required_clouds) {
      const status = v.supported_clouds[c];
      if (!SATISFIES.includes(status)) {
        gating.push(`No confirmed support: ${CLOUD_LABELS[c]}`);
      } else {
        matched.push(`Cloud: ${CLOUD_LABELS[c]}`);
        if (status !== "yes") gaps.push(`${CLOUD_LABELS[c]}: ${STATUS_LABELS[status]}`);
      }
    }

    // Gate 5: AI requirements
    for (const a of input.ai_requirements) {
      const status = v.ai_capability[a];
      if (!SATISFIES.includes(status)) {
        gating.push(`No confirmed capability: ${AI_LABELS[a]}`);
      } else {
        matched.push(AI_LABELS[a]);
        if (status !== "yes") gaps.push(`${AI_LABELS[a]}: ${STATUS_LABELS[status]}`);
      }
    }

    // Gate 6: disaster recovery
    if (input.disaster_recovery_required) {
      const status = v.resilience.disaster_recovery;
      if (!SATISFIES.includes(status)) {
        gating.push("No confirmed disaster recovery evidence");
      } else {
        matched.push("Disaster recovery");
        if (status !== "yes") gaps.push(`Disaster recovery: ${STATUS_LABELS[status]}`);
      }
    }

    // Gate 7: sector capability
    if (input.sector) {
      const status = v.sectors[input.sector];
      if (!SATISFIES.includes(status)) {
        gating.push(`No confirmed sector evidence: ${SECTOR_LABELS[input.sector]}`);
      } else {
        matched.push(`Sector: ${SECTOR_LABELS[input.sector]}`);
        if (status !== "yes") gaps.push(`${SECTOR_LABELS[input.sector]}: ${STATUS_LABELS[status]}`);
      }
    }

    // Gate 8: organisation size fit
    if (input.organisation_size !== "any") {
      const status = v.organisation_fit[input.organisation_size];
      if (!SATISFIES.includes(status)) {
        gating.push(`Not positioned for ${ORG_SIZE_LABELS[input.organisation_size].toLowerCase()}`);
      } else {
        matched.push(`Fit: ${ORG_SIZE_LABELS[input.organisation_size]}`);
        if (status !== "yes") gaps.push(`${ORG_SIZE_LABELS[input.organisation_size]}: ${STATUS_LABELS[status]}`);
      }
    }

    // Gate 9: deployment speed ceiling
    if (input.max_deployment_speed !== "any") {
      const ceiling = SPEED_ORDER[input.max_deployment_speed as DeploymentSpeed];
      if (SPEED_ORDER[v.deployment_speed] > ceiling) {
        gating.push(
          `Typical deployment (${v.deployment_speed}) exceeds your ceiling (${input.max_deployment_speed})`,
        );
      } else {
        matched.push(`Deploys within ${input.max_deployment_speed} (typically ${v.deployment_speed})`);
      }
    }

    // Weighted score across all 40 features plus extended dimensions
    const weights = PRESET_WEIGHTS[input.weight_preset];
    let weighted = 0;
    let weightTotal = 0;
    for (const [fid, status] of Object.entries(v.capabilities)) {
      let w = weights[featureBucket(fid)];
      if (input.preferred_features.includes(fid)) w *= 2.2;
      if (input.required_features.includes(fid)) w *= 1.6;
      weighted += STATUS_POINTS[status] * w;
      weightTotal += w;
    }
    // Extended dimensions contribute when the buyer asked about them
    for (const r of input.required_regions) {
      weighted += STATUS_POINTS[v.regions[r]] * 1.5;
      weightTotal += 1.5;
    }
    for (const c of input.required_clouds) {
      weighted += STATUS_POINTS[v.supported_clouds[c]] * 1.5;
      weightTotal += 1.5;
    }
    for (const a of input.ai_requirements) {
      weighted += STATUS_POINTS[v.ai_capability[a]] * 1.5;
      weightTotal += 1.5;
    }
    if (input.disaster_recovery_required) {
      weighted += STATUS_POINTS[v.resilience.disaster_recovery] * 1.5;
      weightTotal += 1.5;
    }
    if (input.sector) {
      weighted += STATUS_POINTS[v.sectors[input.sector]] * 2;
      weightTotal += 2;
    }
    if (input.organisation_size !== "any") {
      weighted += STATUS_POINTS[v.organisation_fit[input.organisation_size]] * 1.5;
      weightTotal += 1.5;
    }

    const score = Math.round((weighted / weightTotal) * 1000) / 10;
    const eligible = gating.length === 0;

    const summary = eligible
      ? `${v.name} meets every stated requirement with a weighted capability score of ${score}. ${v.key_differentiators[0] ?? ""}`
      : `${v.name} excluded: ${gating[0]}${gating.length > 1 ? ` (and ${gating.length - 1} more)` : ""}.`;

    verdicts.push({
      slug: v.slug,
      name: v.name,
      rank: 0,
      score,
      eligible,
      gating_failures: gating,
      matched_requirements: matched,
      gaps,
      summary,
      category: v.category,
      deployment_speed: v.deployment_speed,
      cost_model: v.cost_model,
      key_differentiators: v.key_differentiators,
      best_fit_for: v.best_fit_for,
      watch_outs: v.watch_outs,
      evidence_coverage_pct: v.evidence_coverage_pct,
      website: v.website,
      marketplace_url: v.marketplace_url,
    });
  }

  const eligible = verdicts
    .filter((x) => x.eligible)
    .sort((a, b) => b.score - a.score);
  const excluded = verdicts
    .filter((x) => !x.eligible)
    .sort((a, b) => b.score - a.score);

  const shortlist = eligible.slice(0, input.shortlist_size);
  shortlist.forEach((x, i) => (x.rank = i + 1));
  const nearMisses = [...eligible.slice(input.shortlist_size), ...excluded].slice(0, 5);

  return {
    input,
    criteria_summary: describeCriteria(input, featureNames),
    considered: vendors.length,
    excluded: excluded.length,
    shortlist,
    near_misses: nearMisses,
    generated_at: new Date().toISOString(),
    methodology_note:
      "Scores weight public evidence grades across 40 capability features plus the dimensions you required. Grades: yes 1.0, via partner 0.75, via managed service 0.65, partial 0.5, not confirmed 0.15, not primary 0. Extended dimensions are indicative desk research; confirm via RFP.",
  };
}

/* ------------------------------------------------------------------ */
/* URL state encoding                                                  */
/* ------------------------------------------------------------------ */

export function encodeScenario(input: ShortlistInput): string {
  const p = new URLSearchParams();
  if (input.service_model !== "any") p.set("m", input.service_model);
  if (input.required_features.length) p.set("f", input.required_features.map(shortFid).join("."));
  if (input.preferred_features.length) p.set("p", input.preferred_features.map(shortFid).join("."));
  if (input.required_regions.length) p.set("r", input.required_regions.join("."));
  if (input.required_clouds.length) p.set("c", input.required_clouds.join("."));
  if (input.ai_requirements.length)
    p.set("ai", input.ai_requirements.map((a) => a.replace("ai_", "").slice(0, 3)).join("."));
  if (input.disaster_recovery_required) p.set("dr", "1");
  if (input.max_deployment_speed !== "any") p.set("ds", input.max_deployment_speed);
  if (input.weight_preset !== "balanced") p.set("w", input.weight_preset);
  if (input.shortlist_size !== 8) p.set("n", String(input.shortlist_size));
  if (input.sector) p.set("s", input.sector);
  if (input.organisation_size !== "any") p.set("o", input.organisation_size);
  if (input.intent !== "none") p.set("i", input.intent);
  return p.toString();
}

function shortFid(fid: string): string {
  return fid.slice(0, 3); // f01 ... f40
}

export function decodeScenario(
  search: string,
  allFeatureIds: string[],
): ShortlistInput {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const byShort: Record<string, string> = {};
  for (const fid of allFeatureIds) byShort[fid.slice(0, 3)] = fid;

  const expand = (raw: string | null): string[] =>
    (raw ?? "")
      .split(".")
      .map((s) => byShort[s])
      .filter((x): x is string => Boolean(x));

  const aiBack: Record<string, AiKey> = {
    dri: "ai_driven_operations",
    sec: "ai_security_analytics",
    ass: "ai_assistant",
  };

  const candidate = {
    service_model: p.get("m") ?? "any",
    required_features: expand(p.get("f")),
    preferred_features: expand(p.get("p")),
    required_regions: (p.get("r") ?? "").split(".").filter((x) => (REGION_KEYS as readonly string[]).includes(x)),
    required_clouds: (p.get("c") ?? "").split(".").filter((x) => (CLOUD_KEYS as readonly string[]).includes(x)),
    ai_requirements: (p.get("ai") ?? "")
      .split(".")
      .map((s) => aiBack[s])
      .filter((x): x is AiKey => Boolean(x)),
    disaster_recovery_required: p.get("dr") === "1",
    max_deployment_speed: p.get("ds") ?? "any",
    weight_preset: p.get("w") ?? "balanced",
    shortlist_size: p.get("n") ? Number(p.get("n")) : 8,
    sector: (SECTOR_KEYS as readonly string[]).includes(p.get("s") ?? "") ? p.get("s") : null,
    organisation_size: p.get("o") ?? "any",
    intent: p.get("i") ?? "none",
  };

  const parsed = ShortlistInputSchema.safeParse(candidate);
  return parsed.success ? parsed.data : DEFAULT_INPUT;
}

/* ------------------------------------------------------------------ */
/* Vendor comparison                                                   */
/* ------------------------------------------------------------------ */

export type CompareRow = {
  key: string;
  label: string;
  grades: Record<string, CapabilityStatus | string>;
};

export type CompareGroup = { name: string; rows: CompareRow[] };

export type ComparisonResult = {
  slugs: string[];
  names: Record<string, string>;
  meta: Record<
    string,
    { category: string; deployment_speed: DeploymentSpeed; cost_model: string; score: number; website: string; marketplace_url: string | null }
  >;
  groups: CompareGroup[];
  wins: Record<string, string[]>;
  even: string[];
  summary: string;
};

/**
 * Feature-by-feature comparison for 2 or 3 vendors. Pure function shared
 * by the compare pages, the in-tool panel and the AI assistant.
 */
export function buildComparison(
  vendors: ShortlistVendor[],
  slugs: string[],
  featureMeta: { id: string; name: string; category: string }[],
): ComparisonResult | null {
  const chosen = slugs
    .map((s) => vendors.find((v) => v.slug === s))
    .filter((v): v is ShortlistVendor => Boolean(v));
  if (chosen.length < 2) return null;

  const balanced = buildShortlist(vendors, { shortlist_size: 30 }, {});
  const scoreOf = (slug: string) =>
    balanced.shortlist.find((x) => x.slug === slug)?.score ?? 0;

  const groups: CompareGroup[] = [];
  const categories = Array.from(new Set(featureMeta.map((f) => f.category)));
  for (const cat of categories) {
    groups.push({
      name: cat,
      rows: featureMeta
        .filter((f) => f.category === cat)
        .map((f) => ({
          key: f.id,
          label: f.name,
          grades: Object.fromEntries(chosen.map((v) => [v.slug, v.capabilities[f.id] ?? "unknown"])),
        })),
    });
  }
  groups.push({
    name: "Regional coverage",
    rows: REGION_KEYS.map((r) => ({
      key: r,
      label: REGION_LABELS[r],
      grades: Object.fromEntries(chosen.map((v) => [v.slug, v.regions[r]])),
    })),
  });
  groups.push({
    name: "Cloud platforms",
    rows: CLOUD_KEYS.map((c) => ({
      key: c,
      label: CLOUD_LABELS[c],
      grades: Object.fromEntries(chosen.map((v) => [v.slug, v.supported_clouds[c]])),
    })),
  });
  groups.push({
    name: "AI capability and resilience",
    rows: [
      ...AI_KEYS.map((a) => ({
        key: a as string,
        label: AI_LABELS[a],
        grades: Object.fromEntries(chosen.map((v) => [v.slug, v.ai_capability[a]])),
      })),
      {
        key: "disaster_recovery",
        label: "Disaster recovery",
        grades: Object.fromEntries(chosen.map((v) => [v.slug, v.resilience.disaster_recovery])),
      },
      {
        key: "deployment_speed",
        label: "Typical deployment speed",
        grades: Object.fromEntries(chosen.map((v) => [v.slug, v.deployment_speed])),
      },
    ],
  });

  // Per-feature wins (clear point advantages on the 40-feature matrix)
  const wins: Record<string, string[]> = Object.fromEntries(chosen.map((v) => [v.slug, []]));
  const even: string[] = [];
  for (const f of featureMeta) {
    const pts = chosen.map((v) => ({ slug: v.slug, p: STATUS_POINTS[v.capabilities[f.id] ?? "unknown"] }));
    const max = Math.max(...pts.map((x) => x.p));
    const leaders = pts.filter((x) => x.p === max);
    if (leaders.length === 1 && max > 0) {
      wins[leaders[0].slug].push(f.name);
    } else {
      even.push(f.name);
    }
  }

  const names = Object.fromEntries(chosen.map((v) => [v.slug, v.name]));
  const summary = `${chosen
    .map((v) => `${v.name} scores ${scoreOf(v.slug)}`)
    .join("; ")} on the Netify 40-feature balanced matrix (June 2026). ${chosen
    .map((v) => `${v.name} leads on ${wins[v.slug].length} features`)
    .join("; ")}; ${even.length} features are level.`;

  return {
    slugs: chosen.map((v) => v.slug),
    names,
    meta: Object.fromEntries(
      chosen.map((v) => [
        v.slug,
        {
          category: v.category,
          deployment_speed: v.deployment_speed,
          cost_model: v.cost_model,
          score: scoreOf(v.slug),
          website: v.website,
          marketplace_url: v.marketplace_url,
        },
      ]),
    ),
    groups,
    wins,
    even,
    summary,
  };
}
