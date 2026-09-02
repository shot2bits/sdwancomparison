import assert from "node:assert/strict";
import fs from "node:fs";
import { mergeNeonProviderRecords, shortlistInputFromProviderMatchInput } from "../src/lib/live-shortlist";
import { ProviderMatchInputSchema, ProviderMatchRecordSchema } from "../src/lib/provider-matching";
import { buildShortlist } from "../src/lib/shortlist-core";
import { evaluateResponse } from "../src/lib/rfp-evaluation";
import { ProjectDetailsSchema, RfpResponseSchema } from "../src/lib/rfp-types";
import { FEATURE_NAMES, getShortlistDataset } from "../src/lib/vendors";

const supported = () => ({ support_state: "supported" as const, freshness_state: "current" as const, confidence: "high", qualification: null });
const source = getShortlistDataset().find((provider) => provider.slug === "hpe-aruba");
assert(source);
const record = ProviderMatchRecordSchema.parse({
  provider_id: "provider:hpe-aruba-edgeconnect",
  slug: "hpe-aruba-edgeconnect",
  display_name: "HPE Aruba EdgeConnect",
  provider_types: ["technology_vendor"],
  revision_id: "revision:neon-test",
  dataset_version: "sha256-neon-test",
  primary_geographies: ["United Kingdom"],
  reviewed_at: "2026-09-01T00:00:00.000Z",
  overview: "Published provider evidence.",
  product_names: ["EdgeConnect SD-WAN"],
  target_buyers: ["Financial services"],
  integration_names: ["Microsoft Azure"],
  evidence_source_count: 12,
  capabilities: { ztna: supported() },
  regions: { uk_ireland: { support_state: "supported", freshness_state: "current" } },
  service_models: { fully_managed: { support_state: "supported", freshness_state: "current" } },
  sectors: { financial_services: { support_state: "supported", freshness_state: "current", evidence_strength: "strong" } },
});
const [neonVendor] = mergeNeonProviderRecords([source], [record]);
const providerInput = ProviderMatchInputSchema.parse({ mandatory_capabilities: ["ztna"], required_regions: ["uk_ireland"], service_model: "fully_managed", sector: "financial_services" });
const translated = shortlistInputFromProviderMatchInput(providerInput);
assert.deepEqual(translated.unresolved, []);
const shortlist = buildShortlist([neonVendor], translated.input, FEATURE_NAMES);
assert.equal(shortlist.shortlist[0]?.slug, "hpe-aruba", "canonical buyer codes must match the Neon-derived provider record");

const project = ProjectDetailsSchema.parse({
  id: "rfp-neon-test", created: 1, updated: 1, buyer: {}, share_token: "share", manage_token: "manage",
  rfp_sections: [{ category: "Security", included: true, questions: [{ id: "q1", feature_id: "f30_zero_trust_network_access", text: "Do you support ZTNA?", evidence_requested: "architecture diagram", priority: "required" }] }],
});
const response = RfpResponseSchema.parse({ id: "response-1", rfp_id: project.id, vendor: neonVendor.name, vendor_slug: neonVendor.slug, answers: { q1: "Yes, fully supported. See the architecture diagram." }, created: 2 });
const frozenEvaluation = evaluateResponse(project, response, [neonVendor]);
const changedVendor = structuredClone(neonVendor);
changedVendor.capabilities.f30_zero_trust_network_access = "not_primary";
const changedEvaluation = evaluateResponse(project, response, [changedVendor]);
assert.equal(frozenEvaluation.checks[0]?.flag, "supported");
assert.equal(changedEvaluation.checks[0]?.flag, "claim_exceeds_evidence");

const publish = fs.readFileSync("src/lib/rfp-publish.ts", "utf8");
const publishBody = publish.slice(publish.indexOf("export async function executePublish("));
assert.ok(publishBody.indexOf("getStrictLiveShortlistDataset()") < publishBody.indexOf("listRfpOnBoard("), "provider evidence must be sealed before the public board write");
assert.match(publishBody, /provider_evidence: providerEvidence/);
assert.match(publishBody, /provider_provenance/);
assert.match(publishBody, /provider_match_input: attempt\.match_input/);

const mcp = fs.readFileSync("src/lib/mcp-rfp-tools.ts", "utf8");
assert.match(mcp, /const snapshot = await getLatestPublishedSnapshot\(projectId\)/);
assert.doesNotMatch(mcp, /matchProviders\(args\.input/);
const evaluationRoute = fs.readFileSync("src/app/api/rfp/[id]/evaluation/route.ts", "utf8");
assert.match(evaluationRoute, /snapshot\?\.provider_evidence/);
const agentRoute = fs.readFileSync("src/app/api/rfp/[id]/agent/route.ts", "utf8");
assert.match(agentRoute, /Provider identities become available after successful publication and MarketUnlock/);
const approvalsRoute = fs.readFileSync("src/app/api/rfp/[id]/approvals/route.ts", "utf8");
assert.match(approvalsRoute, /isMarketUnlocked\(id\)/);

console.log("PASS RFP web, API and MCP paths share canonical Neon evidence and freeze it at publication");
