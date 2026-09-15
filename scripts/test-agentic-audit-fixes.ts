import assert from "node:assert/strict";
import { mcpExecutionError } from "../src/lib/mcp-execution-error";
import { MarketplaceProjectUnauthorised, MarketplaceProjectConflict } from "../src/lib/marketplace-project-errors";
import { publicEvidenceProviders } from "../src/lib/public-provider-evidence";
import { getShortlistDataset } from "../src/lib/vendors";
import { PROVIDER_SUMMARY_COPY } from "../src/lib/provider-summary-copy";
const secret = "private-project-and-credential-details";
const auth = mcpExecutionError(new MarketplaceProjectUnauthorised(secret));
assert.equal(auth.error, "project_authentication_required");
assert.equal(auth.retryable, false);
assert(!JSON.stringify(auth).includes(secret));
assert.equal(mcpExecutionError(new MarketplaceProjectConflict(secret)).error, "project_revision_conflict");
assert(!JSON.stringify(mcpExecutionError(new Error(secret))).includes(secret));
const providers = getShortlistDataset();
const before = JSON.stringify(providers);
const result = publicEvidenceProviders(providers);
for (const slug of Object.keys(PROVIDER_SUMMARY_COPY)) {
  const row = result.find(v => v.slug === slug)!;
  assert(row, slug);
  assert(row.shortlist_summary.length < 180);
  assert(!row.shortlist_summary.endsWith("..."));
  assert.notEqual(row.best_fit_for[0], row.key_differentiators[0]);
  assert.deepEqual(row.capabilities, JSON.parse(JSON.stringify(providers.find(v=>v.slug===slug)!.capabilities).replaceAll('"unknown"','"not_confirmed"')));
}
assert.equal(JSON.stringify(providers), before, "source evidence and history unchanged");
console.log("PASS safe MCP recovery, no secret disclosure, concise summaries, unchanged source grades/history");
