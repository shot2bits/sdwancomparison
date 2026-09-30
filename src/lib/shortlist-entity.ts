import review from "../../data/shortlist-review.json";
import { UK_CARRIER_REVIEWS } from "./provider-projection-review";
import {
  SECTOR_KEYS,
  SECTOR_LABELS,
  REGION_LABELS,
  ORG_SIZE_KEYS,
  ORG_SIZE_LABELS,
  type ShortlistVendor,
} from "./shortlist-core";

export const SHORTLIST_ENTITY_H1 =
  "Compare SD-WAN and SASE providers for UK businesses";
export function providerTypes(v: ShortlistVendor) {
  const category = v.category.toLowerCase();
  const technology =
    category.includes("technology vendor") ||
    (!/(managed .*provider|carrier|connectivity provider|network provider|naas provider)/i.test(
      category,
    ) &&
      /(vendor|platform|network services)/i.test(category));
  const carrier =
    /carrier/.test(category) || Boolean(UK_CARRIER_REVIEWS[v.slug]);
  const managed = /managed .*provider/.test(category);
  return { technology, carrier, managed };
}
export function latestReview(vendors: ShortlistVendor[]) {
  return (
    vendors
      .flatMap((v) => [
        v.last_verified,
        v.projection_provenance?.active_review?.reviewed_at,
        ...Object.values(v.capability_evidence ?? {}).map((e) => e.reviewed_at),
      ])
      .filter((s): s is string => Boolean(s) && Number.isFinite(Date.parse(s!)))
      .sort((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1) ?? ""
  );
}
export function ukStatus(v: ShortlistVendor) {
  const review = UK_CARRIER_REVIEWS[v.slug];
  const active =
    review &&
    review.uk_delivery === v.uk_delivery &&
    !["review_expired", "source_newer_than_review"].includes(
      v.projection_provenance?.resolution ?? "",
    );
  return {
    status: v.uk_delivery,
    label:
      v.uk_delivery === "uk_hq"
        ? "UK headquartered"
        : v.uk_delivery === "uk_entity"
          ? "UK contracting entity"
          : "UK entity not yet reviewed",
    source_urls: active ? review.source_urls : [],
    reviewed_at: active ? review.reviewed_at : null,
    qualification: active ? review.qualification : null,
  };
}
/** Server callers pass the current dataset; no provider counts are hard-coded. */
export function shortlistEntity(
  vendors: ShortlistVendor[],
  h1 = SHORTLIST_ENTITY_H1,
) {
  const types = vendors.map(providerTypes);
  const counts = {
    providers: vendors.length,
    technology_vendors: types.filter((t) => t.technology).length,
    uk_carriers: vendors.filter(
      (v, i) =>
        types[i].carrier && ["uk_hq", "uk_entity"].includes(v.uk_delivery),
    ).length,
    managed_service_providers: types.filter((t) => t.managed).length,
  };
  const overlap = vendors.some(
    (v, i) =>
      Number(types[i].technology) +
        Number(
          types[i].carrier && ["uk_hq", "uk_entity"].includes(v.uk_delivery),
        ) +
        Number(types[i].managed) >
      1,
  );
  const uk = vendors.filter((v) =>
    ["uk_hq", "uk_entity"].includes(v.uk_delivery),
  ).length;
  const pending = vendors.filter(
    (v) => v.uk_delivery === "not_confirmed",
  ).length;
  const reviewed =
    Object.values(UK_CARRIER_REVIEWS)
      .map((r) => r.reviewed_at)
      .sort()
      .at(-1)
      ?.slice(0, 10) ?? "";
  return {
    h1,
    counts,
    count_sentence: `Compare ${vendors.length} researched SD-WAN and SASE providers across operating model, network and security capability. ${counts.technology_vendors} technology vendors; ${counts.uk_carriers} UK carriers; ${counts.managed_service_providers} managed service providers${overlap ? "; overlapping categories counted in each type" : ""}.`,
    uk_sentence: `${uk} UK-headquartered or UK-entity providers; ${pending} UK entity statuses not yet reviewed; UK carrier evidence reviewed on ${reviewed}.`,
    market_structure_sentence: review.market_structure_sentence,
    desk_sentence: review.desk_sentence,
    reviewer: {
      name: review.name,
      role: review.role,
      reviewed_at: review.reviewed_at,
    },
    reviewed_at: latestReview(vendors),
  };
}
export function bestFor(v: ShortlistVendor) {
  const sectors_yes = SECTOR_KEYS.filter((k) => v.sectors[k] === "yes").map(
    (k) => SECTOR_LABELS[k],
  );
  const sectors_partial = SECTOR_KEYS.filter(
    (k) => v.sectors[k] === "partial",
  ).map((k) => SECTOR_LABELS[k]);
  const regions = (["uk_ireland", "europe"] as const)
    .filter((k) => v.regions[k] === "yes")
    .map((k) => REGION_LABELS[k]);
  const size = ORG_SIZE_KEYS.filter((k) =>
    ["yes", "partial"].includes(v.organisation_fit[k]),
  ).map(
    (k) =>
      ORG_SIZE_LABELS[k] +
      (v.organisation_fit[k] === "partial" ? " (partial evidence)" : ""),
  );
  const platform = v.capabilities.f02_diy_self_managed_model === "yes";
  const managed = v.capabilities.f01_fully_managed_service === "yes";
  const service_model =
    platform && managed
      ? "both"
      : platform
        ? "platform"
        : managed
          ? "managed"
          : "not_confirmed";
  const signoff =
    v.projection_provenance?.active_review?.sector_signoff?.label ?? "";
  const fields = {
    sectors_yes,
    sectors_partial,
    regions,
    size,
    service_model,
    signoff,
  };
  const text = [
    ...(sectors_yes.length || sectors_partial.length
      ? [
          ...sectors_yes,
          ...sectors_partial.map((s) => `${s} (partial evidence)`),
        ]
      : ["Sector evidence not yet reviewed"]),
    ...regions,
    ...size,
    service_model === "not_confirmed"
      ? "Service model not yet reviewed"
      : service_model,
    signoff,
  ]
    .filter(Boolean)
    .join("; ");
  return { best_for: text, best_for_fields: fields };
}
