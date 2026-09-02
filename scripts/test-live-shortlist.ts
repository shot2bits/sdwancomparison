import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeNeonProviderRecords, LIVE_SHORTLIST_CONTRACT_VERSION } from "../src/lib/live-shortlist";
import type { ProviderMatchRecord } from "../src/lib/provider-matching";
import { buildShortlist } from "../src/lib/shortlist-core";
import { FEATURES, FEATURE_NAMES, getShortlistDataset } from "../src/lib/vendors";

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
assert.equal(LIVE_SHORTLIST_CONTRACT_VERSION, "neon-shortlist/1.0.0");
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
const agent = readFileSync("src/app/api/agent/route.ts", "utf8");
const mcp = readFileSync("src/lib/mcp-tools.ts", "utf8");
for (const source of [page, data, agent, mcp]) assert.match(source, /getLiveShortlistDataset/);
assert.match(data, /runtime_provider_source/);
assert.match(mcp, /runtime_provider_source/);
console.log("live Neon shortlist tests passed");
