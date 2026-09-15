import { ShortlistInputSchema, describeCriteria, type ShortlistVendor } from "./shortlist-core";
export const PUBLIC_EVIDENCE_CONTRACT = "public-provider-evidence/2.0.0";
export const PUBLIC_EVIDENCE_NOTICE = "Alphabetical source evidence. Computed fit, rankings and recommendations unlock after verified project publication.";
export function publicProviderEvidence(vendors: ShortlistVendor[], input: unknown = {}) {
  const parsed = ShortlistInputSchema.safeParse(input);
  const criteria = parsed.success ? parsed.data : ShortlistInputSchema.parse({});
  return {
    contract_version: PUBLIC_EVIDENCE_CONTRACT,
    requires_publication: true,
    ordering: "alphabetical",
    input: criteria,
    criteria_summary: describeCriteria(criteria, {}),
    // This is a catalogue, not a personalised eligible-provider selection.
    shortlist: [...vendors].sort((a,b) => a.name.localeCompare(b.name)).map(v => ({ ...v, gaps: [] as string[] })),
    methodology_note: PUBLIC_EVIDENCE_NOTICE,
  };
}
