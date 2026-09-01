import assert from "node:assert/strict";
import { withFakeKv } from "./fake-kv-harness";

await withFakeKv(async () => {
  const { kvSetJson, saveOpportunity } = await import("../src/lib/rfp-store");
  const { OpportunitySchema } = await import("../src/lib/opportunity-types");
  const { saveFrozenRevision } = await import("../src/lib/published-snapshot");
  const { getMarketUnlock, isMarketUnlocked, commitMarketUnlock } = await import("../src/lib/market-unlock");

  const projectId = "rfp-policy-kv";
  const revisionId = "snap-policy-kv";
  const opportunityId = "opp-policy-kv";
  await saveFrozenRevision({
    id: revisionId,
    project_id: projectId,
    content_hash: "correct-hash",
    frozen_content: {
      title: "Policy fixture",
      buyer: {
        organisation: "", sector: null, organisation_size: "any", site_count: null,
        regions: [], compliance: [], operating_model: "any", product_scope: "not_stated",
        pinned_vendors: [], notes: "",
      },
      rfp_sections: [],
    },
    created_at: 1,
  });
  await saveOpportunity(OpportunitySchema.parse({
    id: opportunityId,
    created: 1,
    updated: 1,
    title: "Policy fixture",
    scope: ["sase"],
    buyer_token: "private",
    visibility: "public",
    source_rfp_id: projectId,
    source_published_revision_id: revisionId,
  }));

  await kvSetJson(`rfp:${projectId}:market_unlock`, {
    id: "mktu-forged",
    project_id: projectId,
    published_revision_id: revisionId,
    board_opportunity_id: opportunityId,
    board_visibility: "public",
    matching_basis_hash: "forged-hash",
    invitation_snapshot_id: revisionId,
    unlocked_at: 1,
  });
  assert.equal(await getMarketUnlock(projectId), null, "forged hash must read as locked");
  assert.equal(await isMarketUnlocked(projectId), false, "supplier access must remain locked");

  const repaired = await commitMarketUnlock({
    project_id: projectId,
    published_revision_id: revisionId,
    board_opportunity_id: opportunityId,
  });
  assert.equal(repaired.matching_basis_hash, "correct-hash", "exact-triple replay must revalidate and repair, never trust the forged row");
  assert.equal(await isMarketUnlocked(projectId), true, "a valid persisted binding unlocks normally");

  await kvSetJson(`rfp:${projectId}:market_unlock`, { ...repaired, published_revision_id: "snap-stale" });
  assert.equal(await getMarketUnlock(projectId), null, "stale revision must read as locked");

  await kvSetJson(`rfp:${projectId}:market_unlock`, { ...repaired, board_opportunity_id: "opp-mismatch" });
  assert.equal(await getMarketUnlock(projectId), null, "mismatched opportunity must read as locked");
});

console.log("PASS  persisted forged, stale and mismatched MarketUnlock rows fail closed");
