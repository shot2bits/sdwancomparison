import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import operations from "../data/sourcing-operations.json";
import { evidenceReviewHealth } from "../src/lib/evidence-review-health";
import {applyProjectionReview, REVIEWED_PROVIDER_PROJECTIONS, UK_CARRIER_REVIEWS} from "../src/lib/provider-projection-review";
import {comparisonSlugForGovernedProvider} from "../src/lib/governed-provider-catalogue";
import {getShortlistDataset} from "../src/lib/vendors";
export function validateSourcingOperations(now = Date.now(), desk = process.env.SOURCING_DESK_EMAIL ?? operations.desk_email) {
  assert(z.email().safeParse(desk).success, "A valid sourcing desk destination is required");
  const health = evidenceReviewHealth(now);
  assert.equal(health.invalid, 0, "Invalid evidence expiry dates must block release");
  assert.equal(health.unresolved_expired, 0, `Expired evidence must be reviewed before release: ${health.rows.filter(r=>Date.parse(r.due)<=now && !r.held).map(r=>`${r.slug}/${r.kind}`).join(", ")}`);
  // A retired source record is allowed only while the real projection function
  // excludes it. Any regression that reactivates an expired override fails release.
  const vendors = getShortlistDataset();
  for (const row of health.rows.filter(r => r.held)) {
    const slug = comparisonSlugForGovernedProvider(row.slug);
    const original = vendors.find(v => v.slug === slug);
    assert(original, `Retired evidence has no provider: ${row.slug}`);
    const review = row.kind === "uk_carrier" ? UK_CARRIER_REVIEWS[row.slug] : REVIEWED_PROVIDER_PROJECTIONS[slug];
    assert(review && Date.parse(review.review_due) <= now, `Retired evidence must remain expired: ${row.slug}`);
    const projected = structuredClone(original);
    applyProjectionReview(projected, {revision_id: "release-expiry-check", sectors: {}}, original, review, now);
    assert.equal(projected.projection_provenance?.resolution, "review_expired", `Expired override reactivated: ${row.slug}`);
    assert.equal(projected.projection_provenance?.active_review, undefined);
    assert.deepEqual(projected.sectors, original.sectors);
    assert.deepEqual(projected.regions, original.regions);
    assert.equal(projected.uk_delivery, original.uk_delivery);
    assert.equal(projected.uk_basis, original.uk_basis);
  }
  if (health.expiring + health.expired > 0)
    console.warn(`Evidence review required: ${health.expiring} approaching expiry, ${health.expired} expired; owner deadline ${health.owner_deadline}. ${health.held_expired} exact records retired pending review; runtime expiry restrictions remain active. No review dates or sign-offs extended.`);
  console.log(`PASS sourcing desk destination (${health.pending} owner approvals outstanding)`);
  return health;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) validateSourcingOperations();
