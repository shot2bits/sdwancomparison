/** Describe the completed board publication, never infer supplier participation. */
export function publicationReceipt(marketUnlocked: boolean): string {
  return marketUnlocked
    ? 'Your project is published on the Opportunity Board. Open your project to review any supplier responses. Publication does not guarantee a response or quote. Your company and work email remain private.'
    : 'Your project is saved, but Opportunity Board publication is not complete. Nothing has been confirmed as published. Review the message below and retry.';
}
