/** Public, low-cardinality measurement vocabulary. Never include free text or contact details. */
export const PRIORITY_PAGES = [
  '/', '/sd-wan-for-healthcare/', '/sd-wan-sase-for-manufacturing/',
  '/sd-wan-sase-for-retail/', '/sd-wan-sase-for-financial-services/',
  '/sase-sd-wan-rfp-builder/', '/resell/bt-business-broadband/',
  '/tools/bt-cloud-voice-pricing-calculator/', '/tools/bt-one-phone-replacement/',
  '/insights/broadband-reseller-companies/', '/resell/voip-reseller/',
  '/sase/shortlist/', '/sase/shortlist/sd-wan-vendors/',
  '/sase/shortlist/sase-vendors/', '/sase/shortlist/managed-sd-wan/',
] as const;
export function measurementPage(raw: string): string {
  try {
    let path = new URL(raw, 'https://netify.co.uk').pathname.replace(/\/+$/, '') + '/';
    if (path === '/sase-rfp-builder-app/') path = '/sase-sd-wan-rfp-builder/';
    return (PRIORITY_PAGES as readonly string[]).includes(path) ? path : 'other';
  } catch { return 'unknown'; }
}
export type Acquisition = 'google_search' | 'bing_search' | 'ai_referral' | 'other_referral' | 'direct_or_unknown' | 'internal';
export function acquisitionFromReferrer(raw: string): Acquisition {
  if (!raw) return 'direct_or_unknown';
  try {
    const host = new URL(raw).hostname.toLowerCase();
    const matches = (domain: string) => host === domain || host.endsWith('.' + domain);
    if (['netify.co.uk', 'netify.com'].some(matches)) return 'internal';
    if (['chatgpt.com', 'chat.openai.com', 'claude.ai', 'perplexity.ai', 'gemini.google.com', 'copilot.microsoft.com', 'chat.deepseek.com'].some(matches)) return 'ai_referral';
    if (/^(www\.)?google\.(com|co\.uk|ca|com\.au|de|fr|ie)$/.test(host)) return 'google_search';
    if (matches('bing.com')) return 'bing_search';
    return 'other_referral';
  } catch { return 'direct_or_unknown'; }
}
export const ACQUISITION_VALUES: Acquisition[] = ['google_search','bing_search','ai_referral','other_referral','direct_or_unknown','internal'];
export type JourneyAttribution = { version: 1; landing_page: string; acquisition: Acquisition; consent: 'granted' | 'not_granted'; };
export function sanitiseAttribution(value: unknown): JourneyAttribution | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Partial<JourneyAttribution>;
  if (v.version !== 1 || v.consent !== 'granted') return undefined;
  return { version: 1, landing_page: measurementPage(v.landing_page ?? ''), acquisition: ACQUISITION_VALUES.includes(v.acquisition!) ? v.acquisition! : 'direct_or_unknown', consent: 'granted' };
}
const EVENT_KEYS = new Set(['tool','method','placement','outcome','sector','environment','classification','users_band','origin','edited_after_advisor','status','action','kind','step','reason','source']);
export function safeEventData(data: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (EVENT_KEYS.has(key) && typeof value === 'string' && /^[a-zA-Z0-9_:+. -]{1,70}$/.test(value)) {
      // GA reserves source/medium for acquisition; UI placements must never overwrite them.
      out[key === 'source' ? 'interaction_source' : key] = value;
    }
  }
  return out;
}
