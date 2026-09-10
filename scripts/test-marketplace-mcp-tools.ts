import assert from "node:assert/strict";
import fs from "node:fs";

const tools = fs.readFileSync("src/lib/mcp-rfp-tools.ts", "utf8");
const route = fs.readFileSync("src/app/api/mcp/route.ts", "utf8");
for (const name of ["start_project","update_requirements","preview_provider_matches","prepare_publication","publish_opportunity","get_unlocked_matches","get_project_status"]) assert.match(tools, new RegExp(`name: "${name}"`));
assert.match(tools, /publicationAuthorization/);
assert.match(tools, /publicationCompleted/);
assert.match(tools, /authenticateMarketplaceProject/);
assert.match(tools, /getLatestPublishedSnapshot/);
assert.match(tools, /provider_evidence/);
assert.doesNotMatch(tools, /matchProviders\(args\.input/);
assert.match(tools, /MARKETPLACE_PUBLICATION_CONSENT_VERSION/);
assert.match(tools, /mcp:marketplace:start:/);
assert.match(route, /sessionFromRequest/);
assert.match(route, /verifiedBuyerEmail/);
assert.match(route, /requestKey/);
console.log("PASS MCP project actions share canonical sessions and cannot bypass identity, consent or MarketUnlock");
