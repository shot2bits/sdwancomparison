import { comparisonSlugForGovernedProvider } from "./governed-provider-catalogue";
import { sectorSignoff, type SectorSignoff } from "./sector-signoff";
import sectorAdjudications from "../../data/provider-sector-adjudications.json";
import type { ShortlistVendor, CapabilityStatus } from "./shortlist-core";
import type { ProviderMatchRecord } from "./provider-matching";
export type ReviewedProjection = {
  reviewed_at: string;
  review_due: string;
  reviewer: string;
  sector_signoff?: SectorSignoff;
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
for (const [sourceSlug, row] of Object.entries(sectorAdjudications)) {
  const slug = comparisonSlugForGovernedProvider(sourceSlug);
  const previous = REVIEWED_PROVIDER_PROJECTIONS[slug];
  REVIEWED_PROVIDER_PROJECTIONS[slug] = {
    ...previous,
    ...row,
    reviewer: sectorSignoff(row).label,
    sector_signoff: sectorSignoff(row),
    sectors: {
      ...previous?.sectors,
      ...row.sectors,
    } as ReviewedProjection["sectors"],
    regions: {
      ...previous?.regions,
      ...((row as ReviewedProjection).regions ?? {}),
    } as ReviewedProjection["regions"],
    source_urls: [
      ...new Set([...(previous?.source_urls ?? []), ...row.source_urls]),
    ],
    qualification: [previous?.qualification, row.qualification]
      .filter(Boolean)
      .join(" "),
  };
}
// Comparison slugs are intentionally used here: governed "colt" maps to
// "colt-technology-services"; Virgin's existing comparison key has no -business.
export const UK_CARRIER_REVIEWS: Record<string, ReviewedProjection> = {
  "bt-business": {
    ...reviewMeta,
    reviewed_at: "2026-09-30T19:56:00Z",
    uk_delivery: "uk_hq",
    regions: { uk_ireland: "yes" },
    uk_basis:
      "BT Group plc is headquartered at 1 Braham Street, London; UK managed SD-WAN is published by BT Business.",
    source_urls: [
      "https://www.bt.com/about/contact-bt",
      "https://find-and-update.company-information.service.gov.uk/company/04190816",
      "https://business.bt.com/networks-digital-services/sd-wan/",
    ],
    qualification:
      "UK headquarters and a published UK SD-WAN offering are confirmed. This is not a quote, site serviceability check or confirmation of the legal entity signing a particular order. The combined UK/Ireland yes flag records UK delivery evidence; Irish coverage must be checked separately.",
  },
  "virgin-media-o2": {
    ...reviewMeta,
    reviewed_at: "2026-09-30T19:56:00Z",
    uk_delivery: "uk_entity",
    regions: { uk_ireland: "yes" },
    uk_basis:
      "Virgin Media Business Limited, company 01785381, publishes its registered office in Reading and UK business network service terms.",
    source_urls: [
      "https://www.virginmediabusiness.co.uk/legal/terms-and-conditions/",
      "https://www.virginmediabusiness.co.uk/legal/privacy-policy/",
    ],
    qualification:
      "The published business terms name Virgin Media Business Limited and include SD-WAN and UK managed IPVPN schedules. This is evidence of a UK contracting entity, not confirmation of a specific estate, Irish availability, response commitment or the entity used for a separate O2 service.",
  },
  "vodafone-business": {
    ...reviewMeta,
    reviewed_at: "2026-09-30T19:56:00Z",
    uk_delivery: "uk_entity",
    regions: { uk_ireland: "yes" },
    uk_basis:
      "Vodafone Limited, company 01471587, identifies its registered office in Newbury; the Optos SD-WAN case includes UK operations.",
    source_urls: [
      "https://www.vodafone.co.uk/privacy",
      "https://www.vodafone.co.uk/business/case-studies/sd-wan-keeps-optos-connected-worldwide",
    ],
    qualification:
      "Vodafone Limited UK entity and UK SD-WAN delivery evidence are confirmed. Group branding does not determine the contracting entity for an individual quote. Irish coverage, address availability and current supplier fit require confirmation.",
  },
  "colt-technology-services": {
    ...reviewMeta,
    reviewed_at: "2026-09-30T19:56:00Z",
    uk_delivery: "uk_entity",
    regions: { uk_ireland: "yes" },
    uk_basis:
      "Colt Technology Services Group Limited, company 03232904, is registered at Colt House, 20 Great Eastern Street, London. Colt publishes a London SD-WAN deployment.",
    source_urls: [
      "https://docs.colt.net/legal/terms-and-conditions",
      "https://docs.colt.net/legal/colt-group-of-companies",
      "https://find-and-update.company-information.service.gov.uk/company/03232904",
      "https://www.colt.net/customer-stories/byblos-bank-europe",
    ],
    qualification:
      "The named UK group entity operates the website; the trading-company list separately identifies Colt Technology Services (02452736) in England and Wales. The group entity is not assumed to sign each service contract. The Byblos Bank Europe case includes London SD-WAN delivery. Actual trading entity, each site and Irish coverage require order-specific confirmation.",
  },
};
for (const [slug, uk] of Object.entries(UK_CARRIER_REVIEWS)) {
  const previous = REVIEWED_PROVIDER_PROJECTIONS[slug];
  REVIEWED_PROVIDER_PROJECTIONS[slug] = {
    ...previous,
    ...uk,
    reviewer: previous?.reviewer ?? uk.reviewer,
    sector_signoff: previous?.sector_signoff,
    sectors: previous?.sectors,
    regions: { ...previous?.regions, ...uk.regions },
    source_urls: [
      ...new Set([...(previous?.source_urls ?? []), ...uk.source_urls]),
    ],
    qualification: [
      previous?.qualification,
      `UK review update (supersedes earlier UK-region qualification): ${uk.qualification}`,
    ]
      .filter(Boolean)
      .join(" "),
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
  provider.projection_provenance.active_review = {
    reviewed_at: review.reviewed_at,
    review_due: review.review_due,
    reviewer: review.reviewer,
    sector_signoff: review.sector_signoff,
    source_urls: review.source_urls,
    qualification: review.qualification,
    sectors: review.sectors ?? {},
    regions: review.regions ?? {},
  };
}
