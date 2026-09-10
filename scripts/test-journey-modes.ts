import assert from "node:assert/strict";
import { PROJECT_JOURNEY_MODES, ProjectDetailsSchema } from "../src/lib/rfp-types";

assert.deepEqual(PROJECT_JOURNEY_MODES, ["quick_list", "find_providers", "build_rfp", "validate_rfp"]);

for (const mode of PROJECT_JOURNEY_MODES) {
  const parsed = ProjectDetailsSchema.parse({
    id: `rfp_${mode}`,
    created: 1,
    updated: 1,
    buyer: {},
    share_token: `share_${mode}`,
    journey: {
      contract_version: "project-journey/1.0.0",
      source: "rfp_builder",
      mode,
      source_url: "https://netify.co.uk/sase-sd-wan-rfp-builder/",
      started_at: 1,
    },
  });
  assert.equal(parsed.journey?.mode, mode);
}

const historical = ProjectDetailsSchema.parse({ id: "rfp_historical", created: 1, updated: 1, buyer: {}, share_token: "share_historical" });
assert.equal(historical.journey, undefined, "historical projects must remain readable");

console.log("journey mode contract tests passed");
