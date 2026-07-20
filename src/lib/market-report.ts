/**
 * The Netify Market Report: the instant, automated reward for publishing an
 * RFP (Robert's publish-value decision, 18 July 2026). Generated synchronously
 * from data the app already holds, so it can never be late and never invents:
 *  - matched suppliers come from the vendor dataset (supplier-match);
 *  - the price band comes from the TCO estimator engine (Methodology v2026.1),
 *    with every inference from RFP fields recorded as a labelled assumption;
 *  - gaps are deterministic checks on the RFP itself, no AI.
 * The human layer is deliberately uncommitted: "a Netify analyst reviews every
 * published RFP" — no response time is promised anywhere.
 */

import { estimate, type EstimateResult } from "@/lib/estimator/engine";
import { matchSuppliers } from "@/lib/supplier-match";
import { regionHintFromEmail } from "@/lib/region-hint";
import { includedSections } from "@/lib/rfp-document";
import { USERS_BANDS } from "@/lib/notice-options";
import type { ProjectDetails } from "@/lib/rfp-types";

export type MarketReport = {
  generated_at: number;
  /** Matched supplier names/count from the dataset (same engine as the wizard panel). */
  matched: { count: number; names: string[]; region_assumption?: string };
  /** Indicative price band, or null when the estate cannot be banded honestly. */
  estimate: {
    monthly_band_gbp: [number, number];
    three_year_tco_band_gbp: [number, number];
    methodology_version: string;
    disclaimer: string;
  } | null;
  /** Every inference made to produce the band, stated plainly. */
  assumptions: string[];
  /** Deterministic completeness checks on the RFP document itself. */
  gaps: string[];
  document: { sections: number; questions: number };
  /** The uncommitted human layer, stated once so every surface says the same thing. */
  analyst_note: string;
};

export const ANALYST_NOTE =
  "A Netify analyst reviews every published RFP and follows up where a human read adds value.";

/** Map wizard region keys onto estimator region enums. */
const REGION_MAP: Record<string, "uk-europe" | "north-america" | "apac" | "middle-east-africa" | "latam"> = {
  uk_ireland: "uk-europe",
  europe: "uk-europe",
  north_america: "north-america",
  asia_pacific: "apac",
  middle_east_africa: "middle-east-africa",
  latin_america: "latam",
};

/** Representative user counts per wizard band (band midpoints, floored to the engine minimum). */
const USERS_FOR_BAND: Record<string, number> = {
  under_100: 75,
  "100-500": 300,
  "500-2500": 1200,
  "2500-10000": 5000,
  "10000+": 15000,
};

/**
 * The wizard stores the users band only in buyer.notes ("Users: 100–500
 * users."), so recover it from the label. Returns the band key or null.
 */
function usersBandFromNotes(notes: string): string | null {
  const m = notes.match(/Users:\s*([^.]+)\./);
  if (!m) return null;
  const label = m[1].trim();
  const band = USERS_BANDS.find((b) => b.label === label);
  return band ? band.key : null;
}

