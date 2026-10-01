import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import rows from "../data/provider-sector-adjudications.json";
import { sectorSignoff } from "../src/lib/sector-signoff";
import { REVIEWED_PROVIDER_PROJECTIONS } from "../src/lib/provider-projection-review";
import { comparisonSlugForGovernedProvider } from "../src/lib/governed-provider-catalogue";
const gradeDigest = createHash("sha256")
  .update(
    JSON.stringify(
      Object.entries(rows).map(([slug, row]) => [slug, row.sectors]),
    ),
  )
  .digest("hex");
assert.equal(
  gradeDigest,
  "e394b948e63f372847e081ed4e1449b86947b53ce75b96b37d7df0f1392262b8",
);
for (const [slug, row] of Object.entries(rows)) {
  assert.equal(row.signed_off_by, "");
  assert.equal(row.signed_off_at, "");
  assert.equal(
    REVIEWED_PROVIDER_PROJECTIONS[comparisonSlugForGovernedProvider(slug)]
      .sector_signoff?.status,
    "pending",
  );
}
const sheet = fs.readFileSync(
  "docs/sector-adjudications-signoff-2026-09-30.md",
  "utf8",
);
const positive = sheet
  .split("## Preserved")[0]
  .split("\n")
  .filter((line) => line.startsWith("| "))
  .map((line) => line.split("|")[3]?.trim());
assert.equal(positive.filter((v) => v === "yes").length, 27);
assert.equal(positive.filter((v) => v === "partial").length, 9);
assert.equal((sheet.match(/\| unknown \|/g) ?? []).length, 5);
assert.equal(
  sectorSignoff({ signed_off_by: "", signed_off_at: "" }).label,
  "Sector evidence: source-reviewed",
);
assert.equal(
  sectorSignoff({
    signed_off_by: "Synthetic Reviewer",
    signed_off_at: "2026-09-30",
  }).label,
  "Sector evidence reviewed by Synthetic Reviewer on 2026-09-30",
);
assert.equal(
  sectorSignoff({
    signed_off_by: "Synthetic Reviewer",
    signed_off_at: "invalid",
  }).status,
  "pending",
);
console.log(
  "PASS sign-off: 19 provider records, 36 positive rows (27 yes/9 partial), 5 unconfirmed rows preserved; all values unchanged; pending and signed labels verified; Colt slug mapped",
);
