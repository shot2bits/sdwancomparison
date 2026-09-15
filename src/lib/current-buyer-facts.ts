import type { ProjectDetails } from './rfp-types';

/** Read the same standing, stated facts used by the procurement document.
 * A removed or merely inferred fact must not revive an older saved value. */
export function currentBuyerFacts(project: ProjectDetails) {
  const ledger = project.facts ?? [];
  const hasLedger = ledger.length > 0;
  const read = (path: string): unknown => {
    if (!hasLedger) return project.procurement_document?.factSnapshot[path];
    const current = [...ledger].reverse().find(f => f.path === path && !f.struck);
    return current?.provenance === 'stated' ? current.value : undefined;
  };
  const number = (path: string) => {
    const value = read(path);
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const timeline = read('constraints.timeline');
  return {
    canonical: hasLedger || Boolean(project.procurement_document),
    users: number('estate.users'),
    sites: number('estate.sites'),
    timeline: typeof timeline === 'string' ? timeline.trim() : '',
  };
}

export function currentPublicBrief(project: ProjectDetails) {
  const facts = currentBuyerFacts(project);
  const timeline = facts.canonical ? facts.timeline : String(project.entrance_context?.raw_input.timescale ?? '').trim();
  const notes = project.buyer.notes.trim();
  // Generated empty-document guidance is never a buyer requirement.
  const outcome = /No supplier requirements have been created yet/i.test(notes) ? '' : notes;
  const summary = facts.canonical
    ? [facts.users ? `${facts.users} users in scope.` : '', facts.sites ? `${facts.sites} sites.` : '', timeline ? `Timeline: ${timeline}.` : ''].filter(Boolean).join(' ')
    : outcome;
  return { summary, timeline };
}
