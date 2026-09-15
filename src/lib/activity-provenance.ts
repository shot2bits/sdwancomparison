export const ACTIVITY_ENVIRONMENTS = ['production', 'preview', 'development', 'unknown'] as const;
export type ActivityEnvironment = typeof ACTIVITY_ENVIRONMENTS[number];
export function activityEnvironment(value: unknown = process.env.VERCEL_ENV): ActivityEnvironment {
  return ACTIVITY_ENVIRONMENTS.includes(value as ActivityEnvironment) ? value as ActivityEnvironment : 'unknown';
}
export function activityClassification(record: unknown): 'test' | 'unverified' {
  if (!record || typeof record !== 'object') return 'unverified';
  const p = record as { test?: boolean; buyer?: { organisation?: string; notes?: string }; owner_email?: string; entrance_context?: { requirement_text?: string } };
  if (p.test === true) return 'test';
  const text = [p.buyer?.organisation, p.buyer?.notes, p.entrance_context?.requirement_text].filter(Boolean).join(' ');
  if (/\b(?:synthetic|automated QA|do not publish|usability test|QA control|QA audit|private acceptance draft)\b/i.test(text)) return 'test';
  if (/\bnetify\s+qa\b/i.test(text)) return 'test';
  if (p.buyer?.organisation?.trim().toLowerCase() === 'test' && /@netify\.(com|co\.uk)$/i.test(p.owner_email ?? '')) return 'test';
  return 'unverified';
}
