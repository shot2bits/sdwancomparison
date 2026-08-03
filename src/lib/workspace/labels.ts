/**
 * The single canonical AllowedPath -> human label table (Milestone 1,
 * Commit 1: the live Understanding surface needs a per-fact label for
 * every path the ledger can hold, including the seven PKM extension
 * paths, and no such table existed yet).
 *
 * DISPLAY-side only, same convention as security/labels.ts's
 * SECURITY_CODE_LABELS: this file adds nothing to extraction,
 * mergeUpdates(), briefModel(), persistence or MCP, and nothing here is
 * read by any of them. It exists so a fact is never described by its raw
 * AllowedPath string on a buyer-facing surface, and so it is described
 * the same way everywhere it appears (the "one truth" instinct Article 17
 * applies to computed behaviour, applied here to labelling): every
 * surface that needs a field's name imports PATH_LABELS or calls
 * labelFor() from here, never holding its own copy.
 *
 * The 15 base paths carry the exact wording already live in
 * ProjectDesk.tsx's own PATH_LABELS (src/components/ProjectDesk.tsx:167-183),
 * unchanged, so meaning does not drift between the live desk and this
 * table. The 7 PKM extension paths are new entries, phrased consistently
 * with the prose briefModel() already composes for them (draft.ts's
 * "vendors"/"locations"/"bespoke" blocks).
 *
 * Typed as Record<AllowedPath, string>, not Record<string, string>: the
 * TypeScript compiler itself refuses to build if a path is missing from
 * this table or an unknown path is added to it, which is the strongest
 * available guarantee that every AllowedPath has exactly one label.
 */

import type { AllowedPath } from "./extract";

export const PATH_LABELS: Record<AllowedPath, string> = {
  // ---- 15 base paths, unchanged from ProjectDesk.tsx's PATH_LABELS ----
  "organisation.sector": "Sector",
  "organisation.sizeBand": "Size",
  "organisation.regions": "Regions",
  "estate.users": "People",
  "estate.sites": "Sites",
  "estate.cloud": "Cloud",
  "estate.existingSecurity": "Existing security",
  "estate.existingNetwork": "Existing network",
  drivers: "Driver",
  "constraints.complianceRequirements": "Compliance",
  "constraints.inHouseSocCapacity": "In-house SOC",
  "constraints.timeline": "Timeline",
  "constraints.budgetBand": "Budget",
  "procurement.buying": "Buying",
  "procurement.operatingModel": "Who runs it",

  // ---- 7 PKM extension paths, new (Netify Project Architecture v1.0 s2.2) ----
  "estate.namedTechnologies": "Named technologies",
  "estate.existingProviders": "Existing providers",
  "procurement.vendorsUnderConsideration": "Vendors under consideration",
  "estate.namedLocations": "Named locations",
  "estate.locationCriticality": "Site criticality",
  "estate.siteResilience": "Site resilience",
  "requirements.bespoke": "Additional requirements",
};

/** The one sanctioned way to turn an AllowedPath into buyer-facing text. */
export function labelFor(path: AllowedPath): string {
  return PATH_LABELS[path];
}
