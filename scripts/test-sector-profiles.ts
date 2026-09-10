import assert from "node:assert/strict";
import fs from "node:fs";
import { GovernedSectorProfileSchema, projectSectorProfile, SECTOR_PROFILES } from "../src/lib/sector-profiles";
const profiles = Object.values(SECTOR_PROFILES).map((profile) => GovernedSectorProfileSchema.parse(profile));
assert.equal(profiles.length, 4);
for (const profile of profiles) {
  assert.equal(new Set(profile.recommendations.map((item) => item.code)).size, profile.recommendations.length);
  assert.equal(profile.limitations.length > 0, true);
  assert.equal(projectSectorProfile(profile.sector).recommendations.every((item) => item.state === "recommended"), true);
}
for (let left = 0; left < profiles.length; left++) for (let right = left + 1; right < profiles.length; right++) {
  const a = new Set(profiles[left]!.recommendations.map((item) => item.code));
  const b = new Set(profiles[right]!.recommendations.map((item) => item.code));
  assert.equal([...a].filter((code) => b.has(code)).length, 0, `${profiles[left]!.sector} and ${profiles[right]!.sector} are not materially distinct`);
}
console.log("PASS  four governed sector profiles are materially distinct and never preload confirmed buyer facts");
const createRoute = fs.readFileSync("src/app/api/rfp/route.ts", "utf8");
assert.match(createRoute, /SectorProfileStateSchema\.safeParse/);
assert.match(createRoute, /sector_profile: sectorProfile\.data/);
const profileRoute = fs.readFileSync("src/app/api/marketplace/sector-profiles/[sector]/route.ts", "utf8");
assert.match(profileRoute, /projectSectorProfile/);
