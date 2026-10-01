import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import operations from "../data/sourcing-operations.json";
import { evidenceReviewHealth } from "../src/lib/evidence-review-health";
export function validateSourcingOperations(now = Date.now(), desk = process.env.SOURCING_DESK_EMAIL ?? operations.desk_email) {
  assert(z.email().safeParse(desk).success, "A valid sourcing desk destination is required");
  const health = evidenceReviewHealth(now);
  assert.equal(health.expired, 0, `Expired evidence must be reviewed before release: ${health.rows.filter(r=>Date.parse(r.due)<=now).map(r=>`${r.slug}/${r.kind}`).join(", ")}`);
  if (health.expiring + health.expired > 0)
    console.warn(`Evidence review required: ${health.expiring} approaching expiry, ${health.expired} expired; owner deadline ${health.owner_deadline}. Review or explicitly extend evidence; runtime expiry restrictions remain active.`);
  console.log(`PASS sourcing desk destination (${health.pending} owner approvals outstanding)`);
  return health;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) validateSourcingOperations();
