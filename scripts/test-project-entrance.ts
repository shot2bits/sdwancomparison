import assert from "node:assert/strict";
import fs from "node:fs";
import {
  entranceToProjectDetails,
  marketplaceEntrance,
  rfpBuilderEntrance,
  sectorEntrance,
  shortlistEntrance,
} from "../src/lib/project-entrance";
import { PROJECT_ENTRANCE_CONTRACT_VERSION } from "../src/lib/project-entrance-contract";
import { DEFAULT_INPUT } from "../src/lib/shortlist-core";
import { ProjectDetailsSchema } from "../src/lib/rfp-types";

const ids = { id: "rfp-step2", shareToken: "tok-step2", manageToken: "mtok-step2" };
const now = 1788278400000;

const builderRaw = {
  buyer: { sector: "manufacturing", regions: ["uk"], pinned_vendors: ["cato-networks"] },
  requirement_text: "Connect 18 factories without losing the OT segmentation requirement.",
  bespoke: { ot_zones: ["line-control", "safety"] },
};
const builder = rfpBuilderEntrance({ rawInput: builderRaw, capturedAt: now });
assert.deepEqual(builder.raw_input, builderRaw);
assert.equal(entranceToProjectDetails({ entrance: builder, ids, now }).entrance_context?.version, PROJECT_ENTRANCE_CONTRACT_VERSION);

const shortlistInput = {
  ...DEFAULT_INPUT,
  sector: "healthcare" as const,
  organisation_size: "large_global_enterprise" as const,
  required_regions: ["uk_ireland", "europe"] as ["uk_ireland", "europe"],
  required_features: ["ztna", "casb"],
  preferred_features: ["digital_experience_monitoring"],
  ai_requirements: ["ai_security_analytics" as const],
  disaster_recovery_required: true,
};
const shortlist = shortlistEntrance({
  shortlist: shortlistInput,
  rankedVendorSlugs: ["netskope", "zscaler", "cato-networks"],
  requirementText: "Healthcare shortlist with NHS data controls.",
  capturedAt: now,
});
assert.deepEqual(shortlist.shortlist_input, shortlistInput);
assert.deepEqual((shortlist.raw_input.shortlist as object), shortlistInput);
const shortlistProject = entranceToProjectDetails({ entrance: shortlist, ids: { ...ids, id: "rfp-shortlist" }, now });
assert.equal(shortlistProject.buyer.sector, "healthcare");
assert.deepEqual(shortlistProject.buyer.pinned_vendors, ["netskope", "zscaler", "cato-networks"]);

const marketplaceRaw = { vendor_slug: "fortinet", comparison_pair: "fortinet-vs-palo-alto", filters: { managed: true } };
const marketplace = marketplaceEntrance({ vendorSlug: "fortinet", rawInput: marketplaceRaw, capturedAt: now });
assert.deepEqual(marketplace.raw_input, marketplaceRaw);
assert.equal(entranceToProjectDetails({ entrance: marketplace, ids: { ...ids, id: "rfp-market" }, now }).buyer.pinned_vendors[0], "fortinet");

const sectorRaw = { sector: "financial_services", regulation: ["fca", "pci_dss"], regions: ["uk", "eu"] };
const sector = sectorEntrance({ sector: "financial_services", rawInput: sectorRaw, capturedAt: now });
assert.deepEqual(sector.raw_input, sectorRaw);
assert.equal(entranceToProjectDetails({ entrance: sector, ids: { ...ids, id: "rfp-sector" }, now }).buyer.sector, "financial_services");

const historic = ProjectDetailsSchema.safeParse({
  id: "rfp-historic", created: 1, updated: 1, buyer: {}, share_token: "tok", manage_token: "mtok",
});
assert.equal(historic.success, true, "historic records without entrance_context remain readable");
if (historic.success) assert.equal(historic.data.entrance_context, undefined);

const createRoute = fs.readFileSync("src/app/api/rfp/route.ts", "utf8");
const securityCreate = fs.readFileSync("src/lib/security/create-project.ts", "utf8");
assert.match(createRoute, /entrance_context: entranceContext/);
assert.match(securityCreate, /entrance_context: rfpBuilderEntrance/);

console.log("PASS  all entrances preserve raw inputs and produce canonical ProjectDetails");
