import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeNeonProviderRecords, LIVE_SHORTLIST_CONTRACT_VERSION } from "../src/lib/live-shortlist";
import type { ProviderMatchRecord } from "../src/lib/provider-matching";
import { buildShortlist } from "../src/lib/shortlist-core";
import { FEATURES, FEATURE_NAMES, getShortlistDataset } from "../src/lib/vendors";
import { applyReviewedComparisonEvidence } from '../src/lib/reviewed-comparison-evidence';
import { buildComparison } from '../src/lib/shortlist-core';
import { verifyClaim } from '../src/lib/mcp-tools';

const base = getShortlistDataset().filter((provider) => provider.slug === "hpe-aruba");
assert.equal(base.length, 1);
base[0].capabilities.f08_flexible_commercial_model = "yes";

const supported = (qualification: string | null = null) => ({ support_state: "supported" as const, freshness_state: "current" as const, confidence: "high", qualification });
const record: ProviderMatchRecord = {
  provider_id: "provider:hpe-aruba-edgeconnect",
  slug: "hpe-aruba-edgeconnect",
  display_name: "Hewlett Packard Enterprise Company operating under the HPE Aruba Networking business unit",
  provider_types: ["technology_vendor"],
  primary_geographies: ["United Kingdom", "Europe"],
  revision_id: "revision:hpe",
  dataset_version: "sha256-live-test",
  reviewed_at: "2026-09-02T09:00:00.000Z",
  overview: "First researched sentence. Second researched sentence. Third sentence is not used.",
  product_names: ["EdgeConnect SD-WAN", "SSE"],
  target_buyers: ["Large global enterprise", "Mid-market"],
  integration_names: ["Microsoft Azure", "Amazon Web Services", "Okta"],
  evidence_source_count: 23,
  capabilities: {
    sd_wan: supported(), ztna: supported(), secure_web_gateway: supported(), firewall_as_a_service: supported(),
    dynamic_path_selection: supported(), high_availability: supported(), ai_assistant_copilot: supported(),
    managed_laptops: supported(), mobile_devices: supported(), clientless_access: supported(), raw_log_access: supported(),
  },
  regions: { "United Kingdom": supported(), Europe: supported() },
  service_models: { self_managed: supported() },
  sectors: { "Financial services": { ...supported(), evidence_strength: "strong" } },
};

const [provider] = mergeNeonProviderRecords(base, [record]);
assert.equal(LIVE_SHORTLIST_CONTRACT_VERSION, "neon-shortlist/2.0.0");
assert.equal(provider.slug, "hpe-aruba");
assert.equal(provider.name, "HPE Aruba EdgeConnect", "the compact comparison label must remain readable while facts come from Neon");
assert.equal(provider.marketplace_url, "https://netify.co.uk/marketplace/hpe-aruba-edgeconnect/");
assert.equal(provider.product_focus, "EdgeConnect SD-WAN, SSE");
assert.equal(provider.shortlist_summary, "First researched sentence. Second researched sentence.");
assert.equal(provider.evidence_source_count, 23);
assert.equal(provider.last_verified, "2026-09-02");
assert.equal(Object.keys(provider.capabilities).length, FEATURES.length);
assert.equal(provider.capabilities.f10_dynamic_path_selection, "yes");
assert.equal(provider.capabilities.f28_full_sase_platform, "yes");
assert.equal(provider.capabilities.f08_flexible_commercial_model, "unknown", "a legacy grade must not survive without current Neon evidence");
assert.equal(provider.regions.uk_ireland, "yes");
assert.equal(provider.sectors.financial_services, "yes");
assert.equal(provider.supported_clouds.azure, "yes");
assert.equal(provider.ai_capability.ai_assistant, "yes");

const result = buildShortlist([provider], { required_features: ["f30_zero_trust_network_access"], required_regions: ["uk_ireland"], required_clouds: ["azure"], sector: "financial_services", shortlist_size: 3 }, FEATURE_NAMES);
assert.equal(result.shortlist[0]?.slug, "hpe-aruba", "all shortlist controls must score the Neon-derived fields");

const page = readFileSync("src/app/(marketing)/shortlist/page.tsx", "utf8");
const data = readFileSync("src/app/(marketing)/shortlist/data.json/route.ts", "utf8");
const csvData = readFileSync("src/app/(marketing)/shortlist/data.csv/route.ts", "utf8");
const agent = readFileSync("src/app/api/agent/route.ts", "utf8");
const mcp = readFileSync("src/lib/mcp-tools.ts", "utf8");
for (const source of [page, data, agent, mcp]) assert.match(source, /getLiveShortlistDataset/);
assert.match(data, /runtime_provider_source/);
assert.match(data, /provider_contract_version:\s*live\.providerContractVersion/);
assert.match(data, /generated_at:\s*generatedAt/);
assert.match(data, /provider_loaded_at:\s*generatedAt/);
assert.doesNotMatch(data, /provider_loaded_at:\s*live\.loadedAt/);
assert.doesNotMatch(data, /default_shortlist:/);
assert.match(data, /PUBLIC_EVIDENCE_CONTRACT/);
assert.match(data, /createHash\("sha256"\)/);
assert.match(data, /if-none-match/);
assert.match(csvData, /'generated_at'/);
assert.match(csvData, /createHash\('sha256'\)/);
assert.match(csvData, /if-none-match/);
assert.match(mcp, /runtime_provider_source/);
console.log("live Neon shortlist tests passed");

