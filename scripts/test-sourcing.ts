import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  SourcingRequestSchema,
  validateRecipients,
  responsePanelMember,
} from "../src/lib/sourcing-contract";
import type { SourcingRecord } from "../src/lib/sourcing-store";
// @ts-expect-error Node 24 provides registerHooks.
import { registerHooks } from "node:module";
registerHooks({
  resolve(s: string, c: object, n: (s: string, c: object) => { url: string }) {
    return s === "server-only"
      ? { url: "data:text/javascript,export {};", shortCircuit: true }
      : n(s, c);
  },
});
const { assertRequestConfirmation } = await import("../src/lib/sourcing-store");
import { publicShortlistPreview } from "../src/lib/public-shortlist";
import { publicEvidenceProviders } from "../src/lib/public-provider-evidence";
import { getShortlistDataset } from "../src/lib/vendors";
import { mergeNeonProviderRecords } from "../src/lib/live-shortlist";
import { applyProjectionReview } from "../src/lib/provider-projection-review";
import { SECTOR_KEYS } from "../src/lib/shortlist-core";
import { publicMarketRecord } from "../src/lib/market-record";
import type { ProviderMatchRecord } from "../src/lib/provider-matching";
const brief = {
  sites: 10,
  remote_users: 50,
  region: "uk_ireland",
  sector: "manufacturing",
  need: "sdwan",
  when: "Within 3 months",
  requirement: "Private details",
  supplier_brief: "Ten manufacturing sites in the UK",
};
const request = SourcingRequestSchema.parse({
  brief,
  email: "buyer@example.org",
  consent: true,
  anonymous: true,
  recipients: [{ slug: "bt-business", actions: ["proposals", "demo"] }],
  idempotency_key: randomUUID(),
});
assert.throws(() =>
  SourcingRequestSchema.parse({ ...request, consent: false }),
);
assert.throws(() =>
  SourcingRequestSchema.parse({ ...request, anonymous: false }),
);
assert.throws(() =>
  validateRecipients(
    { ...request, recipients: [...request.recipients, ...request.recipients] },
    ["bt-business"],
  ),
);
assert.throws(() => validateRecipients(request, []));
validateRecipients(request, ["bt-business"]);
assert.equal(responsePanelMember(undefined), false);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const token = "a".repeat(43);
const now = Date.now();
const record: SourcingRecord = {
  id: randomUUID(),
  project_id: "rfp_test",
  request,
  payload_hash: hash(JSON.stringify(request)),
  token_hash: hash(token),
  created_at: now,
  expires_at: now + 10000,
  status: "pending_confirmation",
  confirmed_at: null,
  mail_sent: true,
};
assertRequestConfirmation(record, token, now);
assert.throws(() => assertRequestConfirmation(record, "b".repeat(43), now));
assert.throws(() => assertRequestConfirmation(record, token, now + 10001));
assert.throws(() =>
  assertRequestConfirmation(
    { ...record, request: { ...request, recipients: [] } },
    token,
    now,
  ),
);
const base = getShortlistDataset();
const ordered = publicEvidenceProviders(base);
assert.equal(ordered.length, 30);
assert(
  ordered.every(
    (v, i) =>
      i === 0 ||
      ordered[i - 1].evidence_coverage_pct >= v.evidence_coverage_pct,
  ),
);
const open = publicShortlistPreview(base, {});
assert.equal(open.requires_publication, false);
assert.equal(open.matches.length, 30);
const source: ProviderMatchRecord = {
  provider_id: "bt",
  slug: "bt",
  display_name: "BT",
  provider_types: ["managed_service_provider"],
  revision_id: "test",
  dataset_version: "test",
  reviewed_at: "2026-09-01",
  primary_geographies: [],
  overview: "",
  product_names: [],
  target_buyers: [],
  integration_names: [],
  evidence_source_count: 1,
  capabilities: {
    sd_wan: {
      support_state: "supported",
      freshness_state: "current",
      confidence: "high",
      qualification: null,
    },
  },
  regions: {
    uk_ireland: { support_state: "supported", freshness_state: "current" },
  },
  service_models: {
    fully_managed: { support_state: "supported", freshness_state: "current" },
  },
  sectors: Object.fromEntries(
    SECTOR_KEYS.map((k) => [
      k,
      {
        support_state: "requires_confirmation",
        freshness_state: "current",
        evidence_strength: "strong",
      },
    ]),
  ),
};
// Match the actual governed slug mapping.
source.slug = "bt";
const [projected] = mergeNeonProviderRecords(base, [source]);
assert.equal(projected.uk_delivery, "uk_hq");
assert(projected.projection_provenance?.active_review?.source_urls.includes("https://find-and-update.company-information.service.gov.uk/company/04190816"));
assert.equal(projected.independent_evidence_source_count, undefined);
assert.equal(projected.projection_provenance?.sector_review_queue.length, 10);
assert.equal(
  publicShortlistPreview([projected], { sector: "manufacturing" }).matches
    .length,
  0,
  "Strong alone is not a match",
);
source.sectors.manufacturing = {
  support_state: "supported",
  freshness_state: "current",
  evidence_strength: "strong",
};
const [qualified] = mergeNeonProviderRecords(base, [source]);
assert.equal(
  publicShortlistPreview([qualified], {
    sector: "manufacturing",
    required_regions: ["uk_ireland"],
    required_features: ["f09_encrypted_overlay_fabric"],
  }).matches.length,
  1,
  "Source-qualified manufacturing provider is retained",
);
applyProjectionReview(
  qualified,
  source,
  base.find((v) => v.slug === qualified.slug)!,
  {
    reviewed_at: "2026-09-29",
    review_due: "2026-10-29",
    reviewer: "fixture reviewer",
    source_urls: ["https://example.org/evidence"],
    qualification: "Test fixture only",
    uk_delivery: "uk_hq",
    uk_basis: "Fixture",
  },
  Date.parse("2026-09-30"),
);
assert.equal(qualified.uk_delivery, "uk_hq");
assert.equal(
  publicMarketRecord({
    id: "test",
    project_id: "private",
    sector: "retail",
    site_band: "6–15",
    user_band: "25–100",
    scope: "test",
    approached: 1,
    acknowledged: 0,
    responded: 0,
    declined: 0,
    first_proposal_working_days: null,
    comparable_set_working_days: null,
    outcome: "incomplete",
    outcome_description: "test",
    participants: [],
    buyer_publication_consent: false,
    redaction_reviewed: true,
    evidence_references: ["private"],
    reporting_period: "test",
    recorded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  null,
);
console.log(
  "Sourcing tests passed: explicit consent, request binding, expiry, recipient validation, panel eligibility, all 30 providers, open evidence, sector qualification and private record suppression.",
);
