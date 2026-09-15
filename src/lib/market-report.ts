/**
 * The Netify Market Report: the instant, automated reward for publishing an
 * RFP (Robert's publish-value decision, 18 July 2026). Generated synchronously
 * from data the app already holds, so it can never be late and never invents:
 *  - matched suppliers come from the vendor dataset (supplier-match);
 *  - the price band comes from the TCO estimator engine (Methodology v2026.1),
 *    with every inference from RFP fields recorded as a labelled assumption;
 *  - gaps are deterministic checks on the RFP itself, no AI.
 * The human layer states only what the machinery does (29 Jul 2026, the
 * analyst-review claim retired): every publish lands on the internal
 * follow-up list, and no response time is promised anywhere.
 */

import { currentBuyerFacts, projectWithCurrentBuyerFacts, currentDocumentCounts } from "./current-buyer-facts";
import { estimate, type EstimateResult } from "@/lib/estimator/engine";
import { FOLLOW_UP_NOTE } from "@/lib/publish-promises";
import { matchSuppliers } from "@/lib/supplier-match";
import { regionHintFromEmail } from "@/lib/region-hint";
import { includedSections } from "@/lib/rfp-document";
import { ESTIMATE_DISCLOSURE } from "./estimator/input";
import type { ShortlistVendor } from "@/lib/shortlist-core";
import type { ProjectDetails } from "@/lib/rfp-types";

export type MarketReport = {
  generated_at: number;
  buyer_facts?: ReturnType<typeof currentBuyerFacts>;
  /** Matched supplier names/count from the dataset (same engine as the wizard panel).
   *  Phase 2 (14 Aug 2026): `total_evaluated_market` is the size of the
   *  WHOLE vendor dataset (matchSuppliers()'s own `total`, never
   *  scope/region-filtered) -- the general marketplace figure the publish
   *  lifecycle brief permits showing before publication, clearly labelled
   *  as the general market, never as this project's matches. `count` and
   *  `names` remain this project's actual ranked/filtered matches and MUST
   *  stay hidden until publication (see /api/rfp/[id]/report/route.ts). */
  matched: { count: number; names: string[]; total_evaluated_market: number | null; region_assumption?: string };
  /** Indicative price band, or null when the estate cannot be banded honestly. */
  estimate: {
    monthly_band_gbp: [number, number];
    three_year_tco_band_gbp: [number, number];
    methodology_version: string;
    disclaimer: string;
    source: string;
    source_date: string | null;
    generated_at: number;
    inclusions: string[];
    exclusions: string[];
    uncertainty: string;
  } | null;
  /** Every inference made to produce the band, stated plainly. */
  assumptions: string[];
  /** Deterministic completeness checks on the RFP document itself. */
  gaps: string[];
  document: { sections: number; questions: number; requirements?: number };
  /** The uncommitted human layer, stated once so every surface says the same thing. */
  analyst_note: string;
};

export const ANALYST_NOTE = FOLLOW_UP_NOTE;

/** Map wizard region keys onto estimator region enums. */
const REGION_MAP: Record<string, "uk-europe" | "north-america" | "apac" | "middle-east-africa" | "latam"> = {
  uk_ireland: "uk-europe",
  europe: "uk-europe",
  north_america: "north-america",
  asia_pacific: "apac",
  middle_east_africa: "middle-east-africa",
  latin_america: "latam",
};

function estimateForProject(p: ProjectDetails): { result: EstimateResult | null; assumptions: string[] } {
  const f = currentBuyerFacts(p);
  const assumptions = [f.source === "buyer_fact_ledger" ? "Based on current buyer-confirmed project facts." : f.source === "legacy_document_snapshot" ? "Based on the historical saved document; original confirmation provenance is unavailable." : "Based on the legacy buyer record; confirm these details before relying on the budget."];
  if (f.users === undefined) return {result:null, assumptions:[...assumptions,"No confirmed user count is available. Confirm your licensed users or request supplier pricing; no population has been assumed."]};
  assumptions.push(`Current project population: ${f.users} users.`);
  if (f.users < 50 || f.users > 250000) return {result:null, assumptions:[...assumptions,`Your stated ${f.users} users are outside the model’s supported range of 50–250,000 users. Request supplier pricing for this estate.`]};
  if (!f.sites) return {result:null, assumptions:[...assumptions,"No current site count is available. Confirm your sites or request supplier pricing."]};
  const aliases: Record<string,string> = {uk:'uk_ireland',ie:'uk_ireland',eu:'europe',us:'north_america',apac:'asia_pacific',china:'asia_pacific',me:'middle_east_africa',latam:'latin_america'};
  const mapped = f.regions.map(r => REGION_MAP[aliases[r] ?? r]);
  if (!mapped.length || mapped.some(r => !r)) return {result:null, assumptions:[...assumptions,"Confirm the regions supported by this model or request supplier pricing; no region has been assumed."]};
  const regions = [...new Set(mapped)];
  if (f.scope === 'not_stated' || f.operating_model === 'any') return {result:null, assumptions:[...assumptions,"Confirm solution scope and delivery model before estimating."]};
  const securityDepth = f.scope === 'sse_only' || f.scope === 'sdwan_only' ? 'sse-only' : 'full-sase';
  if (f.scope === 'sdwan_only') assumptions.push("SD-WAN-only scope is modelled with the lightest security profile; security is an optional model component, not a confirmed requirement.");
  const deliveryModel = f.operating_model === 'co_managed' ? 'co-managed' : f.operating_model;
  assumptions.push("Provisional budget at a three-year term, not a supplier quote.", ESTIMATE_DISCLOSURE,
    "Source: Netify SASE Methodology 2026.1; a calibration source date is not recorded. Estimate date is the report generation date.",
    "Model includes licensing, site/regional loading, managed-service loading, implementation/migration and recurring overhead assumptions. Supplier-specific tariffs, actual connectivity circuit quotes and tax treatment require supplier confirmation.");
  try { return {result:estimate({users:f.users,sites:f.sites,regions,securityDepth,deliveryModel,termYears:3}),assumptions}; }
  catch { return {result:null, assumptions:[...assumptions,"This estate is outside the model input constraints. Request supplier pricing."]}; }
}

