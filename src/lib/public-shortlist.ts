import { buildShortlist, type ShortlistVendor } from './shortlist-core';

/** Only this projection may cross an unauthenticated personalised-matching boundary. */
export function publicShortlistPreview(vendors: ShortlistVendor[], input: unknown, featureNames: Record<string, string> = {}) {
  const result = buildShortlist(vendors, input, featureNames);
  return {
    requires_publication: true,
    considered_count: result.considered,
    eligible_count: result.considered - result.excluded,
    criteria_summary: result.criteria_summary,
    input: result.input,
    next_step: 'Create a short project, confirm your company and verify your work email, then approve anonymous publication to unlock personalised matches. A full RFP is optional.',
  };
}
