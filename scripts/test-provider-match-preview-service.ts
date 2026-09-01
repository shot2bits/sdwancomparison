import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/provider-match-source.ts", "utf8");
assert.match(source, /x-vercel-protection-bypass/);
const session = fs.readFileSync("src/lib/marketplace-project-session.ts", "utf8");
const route = fs.readFileSync("src/app/api/marketplace/projects/[projectId]/match-preview/route.ts", "utf8");
assert.match(source, /PROVIDER_MATCH_SERVICE_TOKEN/);
assert.match(source, /cache: "no-store"/);
assert.match(source, /ProviderMatchRecordSchema/);
assert.match(session, /authenticateMarketplaceProject\(projectId, token\)/);
assert.match(session, /session\.revision !== request\.base_revision/);
assert.match(session, /publicProviderMatchPreview\(matchProviders\(input, records\)\)/);
assert.doesNotMatch(route, /manage_token/);
assert.doesNotMatch(route, /display_name|provider_id|slug/);
console.log("PASS aggregate preview is session-bound, revision-controlled and identity-free");