/** Deterministic completeness checks: facts about the document, no AI. */
function gapChecks(p: ProjectDetails): string[] {
  const gaps: string[] = [];
  const b = p.buyer;
  const facts = currentBuyerFacts(p);
  if (!b.sector) gaps.push("No sector stated. Sector context sharpens vendor answers and reference cases.");
  if (!(facts.canonical ? facts.sites : b.site_count)) gaps.push("No site count stated. Vendors will price more accurately with an estate size.");
  if ((b.regions ?? []).length === 0) gaps.push("No regions stated. Coverage answers cannot be checked without them.");
  if ((b.compliance ?? []).length === 0) gaps.push("No compliance requirements listed. If any apply (PCI DSS, ISO 27001, Cyber Essentials), vendors should evidence them.");
  if (!(facts.canonical ? facts.timeline : /Timeline|go-live|golive/i.test(b.notes ?? ""))) gaps.push("No timeline stated. A target go-live focuses vendor responses.");
  const sections = includedSections(p);
  const mandatory = p.procurement_document ? p.procurement_document.clauses.filter(c => c.mandatory).length : sections.reduce((n, s) => n + s.questions.filter((q) => q.mandatory).length, 0);
  if (mandatory === 0) gaps.push("No questions are flagged as hard requirements yet. Marking your deal-breakers improves the scoring matrix.");
  return gaps;
}

export function buildMarketReport(p: ProjectDetails, vendors?: ShortlistVendor[]): MarketReport {
  p = projectWithCurrentBuyerFacts(p);
  const statedRegions = (p.buyer.regions ?? []).filter(Boolean);
  const regionHint = !currentBuyerFacts(p).canonical && statedRegions.length === 0 ? regionHintFromEmail(p.owner_email) : null;
  const matched = matchSuppliers({
    scope: p.buyer.product_scope,
    regions: statedRegions,
    model: p.buyer.operating_model,
    ...(regionHint ? { preferred_regions: [regionHint.region] } : {}),
  }, vendors);
  const { result, assumptions } = estimateForProject(p);
  return {
    generated_at: Date.now(),
    buyer_facts: currentBuyerFacts(p),
    matched: {
      count: matched.count,
      names: matched.names,
      total_evaluated_market: matched.total,
      ...(regionHint ? { region_assumption: regionHint.assumption } : {}),
    },
    estimate: result
      ? {
          monthly_band_gbp: result.monthlyBandGBP,
          three_year_tco_band_gbp: result.threeYearTcoBandGBP,
          methodology_version: result.methodologyVersion,
          disclaimer: result.disclaimer,
          source: "Netify SASE Methodology 2026.1 (provisional assumptions)",
          source_date: null,
          generated_at: Date.now(),
          inclusions: ["Licence and site/regional cost assumptions", "Delivery/support loading", "Implementation and migration amortised over three years", "Recurring overhead assumptions"],
          exclusions: ["Supplier-specific quotes and negotiated tariffs", "Confirmed access-circuit prices", "Confirmed tax treatment"],
          uncertainty: ESTIMATE_DISCLOSURE,
        }
      : null,
    assumptions,
    gaps: gapChecks(p),
    document: currentDocumentCounts(p),
    analyst_note: ANALYST_NOTE,
  };
}

export function formatBandGBP(band: [number, number]): string {
  const f = (n: number) => `£${n.toLocaleString("en-GB")}`;
  return `${f(band[0])} to ${f(band[1])}`;
}
