import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PUBLICATION_POLICY,
  PUBLICATION_POLICY_VERSION,
  anonymousBuyerOrganisation,
  invitationsAllowed,
  isPublicationReplay,
  marketUnlockBindingValid,
  publicationAuthorization,
  publicationCompleted,
  publicationReadiness,
  publicProjectionContainsPrivateIdentity,
  supplierCapabilitiesAllowed,
} from "../src/lib/publication-policy";
import { MarketUnlockSchema } from "../src/lib/market-unlock";
import { OpportunitySchema, toPublicOpportunity } from "../src/lib/opportunity-types";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const cases: Array<[string, () => void]> = [];
const test = (name: string, run: () => void) => cases.push([name, run]);

test("policy is explicit, free, anonymous and non-binding", () => {
  assert.equal(PUBLICATION_POLICY_VERSION, "sase-publication-policy/1.0.0");
  assert.equal(PUBLICATION_POLICY.price, "free");
  assert.equal(PUBLICATION_POLICY.publication.anonymous, true);
  assert.equal(PUBLICATION_POLICY.legalEffect, "non-binding");
  assert.deepEqual(PUBLICATION_POLICY.buyerObligations, {
    purchaseRequired: false,
    supplierConversationRequired: false,
    responseAcceptanceRequired: false,
  });
});

test("incomplete projects cannot publish", () => {
  assert.equal(publicationReadiness({ baselineReady: false, baselineRemaining: ["Organisation and scale"], activeQuestionCount: 3 }).allowed, false);
  assert.equal(publicationReadiness({ baselineReady: true, baselineRemaining: [], activeQuestionCount: 0 }).allowed, false);
  assert.equal(publicationReadiness({ baselineReady: true, baselineRemaining: [], activeQuestionCount: 1 }).allowed, true);
});

test("public projections contain no buyer or company identity", () => {
  const stored = OpportunitySchema.parse({
    id: "opp-existing", created: 1, updated: 1, buyer_org: "Private Buyer Ltd", title: "Network procurement",
    scope: ["sase"], buyer_token: "secret", owner_email: "buyer@example.com", buyer_visibility: "named",
  });
  const projection = toPublicOpportunity(stored);
  assert.equal(projection.buyer_org, anonymousBuyerOrganisation());
  assert.equal(publicProjectionContainsPrivateIdentity(projection), false);
  assert.equal("owner_email" in projection, false);
  assert.equal("buyer_token" in projection, false);
});

test("board failure leaves publication incomplete, MarketUnlock locked and invitations blocked", () => {
  assert.equal(publicationCompleted({ publicBoardOpportunityId: null, marketUnlockValid: false }), false);
  assert.equal(supplierCapabilitiesAllowed(false), false);
  assert.equal(invitationsAllowed({ publicBoardOpportunityId: null, marketUnlockValid: false }), false);
});

test("repeated publication is idempotent by stable event id", () => {
  assert.equal(isPublicationReplay("publish:rfp-1:hash", "publish:rfp-1:hash"), true);
  assert.equal(isPublicationReplay("publish:rfp-1:old", "publish:rfp-1:new"), false);
});

test("forged, stale and mismatched MarketUnlock facts fail", () => {
  const valid = {
    revisionExists: true, revisionProjectMatches: true, revisionHashMatches: true,
    opportunityExists: true, opportunityProjectMatches: true, opportunityIsPublic: true,
    opportunityRevisionMatches: true,
  };
  assert.equal(marketUnlockBindingValid(valid), true);
  for (const key of Object.keys(valid) as Array<keyof typeof valid>) {
    assert.equal(marketUnlockBindingValid({ ...valid, [key]: false }), false, key);
  }
});

test("supplier access remains blocked until a valid MarketUnlock", () => {
  assert.equal(supplierCapabilitiesAllowed(false), false);
  assert.equal(supplierCapabilitiesAllowed(true), true);
});

test("ownership and verified session are both mandatory on every channel", () => {
  for (const channel of PUBLICATION_POLICY.authorization.appliesTo) {
    assert.equal(publicationAuthorization({ ownerAuthorized: false, verifiedSession: true, channel }).allowed, false);
    assert.equal(publicationAuthorization({ ownerAuthorized: true, verifiedSession: false, channel }).allowed, false);
    assert.equal(publicationAuthorization({ ownerAuthorized: true, verifiedSession: true, channel }).allowed, true);
  }
});

test("web, API, auth continuation, OpenAPI and MCP converge on policy-controlled paths", () => {
  const publishRoute = source("src/app/api/rfp/[id]/publish/route.ts");
  const authVerify = source("src/app/api/auth/verify/route.ts");
  const mcpTools = source("src/lib/mcp-rfp-tools.ts");
  const mcpRoute = source("src/app/api/mcp/route.ts");
  const openapi = source("src/app/api/openapi/[tool]/route.ts");
  assert.match(publishRoute, /publicationAuthorization/);
  assert.match(publishRoute, /executePublish/);
  assert.match(authVerify, /executePublish/);
  assert.match(mcpTools, /publicationAuthorization/);
  assert.match(mcpTools, /name === "publish_rfp"/);
  assert.match(mcpTools, /opp\.source_rfp_id && !\(await isMarketUnlocked/);
  assert.match(mcpRoute, /callMcpTool/);
  assert.match(openapi, /callMcpTool/);
});

test("existing valid publication still completes", () => {
  assert.equal(publicationCompleted({ publicBoardOpportunityId: "opp-1", marketUnlockValid: true }), true);
  assert.equal(invitationsAllowed({ publicBoardOpportunityId: "opp-1", marketUnlockValid: true }), true);
});

test("existing KV MarketUnlock rows remain readable without a policy-version migration", () => {
  const historic = {
    id: "mktu-old", project_id: "rfp-old", published_revision_id: "snap-old",
    board_opportunity_id: "opp-old", board_visibility: "public", matching_basis_hash: "hash-old",
    invitation_snapshot_id: "snap-old", unlocked_at: 1,
  };
  assert.equal(MarketUnlockSchema.safeParse(historic).success, true);
  assert.equal("policy_version" in historic, false);
});

let failures = 0;
for (const [name, run] of cases) {
  try { run(); console.log(`PASS  ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL  ${name}`); console.error(error); }
}
if (failures) process.exit(1);
console.log(`\nALL PASS (${cases.length} publication-policy tests)`);
