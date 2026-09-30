import { listConnections, listResponses } from "./rfp-store";
import type { PublishedSnapshot } from "./published-snapshot";
export async function publicationOutcomes(projectId: string, snapshot: PublishedSnapshot | null) {
  const [connections, responses] = await Promise.all([listConnections(projectId), listResponses(projectId)]);
  const ids = snapshot ? new Set(snapshot.invited_vendor_ids) : null;
  const invited = connections.filter(c => ids === null || ids.has(c.vendor_slug));
  const delivery = { not_attempted: 0, accepted: 0, delivered: 0, failed: 0, unknown: 0 };
  for (const c of invited) {
    const state = c.forwarded_at && c.delivery?.state === "not_attempted" ? "unknown" : c.delivery?.state ?? "unknown";
    delivery[state]++;
  }
  const submitted = responses.filter(r => r.submitted != null && r.vendor_slug != null && (ids === null || ids.has(r.vendor_slug)));
  return {
    observed_at: new Date().toISOString(),
    revision_id: snapshot?.id ?? null,
    outcome_scope: "Project-level activity for providers invited in this revision; legacy responses have no revision identifier.",
    providers_evaluated: snapshot?.provider_provenance?.evaluated_provider_count ?? null,
    eligible_matches: snapshot?.provider_provenance?.eligible_provider_count ?? null,
    shortlisted: snapshot?.matched_vendor_ids.length ?? null,
    invitations_created: snapshot?.invited_vendor_ids.length ?? invited.length,
    invitation_records_found: invited.length,
    delivery,
    supplier_responses: new Set(submitted.map(r => r.vendor_slug)).size,
    supplier_messages: invited.filter(c => c.messages.some(m => m.from === "supplier")).length,
    interpretation: "Invitation records do not prove delivery. Submitted responses are distinct from supplier messages. Legacy delivery and evaluation counts remain unknown.",
    ...(snapshot?.invited_vendor_ids.length === 0 ? { next_step: "No suppliers were invited. Review the recorded requirements and provider evidence; ask Netify to review missing evidence. Your opportunity remains published. Responses are not guaranteed." } : {}),
  };
}
