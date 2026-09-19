/** Remove only exact generated editor instructions, never rewrite buyer requirements. */
export function cleanPublishedSummary(summary: string): string {
  return summary.replace(/No supplier requirements have been created yet\.\s*Describe what you need above to start building this document\./g, '').replace(/ {2,}/g, ' ').trim();
}
export function publishedDeadline(notice: {response_deadline?: number | null; deadline?: number | null}) {
  return notice.response_deadline ?? notice.deadline ?? null;
}
