import { PUBLICATION_POLICY, PUBLICATION_POLICY_VERSION, MARKETPLACE_PUBLICATION_CONSENT_VERSION, MARKETPLACE_PUBLICATION_CONSENT_TEXT } from "@/lib/publication-policy";
import { PROVIDER_MATCH_METHODOLOGY_VERSION } from "@/lib/provider-matching";
import { PROJECT_ENTRANCE_CONTRACT_VERSION } from "@/lib/project-entrance-contract";
import { SECTOR_PROFILE_VERSION } from "@/lib/sector-profiles";

export async function GET() {
  return Response.json({
    contract_version: "marketplace-methodology/1.0.0",
    project_entrance_version: PROJECT_ENTRANCE_CONTRACT_VERSION,
    publication_policy_version: PUBLICATION_POLICY_VERSION,
    provider_match_version: PROVIDER_MATCH_METHODOLOGY_VERSION,
    sector_profile_version: SECTOR_PROFILE_VERSION,
    publication_policy: PUBLICATION_POLICY,
    consent: { version: MARKETPLACE_PUBLICATION_CONSENT_VERSION, text: MARKETPLACE_PUBLICATION_CONSENT_TEXT },
    limitations: ["Provider identities and personalised fit are unavailable before successful public-board publication and a valid MarketUnlock.", "Unknown, stale, expired and confirmation-required evidence is not treated as confirmed positive support.", "Sector recommendations begin unconfirmed and require buyer review."],
  }, { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" } });
}
