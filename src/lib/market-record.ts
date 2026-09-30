import { z } from "zod";
export const MarketRecordSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  sector: z.string(),
  site_band: z.string(),
  user_band: z.string(),
  scope: z.string(),
  approached: z.number().int().nonnegative(),
  acknowledged: z.number().int().nonnegative(),
  responded: z.number().int().nonnegative(),
  declined: z.number().int().nonnegative(),
  first_proposal_working_days: z.number().int().nonnegative().nullable(),
  comparable_set_working_days: z.number().int().nonnegative().nullable(),
  outcome: z.enum([
    "completed",
    "declined",
    "incomplete",
    "no_proposals",
    "withdrawn",
  ]),
  outcome_description: z.string(),
  participants: z.array(
    z.object({ name: z.string(), naming_consent: z.boolean() }),
  ),
  buyer_publication_consent: z.boolean(),
  redaction_reviewed: z.boolean(),
  evidence_references: z.array(z.string()).min(1),
  reporting_period: z.string(),
  recorded_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export function publicMarketRecord(raw: unknown) {
  const r = MarketRecordSchema.parse(raw);
  if (!r.buyer_publication_consent || !r.redaction_reviewed) return null;
  const {
    project_id: _project,
    evidence_references: _references,
    buyer_publication_consent: _consent,
    redaction_reviewed: _review,
    ...safe
  } = r;
  return {
    ...safe,
    participants: r.participants
      .filter((p) => p.naming_consent)
      .map((p) => p.name),
  };
}
// No synthetic customer results. Populate only via consented records with evidence.
export const marketRecords: ReturnType<typeof publicMarketRecord>[] = [];
