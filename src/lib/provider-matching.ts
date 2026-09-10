import { z } from "zod";

export const PROVIDER_MATCH_METHODOLOGY_VERSION = "provider-match/1.0.0" as const;

const SupportSchema = z.enum(["supported", "partially_supported", "partner_delivered", "not_supported", "unknown", "not_publicly_disclosed", "requires_confirmation"]);
const FreshnessSchema = z.enum(["current", "review_due", "stale", "expired", "source_unavailable"]);
export const ProviderMatchRecordSchema = z.object({
  provider_id: z.string(), slug: z.string(), display_name: z.string(),
  provider_types: z.array(z.enum(["technology_vendor", "managed_service_provider", "carrier_network_provider", "integrator", "hybrid_provider"])),
  revision_id: z.string(), dataset_version: z.string(),
  primary_geographies: z.array(z.string()).default([]),
  reviewed_at: z.string().optional(),
  overview: z.string().default(""),
  product_names: z.array(z.string()).default([]),
  target_buyers: z.array(z.string()).default([]),
  integration_names: z.array(z.string()).default([]),
  evidence_source_count: z.number().int().nonnegative().default(0),
  capabilities: z.record(z.string(), z.object({ support_state: SupportSchema, freshness_state: FreshnessSchema, confidence: z.string(), qualification: z.string().nullable() })),
  regions: z.record(z.string(), z.object({ support_state: SupportSchema, freshness_state: FreshnessSchema })),
  service_models: z.record(z.string(), z.object({ support_state: SupportSchema, freshness_state: FreshnessSchema })),
  sectors: z.record(z.string(), z.object({ support_state: SupportSchema, freshness_state: FreshnessSchema, evidence_strength: z.enum(["strong", "moderate", "weak", "none", "unknown"]) })),
});
export type ProviderMatchRecord = z.infer<typeof ProviderMatchRecordSchema>;

export const ProviderMatchInputSchema = z.object({
  mandatory_capabilities: z.array(z.string()).default([]), preferred_capabilities: z.array(z.string()).default([]),
  required_regions: z.array(z.string()).default([]), service_model: z.string().nullable().default(null), sector: z.string().nullable().default(null),
  provider_scope: z.enum(["technology", "managed", "both"]).default("both"),
});
export type ProviderMatchInput = z.infer<typeof ProviderMatchInputSchema>;

type Contribution = { code: string; kind: "mandatory" | "preference" | "region" | "service_model" | "sector"; points: number; reason: string };
export type InternalProviderVerdict = { provider_id: string; slug: string; display_name: string; provider_types: string[]; eligible: boolean; score: number; mandatory_failures: string[]; unresolved: string[]; contributions: Contribution[]; revision_id: string };
export type InternalProviderMatchResult = { methodology_version: typeof PROVIDER_MATCH_METHODOLOGY_VERSION; dataset_versions: string[]; input: ProviderMatchInput; verdicts: InternalProviderVerdict[] };

const positive = new Set(["supported", "partially_supported", "partner_delivered"]);
const points = { supported: 1, partially_supported: 0.5, partner_delivered: 0.6 } as const;
function usable(record: { support_state: z.infer<typeof SupportSchema>; freshness_state: z.infer<typeof FreshnessSchema> } | undefined) {
  return record && record.freshness_state === "current" && positive.has(record.support_state);
}
function scoped(provider: ProviderMatchRecord, scope: ProviderMatchInput["provider_scope"]) {
  if (scope === "both") return true;
  if (scope === "technology") return provider.provider_types.includes("technology_vendor");
  return provider.provider_types.some((type) => ["managed_service_provider", "carrier_network_provider", "integrator"].includes(type));
}

