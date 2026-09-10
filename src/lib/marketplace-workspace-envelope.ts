import { livingDocumentToRfpSections } from './rfp-document';
import { z } from 'zod';
import type { ProjectDetails } from './rfp-types';
import { buildEnvelopeUpdate } from './workspace/envelope';
import { mergeSourceLedger, parseIncomingSourceTurns } from './workspace/source-ledger';
import { mergeDecisionLedger, parseIncomingDecisionTurns } from './workspace/decision-ledger';

const Purpose = z.enum(['brief', 'rfp', 'rfi']);
const Payload = z.object({
  facts: z.array(z.unknown()), receipts: z.array(z.unknown()).default([]),
  instrument: z.enum(['sor', 'rfi', 'rfp']), compiled_document: z.unknown(),
  source_turns: z.array(z.unknown()).default([]), decision_turns: z.array(z.unknown()).default([]),
  position: z.object({ covered_sections: z.array(z.string()).default([]) }).passthrough().optional(),
  base_revision: z.number().int().min(0).optional(),
}).strip();

export class MarketplaceEnvelopeError extends Error {
  constructor(message: string, public status: 409 | 422) { super(message); }
}

/** Request and durable envelope revisions are distinct from marketplace revisions. */
export function marketplaceWorkspacePayload(project: ProjectDetails) {
  if (!project.procurement_document || project.envelope_revision === 0) return undefined;
  const raw = project.entrance_context?.raw_input.workspace_payload as { position?: unknown } | undefined;
  return {
    facts: project.facts, receipts: project.receipts,
    instrument: project.procurement_document.instrument,
    compiled_document: project.procurement_document,
    source_turns: project.source_ledger, decision_turns: project.decision_ledger,
    position: raw?.position ?? { covered_sections: [] }, base_revision: project.envelope_revision,
  };
}

/** Reuse the full engine's validation/compiler, keeping brief publication eligibility separate. */
export async function preserveMarketplaceWorkspace(existing: ProjectDetails | null, rawInput: Record<string, unknown>) {
  if (rawInput.document_purpose !== undefined) Purpose.parse(rawInput.document_purpose);
  if (rawInput.workspace_payload === undefined) return {};
  const body = Payload.parse(rawInput.workspace_payload);
  const incomingSource = parseIncomingSourceTurns(body.source_turns);
  const incomingDecisions = parseIncomingDecisionTurns(body.decision_turns);
  if (incomingSource.length !== body.source_turns.length || incomingDecisions.length !== body.decision_turns.length) {
    throw new MarketplaceEnvelopeError('The source or decision ledger is malformed. Nothing was saved.', 422);
  }
  const source_ledger = mergeSourceLedger(existing?.source_ledger ?? [], incomingSource);
  const decision_ledger = mergeDecisionLedger(existing?.decision_ledger ?? [], incomingDecisions);
  const outcome = await buildEnvelopeUpdate({
    existing, body, mergedSourceLedger: source_ledger, mergedDecisionLedger: decision_ledger,
    coveredSections: body.position?.covered_sections ?? [], savedBy: existing?.owner_email ?? 'marketplace-session',
  });
  if (!outcome.participates) throw new MarketplaceEnvelopeError('A workspace fact ledger is required.', 422);
  if (!outcome.ok) throw new MarketplaceEnvelopeError(outcome.error, outcome.status);
  return {
    source_ledger, decision_ledger, facts: outcome.facts, receipts: outcome.receipts,
    rfp_sections: livingDocumentToRfpSections(outcome.procurement_document),
    procurement_document: outcome.procurement_document, envelope_revision: outcome.envelope_revision, envelope: outcome.envelope,
  };
}
