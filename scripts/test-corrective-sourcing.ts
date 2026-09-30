// @ts-expect-error Node 24 provides registerHooks.
import { registerHooks } from "node:module";
registerHooks({
  resolve(s: string, c: object, n: (s: string, c: object) => { url: string }) {
    return s === "server-only"
      ? { url: "data:text/javascript,export {};", shortCircuit: true }
      : n(s, c);
  },
});
import assert from "node:assert/strict";
import { withFakeKv, FakeKvStore, makeRequest } from "./fake-kv-harness";
import { sourcingAcquisition } from "../src/lib/sourcing-acquisition";
import {
  applyProjectionReview,
  REVIEWED_PROVIDER_PROJECTIONS,
} from "../src/lib/provider-projection-review";
import { evidenceReviewHealth } from "../src/lib/evidence-review-health";
import { getShortlistDataset } from "../src/lib/vendors";
for (const [search, ref, expected] of [
  ["?utm_source=chatgpt.com", "", "chatgpt"],
  ["", "https://perplexity.ai/search/private-query", "perplexity"],
  ["", "https://gemini.google.com/secret", "gemini"],
  ["", "https://www.google.co.uk/search?q=x", "google"],
  ["", "https://copilot.microsoft.com/", "copilot"],
  ["", "https://www.bing.com/search", "bing"],
  ["?utm_source=chatgpt.com.evil.test", "", "web"],
  ["", "not a URL", "web"],
])
  assert.equal(sourcingAcquisition(search, ref), expected);
const source = getShortlistDataset().find((v) => v.slug === "cisco")!;
const review = REVIEWED_PROVIDER_PROJECTIONS.cisco;
const due = Date.parse(review.review_due);
for (const [now, updated, resolution] of [
  [due - 1, undefined, "reviewed_override"],
  [due, undefined, "review_expired"],
  [due + 1, undefined, "review_expired"],
  [due - 1, "2026-10-01T00:00:00Z", "source_newer_than_review"],
] as const) {
  const p = structuredClone(source);
  applyProjectionReview(
    p,
    { revision_id: "test", sectors: {}, reviewed_at: updated },
    source,
    review,
    now,
  );
  assert.equal(p.projection_provenance?.resolution, resolution);
}
assert.equal(
  evidenceReviewHealth(Date.parse("2026-09-30T22:00:00Z")).pending,
  23,
);
assert.equal(
  evidenceReviewHealth(Date.parse("2026-10-16T00:00:00Z")).expiring,
  23,
);
assert.equal(evidenceReviewHealth(due).expired, 23);
const ttl = new FakeKvStore();
const originalNow = Date.now;
let clock = 1000;
Date.now = () => clock;
try {
  ttl.command(["SET", "k", "v", "EX", 1]);
  assert.equal(ttl.command(["PTTL", "k"]), 1000);
  clock = 2000;
  assert.equal(ttl.command(["GET", "k"]), null);
  assert.equal(ttl.command(["PTTL", "k"]), -2);
  ttl.command(["SET", "k", "x", "EX", 10]);
  ttl.command(["SET", "k", "y"]);
  assert.equal(ttl.command(["PTTL", "k"]), -1);
} finally {
  Date.now = originalNow;
}
await withFakeKv(async () => {
  process.env.VERCEL_ENV = "preview";
  const { recordSourcingMetric, sourcingWeeklyMetrics } = await import(
    "../src/lib/sourcing-metrics"
  );
  await recordSourcingMetric("plan", "chatgpt", "synthetic-plan");
  await recordSourcingMetric("plan", "chatgpt", "synthetic-plan");
  await recordSourcingMetric("request", "chatgpt", "synthetic-request");
  await recordSourcingMetric("confirmed", "chatgpt", "synthetic-request");
  const report = await sourcingWeeklyMetrics();
  const week = Object.values(report.weeks)[0];
  assert.equal(week.chatgpt.plan, 1);
  assert.equal(week.chatgpt.request, 1);
  assert.equal(week.chatgpt.confirmed, 1);
  const route = await import("../src/app/api/sourcing/metrics/route");
  assert.equal(
    (
      await route.GET(
        makeRequest("GET", "https://fixture.test/sase/api/sourcing/metrics/"),
      )
    ).status,
    403,
  );
  const { sourcingPlanAllowed } = await import(
    "../src/lib/sourcing-plan-limit"
  );
  for (let n = 0; n < 30; n++)
    assert(await sourcingPlanAllowed("synthetic-plan-ip"));
  assert.equal(await sourcingPlanAllowed("synthetic-plan-ip"), false);
  const plan = await import("../src/app/api/sourcing/plan/route");
  assert.equal(
    (
      await plan.POST(
        new Request("https://fixture.test/sase/api/sourcing/plan/", {
          method: "POST",
          headers: { Origin: "https://evil.test" },
          body: "{}",
        }),
      )
    ).status,
    403,
  );
});
console.log(
  "PASS corrective acceptance: referral mapping, evidence expiry/source changes, 23 owner review warnings, actual TTL expiry, deduplicated weekly metrics, staff-only access and plan throttling",
);
