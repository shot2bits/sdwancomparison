import assert from "node:assert/strict";
import fs from "node:fs";
import { matchProviders, publicProviderMatchPreview, PROVIDER_MATCH_METHODOLOGY_VERSION, type ProviderMatchRecord } from "../src/lib/provider-matching";

const base = (overrides: Partial<ProviderMatchRecord>): ProviderMatchRecord => ({ provider_id: "provider:base", slug: "base", display_name: "Base", provider_types: ["technology_vendor"], revision_id: "rev-1", dataset_version: "data-1", primary_geographies: [], overview: "", product_names: [], target_buyers: [], integration_names: [], evidence_source_count: 0, capabilities: {}, regions: {}, service_models: {}, sectors: {}, ...overrides });
const providers = [
  base({ provider_id: "provider:native", slug: "native", display_name: "Native", capabilities: { ztna: { support_state: "supported", freshness_state: "current", confidence: "high", qualification: null }, casb: { support_state: "supported", freshness_state: "stale", confidence: "high", qualification: null } }, regions: { uk: { support_state: "supported", freshness_state: "current" } }, sectors: { healthcare: { support_state: "supported", freshness_state: "current", evidence_strength: "strong" } } }),
  base({ provider_id: "provider:partner", slug: "partner", display_name: "Partner", provider_types: ["managed_service_provider"], capabilities: { ztna: { support_state: "partner_delivered", freshness_state: "current", confidence: "medium", qualification: "Partner" } }, regions: { uk: { support_state: "supported", freshness_state: "current" } }, service_models: { fully_managed: { support_state: "supported", freshness_state: "current" } } }),
  base({ provider_id: "provider:unknown", slug: "unknown", display_name: "Unknown", capabilities: { ztna: { support_state: "unknown", freshness_state: "current", confidence: "unresolved", qualification: null } }, regions: { uk: { support_state: "supported", freshness_state: "current" } } }),
];
const result = matchProviders({ mandatory_capabilities: ["ztna"], preferred_capabilities: ["casb"], required_regions: ["uk"], service_model: null, sector: "healthcare", provider_scope: "both" }, providers);
assert.equal(result.methodology_version, PROVIDER_MATCH_METHODOLOGY_VERSION);
assert.equal(result.verdicts.find((row) => row.slug === "unknown")?.eligible, false);
assert.equal(result.verdicts.find((row) => row.slug === "native")?.contributions.some((row) => row.code === "casb"), false, "stale evidence cannot score positively");
assert.deepEqual(matchProviders(result.input, providers), result, "matching must be deterministic");
const preview = publicProviderMatchPreview(result);
const serialized = JSON.stringify(preview);
for (const secret of ["Native", "Partner", "Unknown", "provider:native", "native", "rev-1"]) assert.equal(serialized.includes(secret), false, `preview leaked ${secret}`);
const source = fs.readFileSync("src/lib/provider-matching.ts", "utf8");
assert.match(source, /const unlock = await getMarketUnlock\(projectId\)/);
assert.match(source, /if \(!unlock\) return null/);
console.log("PASS  central matching is deterministic, freshness-safe, aggregate before publication and MarketUnlock-bound after publication");