const [canonical] = mergeNeonProviderRecords(base, [{...record, regions: { north_america: supported(), asia_pacific: supported(), uk_ireland: supported(), latin_america: {...supported(), freshness_state: 'stale'} }, sectors: {financial_services: {...supported(), evidence_strength: "strong"}} }]);
assert.equal(canonical.regions.north_america, 'yes');
assert.equal(canonical.regions.asia_pacific, 'yes');
assert.equal(canonical.regions.uk_ireland, 'yes');
assert.equal(canonical.regions.latin_america, 'unknown', 'stale evidence must not be promoted');
assert.equal(canonical.sectors.financial_services, 'yes');

// Every formerly unmapped field accepts explicit, current evidence, not a legacy grade.
const repaired = ['f08_flexible_commercial_model', 'f11_active_active_link_utilisation', 'f20_private_pops_dedicated_pops', 'f21_private_global_backbone', 'f22_regional_breakout_and_data_residency'];
for (const feature of repaired) {
  for (const code of [feature, feature.slice(4)]) {
    const [mapped] = mergeNeonProviderRecords(base, [{...record, capabilities: {[code]: supported()}}]);
    assert.equal(mapped.capabilities[feature], 'yes', code);
    const [stale] = mergeNeonProviderRecords(base, [{...record, capabilities: {[code]: {...supported(), freshness_state: 'stale'}}}]);
    assert.equal(stale.capabilities[feature], 'unknown', `stale ${code}`);
  }
}
const [proxy] = mergeNeonProviderRecords(base, [{...record, capabilities: {
  supported_wan_underlays: supported(), site_and_circuit_performance: supported(),
  sla_reporting: supported(), custom_reports: supported(), executive_dashboard: supported(),
  configuration_generation: supported(), automated_remediation: supported(), network_health: supported(),
}}]);
for (const feature of ['f06_last_mile_circuit_management','f07_lifecycle_management','f26_sla_backed_service_fabric','f37_customer_portal_and_rbac','f39_apis_and_automation','f40_managed_service_assurance']) {
  assert.equal(proxy.capabilities[feature], 'unknown', `adjacent evidence must not prove ${feature}`);
}
for (const [state, expected] of [['partner_delivered','partner_integrated'], ['partially_supported','partial']] as const) {
  const [v] = mergeNeonProviderRecords(base, [{...record, capabilities: {...record.capabilities, ztna: {...supported(), support_state: state}}}]);
  assert.equal(v.capabilities.f28_full_sase_platform, expected, 'composite SASE must retain qualifications');
}
const checked = getShortlistDataset().filter(v => ['aryaka', 'cato-networks'].includes(v.slug));
for (const v of checked) applyReviewedComparisonEvidence(v, '2026-09-01', Date.parse('2026-09-19T12:00:00Z'));
assert.equal(checked.find(v => v.slug === 'aryaka')!.capabilities.f21_private_global_backbone, 'yes');
assert.equal(checked.find(v => v.slug === 'cato-networks')!.capabilities.f11_active_active_link_utilisation, 'yes');
const comparison = buildComparison(checked, checked.map(v => v.slug), FEATURES)!;
assert.match(comparison.groups.flatMap(g => g.rows).find(r => r.key === 'f21_private_global_backbone')!.evidence!.aryaka.qualification, /last-mile/);
const claim = verifyClaim({slug:'aryaka',claim:'private backbone'}, checked) as {value:string; status:string; quote:null; sources:{url:string}[]};
assert.equal(claim.value,'yes');
assert.equal(claim.status,'vendor_documented');
assert.equal(claim.quote,null,'a paraphrase must not become a fabricated quote');
assert.equal(claim.sources[0].url,'https://www.aryaka.com/unified-sase-platform/');
const expires = getShortlistDataset().find(v => v.slug === 'aryaka')!;
expires.capabilities.f21_private_global_backbone = 'unknown';
applyReviewedComparisonEvidence(expires, '2026-09-01', Date.parse('2026-10-19T00:00:00Z'));
assert.equal(expires.capabilities.f21_private_global_backbone, 'unknown', 'expired editorial corrections cannot silently persist');
applyReviewedComparisonEvidence(expires, '2026-09-20', Date.parse('2026-09-21T00:00:00Z'));
assert.equal(expires.capabilities.f21_private_global_backbone, 'unknown', 'new governed reviews supersede corrections');
console.log('PASS exact mappings, stale evidence, proxy rejection, qualified SASE, reviewed sources, expiry and newer-review precedence');
