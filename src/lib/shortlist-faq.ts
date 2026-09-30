import {
  SECTOR_KEYS,
  SECTOR_LABELS,
  type ShortlistVendor,
} from "./shortlist-core";
import { shortlistEntity, providerTypes } from "./shortlist-entity";
import { SHORTLIST_FAQS } from "./shortlist-content";
import { sourcingUndertaking } from "./sourcing-contract";
export function shortlistFaqs(vendors: ShortlistVendor[]) {
  const entity = shortlistEntity(vendors);
  const date = entity.reviewed_at.slice(0, 10);
  const names = (rows: ShortlistVendor[]) =>
    rows
      .map((v) => v.name)
      .sort((a, b) => a.localeCompare(b, "en-GB"))
      .join(", ") || "none";
  const uk = vendors.filter((v) =>
    ["uk_hq", "uk_entity"].includes(v.uk_delivery),
  );
  const sase = uk.filter((v) =>
    [
      "yes",
      "partial",
      "partner_integrated",
      "managed_service_dependent",
    ].includes(v.capabilities.f28_full_sase_platform),
  );
  const managed = vendors.filter((v) => providerTypes(v).managed);
  const platform = vendors.filter((v) => providerTypes(v).technology);
  return [
    {
      q: "Which SD-WAN providers deliver nationwide in the UK?",
      a: `UK entity evidence: ${uk.length} providers (${names(uk)}); site serviceability not yet reviewed; reviewed on ${date}.`,
    },
    {
      q: "Which SASE vendors are UK-headquartered or contract through a UK entity?",
      a: `${sase.length} providers with UK entity and full SASE platform evidence: ${
        sase
          .map(
            (v) =>
              `${v.name}${v.capabilities.f28_full_sase_platform === "yes" ? "" : ` (${v.capabilities.f28_full_sase_platform.replaceAll("_", " ")})`}`,
          )
          .sort()
          .join(", ") || "none"
      }; reviewed on ${date}.`,
    },
    {
      q: "Which providers are managed service providers rather than technology vendors?",
      a: `${managed.length} managed service providers: ${names(managed)}; ${platform.length} technology vendors: ${names(platform)}; overlapping categories counted in each type; reviewed on ${date}.`,
    },
    ...SECTOR_KEYS.map((k) => {
      const yes = vendors.filter((v) => v.sectors[k] === "yes");
      const partial = vendors.filter((v) => v.sectors[k] === "partial");
      return {
        q: `Which providers have sector evidence for ${SECTOR_LABELS[k]}?`,
        a: `${yes.length} with public evidence: ${names(yes)}; ${partial.length} with partial evidence: ${names(partial)}; reviewed on ${date}.`,
      };
    }),
    SHORTLIST_FAQS.find((f) => f.q === "How does SD-WAN relate to SASE?")!,
    {
      q: "How does a UK business get comparable proposals from these providers?",
      a: [entity.desk_sentence, sourcingUndertaking()]
        .filter(Boolean)
        .join(" "),
    },
  ];
}
