/** Keep the imported RFP as the revalidation baseline and append each
 * accepted improvement. Scoring only the latest short answer caused the
 * document to fall to 0/100 after the buyer followed Netify's guidance. */
export function composeRfpValidationCorpus(baseline: string, improvement?: string): string {
  const base = baseline.trim();
  const next = improvement?.trim() ?? "";
  if (!base) return next;
  if (!next || base === next) return base;
  return `${base}\n\n${next}`;
}
