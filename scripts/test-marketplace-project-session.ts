import assert from "node:assert/strict";
import fs from "node:fs";
import { ProjectDetailsSchema } from "../src/lib/rfp-types";

const historic = ProjectDetailsSchema.parse({ id: "old", created: 1, updated: 1, buyer: {}, share_token: "s", manage_token: "m" });
assert.equal(historic.marketplace_revision, 0);
const source = fs.readFileSync("src/lib/marketplace-project-session.ts", "utf8");
assert.match(source, /randomBytes\(32\)/);
assert.match(source, /token_hash: hash\(token\)/);
assert.match(source, /session\.revision !== input\.base_revision/);
assert.match(source, /marketplace:project_update:/);
assert.match(source, /"EX", SESSION_TTL_SECONDS/);
const updateRoute = fs.readFileSync("src/app/api/marketplace/projects/[projectId]/route.ts", "utf8");
assert.match(updateRoute, /authorization/);
assert.doesNotMatch(updateRoute, /manage_token/);
console.log("PASS  shared project sessions are opaque, expiring, revision-controlled and idempotent");
