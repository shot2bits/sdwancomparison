/** Read-only interpretation of retained publication attempts. Never approves or publishes. */
export type PublicationOutcome = {
  rfp_id: string; at: number; state: string; email?: string; reason?: string;
  verification?: { passed?: boolean; failed_check?: string | null } | null;
};

export function latestPublicationOutcomes(rows: PublicationOutcome[]) {
  const latest = new Map<string, PublicationOutcome>();
  for (const row of rows) {
    if (!row.rfp_id || !Number.isFinite(row.at)) continue;
    if (!latest.has(row.rfp_id) || latest.get(row.rfp_id)!.at <= row.at) latest.set(row.rfp_id, row);
  }
  return latest;
}

export function publicationBlocker(row?: PublicationOutcome): string | null {
  if (row?.state !== "saved_unpublished") return null;
  switch (row.verification?.failed_check) {
    case "website": return "The website check for your business email domain did not complete. This can be caused by a connection or website problem; it does not establish that your business is invalid.";
    case "mx": return "The mail-domain check did not find working mail records for your business email domain.";
    case "academic": return "The email domain was identified as academic. This service requires a verified commercial procurement requirement.";
    case "free_or_disposable": return "Publication requires an eligible business email address, rather than a personal or disposable address.";
    default: return "Your last publication attempt did not complete. The saved project needs review before it can be published.";
  }
}

export type AttentionItem = { id: string; title: string; email: string; at: number; reason: string; status: string };
export function attentionItem(project: {id:string;title:string;owner_email?:string;status:string;updated:number}, outcome: PublicationOutcome | undefined, connections: number): AttentionItem | null {
  const blocked = project.status !== 'published' && publicationBlocker(outcome);
  if (!blocked && !(project.status === 'published' && connections === 0)) return null;
  return {id:project.id,title:project.title,email:project.owner_email || outcome?.email || '',at:blocked ? outcome!.at : project.updated,
    reason:blocked || 'Published project has no recorded supplier connections. Check eligibility and the buyer’s intended next step before any outreach.',
    status:blocked ? 'Publication blocked — review needed' : 'No supplier handoff recorded'};
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));

export function recoveryReminder(title: string, link: string, unsubscribe: string, outcome?: PublicationOutcome) {
  const blocker = publicationBlocker(outcome);
  const subject = blocker ? "Your Netify project needs a publication check" : "Your Netify project is saved — review your next step";
  const paragraphs = [
    `Your project "${title}" is saved but has not been published.`,
    blocker ?? "You can return to your private draft and review it when you are ready. Nothing is published by opening this link.",
    blocker ? "Reply to this email to ask Netify to review the issue, or contact support@netify.com. A review does not bypass verification or publish your project. Do not send passwords or sign-in codes." : "If you need help deciding whether to proceed, reply to this email or contact support@netify.com.",
    "Publication requires business verification and your approval. Supplier invitations depend on confirmed eligibility and your selections; publication does not guarantee invitations, responses or prices.",
    "This is your one-off reminder about a saved Netify project. Your private project link must not be shared.",
  ];
  return { subject, text: [...paragraphs, `Review saved project: ${link}`, `Unsubscribe: ${unsubscribe}`].join("\n\n"),
    html: paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join("") + `<p><a href="${escapeHtml(link)}">Review saved project</a></p><p><a href="${escapeHtml(unsubscribe)}">Unsubscribe</a></p>` };
}
