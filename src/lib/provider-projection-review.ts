import sectorAdjudications from "../../data/provider-sector-adjudications.json";
import type { ShortlistVendor, CapabilityStatus } from "./shortlist-core";
import type { ProviderMatchRecord } from "./provider-matching";
export type ReviewedProjection = {
  reviewed_at: string;
  review_due: string;
  reviewer: string;
  source_urls: string[];
  qualification: string;
  sectors?: Partial<ShortlistVendor["sectors"]>;
  regions?: Partial<ShortlistVendor["regions"]>;
  uk_delivery?: ShortlistVendor["uk_delivery"];
  uk_basis?: string;
  deployment_speed?: ShortlistVendor["deployment_speed"];
  independent_evidence_source_count?: number;
};
/** Only source-checked field resolutions belong here. Historic grades are kept in
 * projection provenance, never blindly promoted over newer governed records. */
const reviewMeta = {
  reviewed_at: "2026-09-30T00:00:00Z",
  review_due: "2026-10-30T00:00:00Z",
  reviewer: "Codex primary-source review; human release sign-off pending",
};
export const REVIEWED_PROVIDER_PROJECTIONS: Record<string, ReviewedProjection> =
  {
    aryaka: {
      ...reviewMeta,
      sectors: { manufacturing: "yes" },
      regions: { uk_ireland: "partial" },
      source_urls: [
        "https://www.aryaka.com/case-study/albemarle/",
        "https://www.aryaka.com/solution-brief/regional-network/",
        "https://www.aryaka.com/press/cloud-first-managed-sd-wan-and-sase-pioneer-aryaka-activates-eu-friendly-dublin-services-pop-to-address-growing-customer-demand/",
      ],
      qualification:
        "Published manufacturing customer evidence for managed global WAN and last-mile services. Does not establish UK ten-site commercial fit or current supplier availability.",
    },
    cisco: {
      ...reviewMeta,
      sectors: { manufacturing: "yes", hospitality_leisure: "yes" },
      regions: { uk_ireland: "partial" },
      source_urls: [
        "https://www.cisco.com/c/dam/en/us/products/security/secure-access/customer-highlight-peco-foods.pdf",
        "https://www.cisco.com/site/us/en/about/case-studies-customer-stories/mitchells-butlers.html",
      ],
      qualification:
        "Peco Foods is identified as food manufacturing with a Cisco SASE deployment. Manufacturing evidence is US-based. The separate Mitchells and Butlers case documents UK hospitality SASE and Meraki SD-WAN. Regional coverage remains partial: it does not establish coverage of every UK/Ireland site or a contracting entity. Neither case certifies compliance or suitability for a particular estate.",
    },
    "bt-business": {
      ...reviewMeta,
      sectors: { financial_services: "yes" },
      source_urls: [
        "https://business.bt.com/insights/case-studies/financial-services-sd-wan/",
      ],
      qualification:
        "BT documents managed Agile Connect SD-WAN and Fortinet Firewall for a global banking organisation. Does not verify DORA/PCI compliance or a manufacturing deployment.",
    },
  };
for (const [slug, row] of Object.entries(sectorAdjudications)) {
  const previous = REVIEWED_PROVIDER_PROJECTIONS[slug];
  REVIEWED_PROVIDER_PROJECTIONS[slug] = {
    ...previous, ...row,
    sectors: {...previous?.sectors, ...row.sectors} as ReviewedProjection["sectors"],
    regions: {...previous?.regions, ...((row as ReviewedProjection).regions??{})} as ReviewedProjection["regions"],
    source_urls: [...new Set([...(previous?.source_urls ?? []), ...row.source_urls])],
    qualification: [previous?.qualification, row.qualification].filter(Boolean).join(" "),
  };
}
export function applyProjectionReview(
  provider: ShortlistVendor,
  record: Pick<ProviderMatchRecord, "revision_id" | "reviewed_at" | "sectors">,
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
    resolution: "source_review_required",
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
  for (const [region, status] of Object.entries(review.regions ?? {}))
    provider.regions[region as keyof typeof provider.regions] =
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
  provider.projection_provenance.active_review = {reviewed_at:review.reviewed_at,review_due:review.review_due,reviewer:review.reviewer,source_urls:review.source_urls,qualification:review.qualification,sectors:review.sectors??{},regions:review.regions??{}};
}
