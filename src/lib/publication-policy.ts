/**
 * Canonical publication policy for every SASE marketplace surface.
 *
 * This module is deliberately pure: web routes, API/OpenAPI/MCP adapters and
 * the publication saga must supply facts, while this contract makes the
 * decision. Persisted schemas and KV keys do not include the policy version,
 * so historic records remain readable without migration.
 */

export const PUBLICATION_POLICY_VERSION = "sase-publication-policy/1.0.0" as const;
export const MARKETPLACE_PUBLICATION_CONSENT_VERSION = "marketplace-publication-consent/1.0.0" as const;
export const MARKETPLACE_PUBLICATION_CONSENT_TEXT = "I confirm that this project information may be published anonymously and non-bindingly on the Netify Opportunity Board. My identity and contact details remain private. Publishing does not require me to buy, speak to a supplier or accept a response." as const;

export const PUBLICATION_POLICY = Object.freeze({
  version: PUBLICATION_POLICY_VERSION,
  price: "free",
  legalEffect: "non-binding",
  buyerObligations: Object.freeze({
    purchaseRequired: false,
    supplierConversationRequired: false,
    responseAcceptanceRequired: false,
  }),
  publication: Object.freeze({
    anonymous: true,
    meaningfulBaselineRequired: true,
    publicBoardRequired: true,
  }),
  output: Object.freeze({
    publicBoardIncludesBuyerIdentity: false,
    privateProjectRemainsAvailableToOwner: true,
    supplierSpecificOutputRequiresValidMarketUnlock: true,
  }),
  marketUnlock: Object.freeze({
    requiresFrozenRevision: true,
    requiresMatchingPublicBoardOpportunity: true,
    boardFailureKeepsLocked: true,
  }),
  supplierAccess: Object.freeze({
    personalisedIdentityRequiresValidMarketUnlock: true,
    invitationsRequireCompletedPublication: true,
  }),
  authorization: Object.freeze({
    ownerRequired: true,
    verifiedBuyerOrNetifySessionRequired: true,
    appliesTo: Object.freeze(["web", "api", "agent", "openapi", "mcp"] as const),
  }),
  replay: Object.freeze({ idempotent: true }),
});

export type PublicationChannel = (typeof PUBLICATION_POLICY.authorization.appliesTo)[number];

export function publicationAuthorization(input: {
  ownerAuthorized: boolean;
  verifiedSession: boolean;
  channel: PublicationChannel;
}): { allowed: boolean; reason: "owner_required" | "verified_session_required" | null } {
  if (!input.ownerAuthorized) return { allowed: false, reason: "owner_required" };
  if (!input.verifiedSession) return { allowed: false, reason: "verified_session_required" };
  return { allowed: true, reason: null };
}

export function publicationReadiness(input: {
  baselineReady: boolean;
  baselineRemaining: string[];
  activeQuestionCount: number;
}): { allowed: boolean; reasons: string[] } {
  const reasons = input.baselineReady ? [] : [...input.baselineRemaining];
  if (input.activeQuestionCount < 1) reasons.push("At least one active supplier question");
  return { allowed: reasons.length === 0, reasons };
}

export function quickListingReadiness(input: {
  solutionScope: string; sector: string | null; siteCount: number | null;
  regions: string[]; operatingModel: string; outcome: string; timescale: string;
}): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.solutionScope.trim()) reasons.push("Solution scope");
  if (!input.sector?.trim()) reasons.push("Sector");
  if (!input.siteCount || input.siteCount < 1) reasons.push("Estate size");
  if (!input.regions.some((region) => region.trim())) reasons.push("Geography");
  if (!input.operatingModel.trim()) reasons.push("Operating model");
  if (input.outcome.trim().length < 20) reasons.push("Meaningful problem or outcome");
  if (!input.timescale.trim()) reasons.push("Timescale");
  return { allowed: reasons.length === 0, reasons };
}

export function publicationCompleted(input: {
  publicBoardOpportunityId: string | null | undefined;
  marketUnlockValid: boolean;
}): boolean {
  return Boolean(input.publicBoardOpportunityId) && input.marketUnlockValid;
}

export function supplierCapabilitiesAllowed(marketUnlockValid: boolean): boolean {
  return PUBLICATION_POLICY.supplierAccess.personalisedIdentityRequiresValidMarketUnlock && marketUnlockValid;
}

export function invitationsAllowed(input: {
  publicBoardOpportunityId: string | null | undefined;
  marketUnlockValid: boolean;
}): boolean {
  return publicationCompleted(input);
}

export type MarketUnlockBindingFacts = {
  revisionExists: boolean;
  revisionProjectMatches: boolean;
  revisionHashMatches: boolean;
  opportunityExists: boolean;
  opportunityProjectMatches: boolean;
  opportunityIsPublic: boolean;
  opportunityRevisionMatches: boolean;
};

export function marketUnlockBindingValid(facts: MarketUnlockBindingFacts): boolean {
  return (
    facts.revisionExists &&
    facts.revisionProjectMatches &&
    facts.revisionHashMatches &&
    facts.opportunityExists &&
    facts.opportunityProjectMatches &&
    facts.opportunityIsPublic &&
    facts.opportunityRevisionMatches
  );
}

/** Identity fields forbidden from public board projections. */
export const PUBLIC_IDENTITY_FIELDS = Object.freeze([
  "buyer_token",
  "owner_email",
  "buyer_email",
  "company_name",
  "contact_name",
  "contact_email",
] as const);

export function publicProjectionContainsPrivateIdentity(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(publicProjectionContainsPrivateIdentity);
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      (PUBLIC_IDENTITY_FIELDS as readonly string[]).includes(key) || publicProjectionContainsPrivateIdentity(nested),
  );
}

export function anonymousBuyerOrganisation(): "" {
  return "";
}

/** Stable event equality is the complete definition of an ordinary retry. */
export function isPublicationReplay(lastAppliedEventId: string | null | undefined, requestEventId: string): boolean {
  return Boolean(lastAppliedEventId) && lastAppliedEventId === requestEventId;
}
