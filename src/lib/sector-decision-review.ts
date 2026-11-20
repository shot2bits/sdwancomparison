import type {SectorComparisonInput} from './sector-comparison';
/** Only the buyer's original notes enter language extraction. Grouped coverage
 * filters and architecture choices remain structured context, not invented quotes. */
export function decisionReviewText(input:SectorComparisonInput){return input.notes;}
