import { kvGetJson, kvSetJson } from './rfp-store';

export type PublicationIssue = { at: number; stage: 'verification' | 'publication'; code: 'delivery_failed' | 'publication_failed'; resolved?: boolean };
/** Private operational state, never free text, credentials or browser analytics. */
export async function recordPublicationIssue(id: string, stage: PublicationIssue['stage'], code: PublicationIssue['code']) {
  if (!/^rfp_[a-z0-9]+$/i.test(id)) return;
  try { await kvSetJson(`rfp:${id}:completion_issue`, { at: Date.now(), stage, code }); } catch { /* Never change the primary outcome. */ }
}
export async function resolvePublicationIssue(id: string) {
  try {
    const prior = await kvGetJson<PublicationIssue>(`rfp:${id}:completion_issue`);
    if (prior) await kvSetJson(`rfp:${id}:completion_issue`, { ...prior, resolved: true });
  } catch { /* The published project is authoritative. */ }
}
