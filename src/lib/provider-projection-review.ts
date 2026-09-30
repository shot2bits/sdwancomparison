import type { ShortlistVendor, CapabilityStatus } from "./shortlist-core";
import type { ProviderMatchRecord } from "./provider-matching";
export type ReviewedProjection = {
  reviewed_at: string;
  review_due: string;
  reviewer: string;
  source_urls: string[];
  qualification: string;
  sectors?: Partial<ShortlistVendor["sectors"]>;
  uk_delivery?: ShortlistVendor["uk_delivery"];
  uk_basis?: string;
  deployment_speed?: ShortlistVendor["deployment_speed"];
  independent_evidence_source_count?: number;
};
/** Only source-checked field resolutions belong here. Historic grades are kept in
 * projection provenance, never blindly promoted over newer governed records. */
export const REVIEWED_PROVIDER_PROJECTIONS: Record<string, ReviewedProjection> =
  {};
export function applyProjectionReview(
  provider: ShortlistVendor,
  record: ProviderMatchRecord,
  original: ShortlistVendor,
  review = REVIEWED_PROVIDER_PROJECTIONS[provider.slug],
  now = Date.now(),
) {
  provider.projection_provenance = {
    contract: "projection-review/1",
    governed_revision: record.revision_id,
    curated_reviewed_at: original.last_verified,
    curated_sectors: { ...original.sectors },
    curated_uk_delivery: original.uk_delivery,
    curated_uk_basis: original.uk_basis,
    sector_review_queue: Object.entries(record.sectors)
      .filter(
        ([, r]) =>
          r.evidence_strength === "strong" &&
          !["supported", "partially_supported", "partner_delivered"].includes(
            r.support_state,
          ),
      )
      .map(([sector, r]) => ({
        sector,
        reason:
          "Strong case-study evidence and non-positive suitability require source-level review",
        support_state: r.support_state,
        qualification: r.qualification ?? null,
        named_evidence: r.named_evidence ?? null,
        evidence_source_ids: r.evidence_source_ids ?? [],
      })),
    resolution: review ? "reviewed_override" : "source_review_required",
  };
  if (
    !review ||
    !review.reviewer ||
    !review.source_urls.length ||
    now < Date.parse(review.reviewed_at) ||
    now >= Date.parse(review.review_due)
  )
    return;
  if (
    record.reviewed_at &&
    Date.parse(record.reviewed_at) > Date.parse(review.reviewed_at)
  )
    return;
  for (const [sector, status] of Object.entries(review.sectors ?? {}))
    provider.sectors[sector as keyof typeof provider.sectors] =
      status as CapabilityStatus;
  if (review.uk_delivery && review.uk_basis) {
    provider.uk_delivery = review.uk_delivery;
    provider.uk_basis = review.uk_basis;
  }
  if (review.deployment_speed)
    provider.deployment_speed = review.deployment_speed;
  if (review.independent_evidence_source_count !== undefined)
    provider.independent_evidence_source_count =
      review.independent_evidence_source_count;
  provider.projection_provenance.resolution = "reviewed_override";
}
