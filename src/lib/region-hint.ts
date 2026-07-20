/**
 * Region hint from a buyer's email domain (20 July 2026).
 *
 * Lesson from the first ministry publish: the buyer left regions empty, so
 * supplier selection ran with zero geographic signal and shortlisted two
 * vendors our own dataset marks weak for their part of the world. Their
 * country was sitting in the email address the whole time.
 *
 * Rules, absolute:
 *  - A hint NEVER filters anyone out. It only adds ranking weight, via
 *    buildShortlist's preferred_regions (weight, no gate).
 *  - A hint is only derived when the buyer stated no regions themselves.
 *  - Every use is declared to the buyer as a labelled assumption they can
 *    override by editing their project's regions.
 *  - Country-code TLDs only. Generic domains (.com, .org, .net) say nothing
 *    about geography and return null.
 */

import type { RegionKey } from "@/lib/shortlist-core";
import { REGION_LABELS } from "@/lib/shortlist-core";

const TLD_REGIONS: Record<string, RegionKey> = {
  // UK and Ireland
  uk: "uk_ireland", ie: "uk_ireland",
  // Middle East (and Africa bucket in the dataset vocabulary)
  ae: "middle_east_africa", sa: "middle_east_africa", qa: "middle_east_africa",
  kw: "middle_east_africa", bh: "middle_east_africa", om: "middle_east_africa",
  jo: "middle_east_africa", eg: "middle_east_africa", il: "middle_east_africa",
  za: "middle_east_africa", ng: "middle_east_africa", ke: "middle_east_africa",
  ma: "middle_east_africa", tr: "middle_east_africa",
  // Europe
  de: "europe", fr: "europe", nl: "europe", es: "europe", it: "europe",
  se: "europe", no: "europe", dk: "europe", fi: "europe", pl: "europe",
  be: "europe", at: "europe", ch: "europe", pt: "europe", cz: "europe",
  ro: "europe", hu: "europe", gr: "europe", lu: "europe", eu: "europe",
  // North America
  us: "north_america", ca: "north_america", mx: "north_america",
  // Asia Pacific
  au: "asia_pacific", nz: "asia_pacific", sg: "asia_pacific", jp: "asia_pacific",
  in: "asia_pacific", hk: "asia_pacific", my: "asia_pacific", th: "asia_pacific",
  id: "asia_pacific", ph: "asia_pacific", vn: "asia_pacific", kr: "asia_pacific",
  tw: "asia_pacific",
  // Latin America
  br: "latin_america", ar: "latin_america", cl: "latin_america",
  co: "latin_america", pe: "latin_america",
  // China mainland
  cn: "china_mainland",
};

export interface RegionHint {
  region: RegionKey;
  label: string;
  /** The buyer-facing assumption sentence. */
  assumption: string;
}

/** Derive a soft region hint from an email's country-code TLD, or null. */
export function regionHintFromEmail(email: string | null | undefined): RegionHint | null {
  const domain = String(email ?? "").split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return null;
  const tld = domain.split(".").pop() ?? "";
  const region = TLD_REGIONS[tld];
  if (!region) return null;
  const label = REGION_LABELS[region];
  return {
    region,
    label,
    assumption: `Delivery region assumed as ${label} from your email address (.${tld}); supplier ranking was weighted accordingly. Edit your project's regions if delivery is elsewhere.`,
  };
}
