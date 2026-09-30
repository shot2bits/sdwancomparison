import assert from "node:assert/strict";
import { z } from "zod";
import operations from "../data/sourcing-operations.json";
import { evidenceReviewHealth } from "../src/lib/evidence-review-health";
assert(
  z.email().safeParse(process.env.SOURCING_DESK_EMAIL ?? operations.desk_email)
    .success,
  "A valid sourcing desk destination is required",
);
const health = evidenceReviewHealth();
assert.equal(
  health.expiring + health.expired,
  0,
  "Owner must review or explicitly extend the pending sector and UK carrier evidence before its 14-day deadline",
);
console.log(
  `PASS sourcing operations destination and evidence review window (${health.pending} owner approvals outstanding)`,
);
