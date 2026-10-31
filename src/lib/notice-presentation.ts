/** Remove only exact generated editor instructions, never rewrite buyer requirements. */
export function cleanPublishedSummary(summary: string): string {
  return summary.replace(/No supplier requirements have been created yet\.\s*Describe what you need above to start building this document\./g, '').replace(/ {2,}/g, ' ').trim();
}
export function publishedDeadline(notice: {response_deadline?: number | null; deadline?: number | null}) {
  return notice.response_deadline ?? notice.deadline ?? null;
}

/** Presentation only: do not silently close or extend the buyer's stored notice. */
export function noticeResponseWindow(notice: {status: string; response_deadline?: number | null; deadline?: number | null}, now = Date.now()) {
  if (notice.status !== "open") return notice.status === "awarded" ? "awarded" : "closed";
  const deadline = publishedDeadline(notice);
  return deadline !== null && Number.isFinite(deadline) && deadline <= now ? "deadline_passed" : "open";
}
