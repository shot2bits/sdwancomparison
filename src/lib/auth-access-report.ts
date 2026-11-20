import { kvRaw } from './rfp-store';
import { activityEnvironment } from './activity-provenance';

export const ACCESS_STAGES = ['attempted', 'challenge_rejected', 'rate_limited', 'academic_review', 'personal_email_rejected', 'project_required', 'supplier_review', 'known_bounce', 'delivery_failed', 'email_sent', 'verified', 'verification_failed'] as const;
export type AccessStage = typeof ACCESS_STAGES[number];
export type AccessRole = 'buyer' | 'supplier' | 'admin' | 'internal' | 'unknown';
export function accessEntry(path = ''): 'account' | 'project' | 'supplier' | 'other' {
  try { const p = new URL(path, 'https://netify.co.uk').pathname;
    if (/^\/sase\/account\/?$/.test(p)) return 'account';
    if (/^\/sase\/(supplier|for-suppliers)(\/|$)/.test(p)) return 'supplier';
    if (/^\/sase\/(home|workspace|rfp-builder|circuit-pricing)(\/|$)/.test(p) || /^\/sase-sd-wan-rfp-builder/.test(p)) return 'project';
  } catch { /* Never retain a supplied URL. */ }
  return 'other';
}

/** Daily aggregate counters only. No identity, IP, token, project ID or URL. */
export async function recordAccess(stage: AccessStage, role: AccessRole, entry: ReturnType<typeof accessEntry>, now = Date.now()) {
  const environment = activityEnvironment();
  const key = `auth:access:v1:${environment}:${new Date(now).toISOString().slice(0, 10)}`;
  try { await kvRaw(['HINCRBY', key, `${role}:${entry}:${stage}`, 1]); await kvRaw(['EXPIRE', key, 90 * 86400]); }
  catch { /* Reporting must not block access or turn a failure into success. */ }
}

export async function accessReport(now = Date.now()) {
  const days = await Promise.all(Array.from({ length: 30 }, async (_, i) => {
    const day = new Date(now - i * 86400000).toISOString().slice(0, 10);
    const raw = await kvRaw(['HGETALL', `auth:access:v1:production:${day}`]);
    const pairs: [string, unknown][] = Array.isArray(raw) ? raw.flatMap((v, n) => n % 2 === 0 ? [[String(v), raw[n + 1]] as [string, unknown]] : []) : Object.entries(raw ?? {});
    return { day, rows: pairs.flatMap(([field, value]) => {
      const [role, entry, stage] = field.split(':'); const count = Number(value);
      return ['buyer','supplier','admin','internal','unknown'].includes(role) && ['account','project','supplier','other'].includes(entry) && ACCESS_STAGES.includes(stage as AccessStage) && Number.isSafeInteger(count) && count >= 0 ? [{role,entry,stage,count}] : [];
    }) };
  }));
  return { version: 'auth-access/1', generated_at: now, days, available_days: days.filter(d => d.rows.length).length,
    interpretation: 'Recorded attempts and outcomes, not unique people or a conversion rate. Production only. Counters begin after this release; historical gaps are not zero activity. Admin activity is separate. Email sent means provider acceptance, not delivery or sign-in. Project activity and commercial outcomes are reported separately.' };
}
