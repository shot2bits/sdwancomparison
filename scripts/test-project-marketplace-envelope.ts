import assert from "node:assert/strict";
import fs from "node:fs";
import { ProjectDetailsSchema } from "../src/lib/rfp-types";

const base = { id: "rfp-old", created: 1, updated: 1, buyer: {}, share_token: "share", manage_token: "manage" };
assert.equal(ProjectDetailsSchema.safeParse(base).success, true, "historic projects must remain readable");
const modern = ProjectDetailsSchema.parse({ ...base, id: "rfp-modern", journey: { contract_version: "project-journey/1.0.0", source: "sector", mode: "find_providers", source_url: "/sd-wan-for-healthcare/", started_at: 2 }, sector_profile: { profile_version: "sector-profile/1.0.0", sector: "healthcare", source_url: "/sd-wan-for-healthcare/", recommendations: [{ requirement_code: "clinical_resilience", state: "recommended", reason: "Clinical continuity" }] }, match_preview: { methodology_version: "provider-match/1.0.0", dataset_versions: ["data-1"], considered_count: 30, eligible_technology_count: 5, eligible_managed_provider_count: 4, meets_all_mandatory_count: 7, capability_coverage: [{ code: "ztna", supported_provider_count: 9 }], unresolved_requirements: ["dsp_tooling"], calculated_at: 3, project_revision: 0 }, marketplace_state: { contract_version: "project-marketplace-state/1.0.0", publication_status: "draft", board_opportunity_id: null, market_unlock_status: "locked", server_updated_at: 3 } });
assert.equal(modern.journey?.source, "sector");
assert.equal(modern.sector_profile?.recommendations[0]?.state, "recommended");
assert.equal(JSON.stringify(modern.match_preview).includes("provider:"), false);
const updateRoute = fs.readFileSync("src/app/api/rfp/[id]/route.ts", "utf8");
assert.match(updateRoute, /delete body\.match_preview/);
assert.match(updateRoute, /delete body\.marketplace_state/);
console.log("PASS  canonical project envelope carries journey and aggregate marketplace state without breaking historic records");
