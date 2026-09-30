// Cookie consent storage + window API for the Netify Vercel app.
//
// UK PECR + UK GDPR compliance:
//   - Non-necessary categories default to FALSE on first visit.
//   - Reject is as easy as Accept (banner UI handles this).
//   - Granular per-category consent recorded.
//   - User can re-open the banner via window.netifyConsent.show() (footer link).
//   - Consent expires after 180 days, banner re-prompts.
//
// Storage:
//   - Primary: a single first-party cookie 'netify_consent' (JSON, 180 days).
//   - Backup: localStorage under the same key, in case cookies are cleared
//     by browser settings but localStorage survives. Either source is
//     authoritative when read.
//
// No external SDK, no third-party consent platform. Vendor-neutral by design.

export const CONSENT_COOKIE = 'netify_consent';
export const CONSENT_VERSION = 1;
export const CONSENT_EXPIRY_DAYS = 180;

export type ConsentCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export interface ConsentState {
  version: number;
  /** ISO timestamp when the user last set consent. */
  setAt: string;
  /** Map of category to whether the user has consented. necessary is always true. */
  categories: Record<ConsentCategory, boolean>;
}

export const ALL_CATEGORIES: ConsentCategory[] = [
  'necessary',
  'functional',
  'analytics',
  'marketing',
];

/** Default state when no consent has been recorded yet. Non-necessary
 *  categories are FALSE by default; PECR requires active opt-in. */
export function defaultConsent(): ConsentState {
  return {
    version: CONSENT_VERSION,
    setAt: new Date().toISOString(),
    categories: {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    },
  };
}

export function acceptAll(): ConsentState {
  return {
    version: CONSENT_VERSION,
    setAt: new Date().toISOString(),
    categories: {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    },
  };
}

export function rejectAll(): ConsentState {
  return {
    version: CONSENT_VERSION,
    setAt: new Date().toISOString(),
    categories: {
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
    },
  };
}

// ─── Storage helpers, browser-only ──────────────────────────────────────────

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const pairs = document.cookie.split('; ');
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    if (pair.slice(0, eq) === name) {
      try {
        return decodeURIComponent(pair.slice(eq + 1));
      } catch {
        return pair.slice(eq + 1);
      }
    }
  }
  return null;
}

function writeCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  // SameSite=Lax so the cookie is sent on top-level navigations but not
  // third-party iframes; Secure so it is only sent over HTTPS in production.
  // Path=/ so every route sees the same consent state.
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

function safeLocalRead(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalWrite(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    /* localStorage can be disabled, ignore */
  }
}

export function parseStored(raw: string | null, now = Date.now()): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      parsed.version === CONSENT_VERSION &&
      parsed.categories &&
      typeof parsed.categories.necessary === 'boolean'
    ) {
      const at = Date.parse(parsed.setAt);
      if (!Number.isFinite(at) || at > now || now - at >= CONSENT_EXPIRY_DAYS * 86400000) return null;
      for (const category of ALL_CATEGORIES) if (typeof parsed.categories[category] !== 'boolean') return null;
      // Ensure necessary is always true regardless of what was stored.
      parsed.categories.necessary = true;
      return parsed as ConsentState;
    }
    return null;
  } catch {
    return null;
  }
}

/** Read the current consent state. Returns null when the user has not yet
 *  made a choice (banner should appear). */
export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  const fromCookie = parseStored(readCookie(CONSENT_COOKIE));
  if (fromCookie) return fromCookie;
  const fromLocal = parseStored(safeLocalRead(CONSENT_COOKIE));
  return fromLocal;
}

/** Write a new consent state, replacing any existing one. Fires a custom
 *  event so listeners (e.g. analytics shims) can react to the change. */
export function setConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  // Always force necessary=true regardless of caller intent.
  const normalized: ConsentState = {
    ...state,
    version: CONSENT_VERSION,
    setAt: state.setAt || new Date().toISOString(),
    categories: { ...state.categories, necessary: true },
  };
  const serialized = JSON.stringify(normalized);
  writeCookie(CONSENT_COOKIE, serialized, CONSENT_EXPIRY_DAYS);
  safeLocalWrite(CONSENT_COOKIE, serialized);
  try {
    window.dispatchEvent(
      new CustomEvent('netify-consent-change', { detail: normalized }),
    );
  } catch {
    /* CustomEvent unavailable in very old browsers, ignore */
  }
}

/** Whether the user has consented to a specific category. Use this from any
 *  future analytics or marketing script before initialising. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  const state = getConsent();
  if (!state) return false; // no choice yet = no consent for non-necessary
  return state.categories[category] === true;
}

/** Re-open the banner. Used by the Manage cookies link in the footer. */
export function showConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event('netify-show-consent'));
  } catch {
    /* old browsers, ignore */
  }
}

// ─── Window API ─────────────────────────────────────────────────────────────
// Attached to window so future inline scripts and the footer link can call
// it without importing the module. Idempotent, safe to call multiple times.

interface NetifyConsentApi {
  get(category: ConsentCategory): boolean;
  state(): ConsentState | null;
  show(): void;
  acceptAll(): void;
  rejectAll(): void;
}

declare global {
  interface Window {
    netifyConsent?: NetifyConsentApi;
  }
}

export function installWindowApi(): void {
  if (typeof window === 'undefined') return;
  window.netifyConsent = {
    get: hasConsent,
    state: getConsent,
    show: showConsent,
    acceptAll: () => setConsent(acceptAll()),
    rejectAll: () => setConsent(rejectAll()),
  };
}