export function matchProviders(rawInput: ProviderMatchInput, rawProviders: ProviderMatchRecord[]): InternalProviderMatchResult {
  const input = ProviderMatchInputSchema.parse(rawInput);
  const providers = rawProviders.map((provider) => ProviderMatchRecordSchema.parse(provider));
  const verdicts = providers.filter((provider) => scoped(provider, input.provider_scope)).map((provider) => {
    const mandatoryFailures: string[] = [], unresolved: string[] = [], contributions: Contribution[] = [];
    for (const code of input.mandatory_capabilities) {
      const capability = provider.capabilities[code];
      if (!capability || capability.freshness_state !== "current" || ["unknown", "not_publicly_disclosed", "requires_confirmation"].includes(capability.support_state)) unresolved.push(code);
      else if (!positive.has(capability.support_state)) mandatoryFailures.push(code);
      else contributions.push({ code, kind: "mandatory", points: 1, reason: `${capability.support_state} with current evidence` });
    }
    for (const code of input.preferred_capabilities) {
      const capability = provider.capabilities[code];
      if (usable(capability)) contributions.push({ code, kind: "preference", points: points[capability!.support_state as keyof typeof points], reason: `${capability!.support_state} with current evidence` });
      else if (!capability || capability.freshness_state !== "current" || !["not_supported"].includes(capability.support_state)) unresolved.push(code);
    }
    for (const region of input.required_regions) {
      const coverage = provider.regions[region];
      if (!usable(coverage)) (coverage?.support_state === "not_supported" ? mandatoryFailures : unresolved).push(`region:${region}`);
      else contributions.push({ code: region, kind: "region", points: points[coverage!.support_state as keyof typeof points], reason: `${coverage!.support_state} regional evidence` });
    }
    if (input.service_model) {
      const model = provider.service_models[input.service_model];
      if (usable(model)) contributions.push({ code: input.service_model, kind: "service_model", points: points[model!.support_state as keyof typeof points], reason: `${model!.support_state} service model` });
      else unresolved.push(`service_model:${input.service_model}`);
    }
    if (input.sector) {
      const sector = provider.sectors[input.sector];
      if (usable(sector)) {
        const sectorPoints = { strong: 1, moderate: 0.7, weak: 0.35, none: 0, unknown: 0 }[sector!.evidence_strength];
        contributions.push({ code: input.sector, kind: "sector", points: sectorPoints, reason: `${sector!.evidence_strength} sector evidence` });
      } else unresolved.push(`sector:${input.sector}`);
    }
    const denominator = input.mandatory_capabilities.length + input.preferred_capabilities.length + input.required_regions.length + (input.service_model ? 1 : 0) + (input.sector ? 1 : 0);
    const score = denominator ? Math.round(contributions.reduce((sum, row) => sum + row.points, 0) / denominator * 1000) / 10 : 0;
    return { provider_id: provider.provider_id, slug: provider.slug, display_name: provider.display_name, provider_types: provider.provider_types, eligible: mandatoryFailures.length === 0 && unresolved.filter((code) => input.mandatory_capabilities.includes(code) || code.startsWith("region:")).length === 0, score, mandatory_failures: mandatoryFailures, unresolved: [...new Set(unresolved)].sort(), contributions, revision_id: provider.revision_id };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.slug.localeCompare(b.slug));
  return { methodology_version: PROVIDER_MATCH_METHODOLOGY_VERSION, dataset_versions: [...new Set(providers.map((provider) => provider.dataset_version))].sort(), input, verdicts };
}

export function publicProviderMatchPreview(result: InternalProviderMatchResult) {
  const eligible = result.verdicts.filter((row) => row.eligible);
  const technology = eligible.filter((row) => row.provider_types.includes("technology_vendor"));
  const managed = eligible.filter((row) => row.provider_types.some((type) => ["managed_service_provider", "carrier_network_provider", "integrator"].includes(type)));
  const unresolved = [...new Set(result.verdicts.flatMap((row) => row.unresolved))].sort();
  return { methodology_version: result.methodology_version, dataset_versions: result.dataset_versions, considered_count: result.verdicts.length, eligible_technology_count: technology.length, eligible_managed_provider_count: managed.length, meets_all_mandatory_count: eligible.length, capability_coverage: result.input.mandatory_capabilities.map((code) => ({ code, supported_provider_count: result.verdicts.filter((row) => row.contributions.some((item) => item.kind === "mandatory" && item.code === code)).length })), unresolved_requirements: unresolved };
}

export async function revealProviderMatches(projectId: string, result: InternalProviderMatchResult) {
  const { getMarketUnlock } = await import("@/lib/market-unlock");
  const unlock = await getMarketUnlock(projectId);
  if (!unlock) return null;
  return { methodology_version: result.methodology_version, market_unlock_id: unlock.id, published_revision_id: unlock.published_revision_id, matches: result.verdicts.filter((row) => row.eligible).map((row, index) => ({ rank: index + 1, provider_id: row.provider_id, slug: row.slug, name: row.display_name, score: row.score, reasons: row.contributions, unresolved: row.unresolved, provider_revision_id: row.revision_id })) };
}