function estimateForProject(p: ProjectDetails): { result: EstimateResult | null; assumptions: string[] } {
  const assumptions: string[] = [];

  // Users: from the wizard band via notes, else a stated assumption.
  const bandKey = usersBandFromNotes(p.buyer.notes ?? "");
  let users: number;
  if (bandKey && USERS_FOR_BAND[bandKey]) {
    users = USERS_FOR_BAND[bandKey];
    assumptions.push(`User count banded as ${bandKey.replace(/_/g, " ")} (modelled at ${users} users).`);
  } else {
    users = 250;
    assumptions.push("User count not provided; the band assumes 250 users. Rerun with your own numbers in the cost estimator.");
  }

  // Sites: the wizard already stores a representative count.
  const sites = p.buyer.site_count && p.buyer.site_count > 0 ? p.buyer.site_count : 5;
  if (!p.buyer.site_count) assumptions.push("Site count not provided; the band assumes 5 sites.");

  // Regions: mapped; unmapped or empty falls back to UK & Europe.
  const mapped = Array.from(new Set((p.buyer.regions ?? []).map((r) => REGION_MAP[r]).filter(Boolean)));
  const regions = (mapped.length > 0 ? mapped : ["uk-europe" as const]).slice(0, 5);
  if (mapped.length === 0) assumptions.push("No regions provided; the band assumes UK & Europe.");

  // Security depth from product scope. SD-WAN-only estates are banded on the
  // lightest security profile the methodology models; stated, not hidden.
  let securityDepth: "sse-only" | "full-sase" | "full-sase-plus-advanced";
  if (p.buyer.product_scope === "sse_only") securityDepth = "sse-only";
  else if (p.buyer.product_scope === "sdwan_only") {
    securityDepth = "sse-only";
    assumptions.push("SD-WAN-only scope banded on the methodology's lightest security profile; treat the security share of the band as optional.");
  } else securityDepth = "full-sase";

  // Delivery model; "any" is banded co-managed as the neutral middle.
  const om = p.buyer.operating_model;
  const deliveryModel: "managed" | "co-managed" | "diy" = om === "managed" ? "managed" : om === "diy" ? "diy" : om === "co_managed" ? "co-managed" : "co-managed";
  if (om !== "managed" && om !== "diy" && om !== "co_managed") assumptions.push("No delivery model preference; the band assumes co-managed.");

  assumptions.push("Banded at a 3 year term.");

  try {
    const result = estimate({ users, sites, regions, securityDepth, deliveryModel, termYears: 3 });
    return { result, assumptions };
  } catch {
    return { result: null, assumptions };
  }
}

/** Deterministic completeness checks: facts about the document, no AI. */
function gapChecks(p: ProjectDetails): string[] {
  const gaps: string[] = [];
  const b = p.buyer;
  if (!b.sector) gaps.push("No sector stated. Sector context sharpens supplier answers and reference cases.");
  if (!b.site_count) gaps.push("No site count stated. Suppliers will price more accurately with an estate size.");
  if ((b.regions ?? []).length === 0) gaps.push("No regions stated. Coverage answers cannot be checked without them.");
  if ((b.compliance ?? []).length === 0) gaps.push("No compliance requirements listed. If any apply (PCI DSS, ISO 27001, Cyber Essentials), suppliers should evidence them.");
  if (!/Timeline|go-live|golive/i.test(b.notes ?? "")) gaps.push("No timeline stated. A target go-live focuses supplier responses.");
  const sections = includedSections(p);
  const mandatory = sections.reduce((n, s) => n + s.questions.filter((q) => q.mandatory).length, 0);
  if (mandatory === 0) gaps.push("No questions are flagged as hard requirements yet. Marking your deal-breakers improves the scoring matrix.");
  return gaps;
}

export function buildMarketReport(p: ProjectDetails): MarketReport {
  const statedRegions = (p.buyer.regions ?? []).filter(Boolean);
  const regionHint = statedRegions.length === 0 ? regionHintFromEmail(p.owner_email) : null;
  const matched = matchSuppliers({
    scope: p.buyer.product_scope,
    regions: statedRegions,
    model: p.buyer.operating_model,
    ...(regionHint ? { preferred_regions: [regionHint.region] } : {}),
  });
  const { result, assumptions } = estimateForProject(p);
  const sections = includedSections(p);
  return {
    generated_at: Date.now(),
    matched: {
      count: matched.count,
      names: matched.names,
      ...(regionHint ? { region_assumption: regionHint.assumption } : {}),
    },
    estimate: result
      ? {
          monthly_band_gbp: result.monthlyBandGBP,
          three_year_tco_band_gbp: result.threeYearTcoBandGBP,
          methodology_version: result.methodologyVersion,
          disclaimer: result.disclaimer,
        }
      : null,
    assumptions,
    gaps: gapChecks(p),
    document: {
      sections: sections.length,
      questions: sections.reduce((n, s) => n + s.questions.length, 0),
    },
    analyst_note: ANALYST_NOTE,
  };
}

export function formatBandGBP(band: [number, number]): string {
  const f = (n: number) => `£${n.toLocaleString("en-GB")}`;
  return `${f(band[0])} to ${f(band[1])}`;
}
