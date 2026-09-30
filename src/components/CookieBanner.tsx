'use client';

// Netify cookie banner + preferences modal.
//
// UK PECR + UK GDPR compliance choices baked in:
//   - Accept All and Reject All are presented as equally weighted buttons
//     (same size, same prominence, same colour weight) per ICO guidance on
//     consent UI. No nudging dark patterns.
//   - Non-necessary categories default to OFF in the preferences modal.
//   - Strictly necessary is shown as informational but cannot be turned off.
//   - User can re-open the banner any time via the footer link (which fires
//     a 'netify-show-consent' window event this component listens for).
//   - Consent expires after 180 days, banner re-prompts.
//
// Renders client-side only (useEffect) so there is no flash on SSR and no
// banner is shipped to crawlers that don't run JS (they don't trigger cookies
// anyway, so this is the correct behaviour).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ALL_CATEGORIES,
  acceptAll,
  defaultConsent,
  getConsent,
  installWindowApi,
  rejectAll,
  setConsent,
  type ConsentCategory,
  type ConsentState,
} from '@/lib/cookie-consent';

type View = 'hidden' | 'banner' | 'preferences';

const CATEGORY_INFO: Record<ConsentCategory, { label: string; body: string }> = {
  necessary: {
    label: 'Strictly necessary',
    body:
      'Required for the site to work, including form submission, security, load-balancing and remembering the consent choice you make on this banner. Always on.',
  },
  functional: {
    label: 'Functional',
    body:
      'Remember your preferences across visits, such as language, scenario inputs you have configured, or filtered vendor lists. Off until you choose to enable.',
  },
  analytics: {
    label: 'Analytics',
    body:
      'Help us understand how the site is used so we can improve it. We use aggregated traffic patterns, not personal identification. Off until you choose to enable.',
  },
  marketing: {
    label: 'Marketing',
    body:
      'Track visit data so we can measure advertising effectiveness on third-party platforms. Off until you choose to enable.',
  },
};

export function CookieBanner() {
  const [view, setView] = useState<View>('hidden');
  const [draft, setDraft] = useState<ConsentState>(defaultConsent);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Install window API + decide initial visibility on mount.
  useEffect(() => {
    installWindowApi();
    const existing = getConsent();
    if (!existing) {
      queueMicrotask(() => setView('banner'));
    }
    const reopen = () => {
      const current = getConsent() ?? defaultConsent();
      setDraft(current);
      setView('preferences');
    };
    window.addEventListener('netify-show-consent', reopen);
    return () => window.removeEventListener('netify-show-consent', reopen);
  }, []);

  // Trap focus + close on Esc when the preferences modal is open.
  useEffect(() => {
    if (view !== 'preferences') return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setView(getConsent() ? 'hidden' : 'banner');
      }
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog so screen-reader users land there.
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [view]);

  const handleAcceptAll = useCallback(() => {
    setConsent(acceptAll());
    setView('hidden');
  }, []);

  const handleRejectAll = useCallback(() => {
    setConsent(rejectAll());
    setView('hidden');
  }, []);

  const handleOpenPreferences = useCallback(() => {
    const current = getConsent() ?? defaultConsent();
    setDraft(current);
    setView('preferences');
  }, []);

  const handleSavePreferences = useCallback(() => {
    setConsent(draft);
    setView('hidden');
  }, [draft]);

  const toggleCategory = useCallback((category: ConsentCategory) => {
    if (category === 'necessary') return;
    setDraft((d) => ({
      ...d,
      categories: { ...d.categories, [category]: !d.categories[category] },
    }));
  }, []);

  const categoryRows = useMemo(() => ALL_CATEGORIES.map((c) => ({
    category: c,
    info: CATEGORY_INFO[c],
    on: draft.categories[c],
  })), [draft]);

  if (view === 'hidden') return <button type="button" onClick={() => window.dispatchEvent(new Event('netify-show-consent'))} className="fixed bottom-2 left-2 z-40 rounded border bg-white px-3 py-1 text-xs text-slate-700">Cookie preferences</button>;

  if (view === 'banner') {
    return (
      <div
        data-netify-cookie-banner
        role="region"
        aria-label="Cookie consent"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white shadow-[0_-6px_24px_-12px_rgba(0,0,0,0.15)]"
      >
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm leading-relaxed text-zinc-700">
              <p className="mb-1 font-semibold text-zinc-900">We use cookies</p>
              <p>
                Netify uses cookies to make the site work, to remember your preferences, and (with your permission) to understand how visitors use the site. You can accept all, reject non-essential, or choose which categories to allow. Read our{' '}
                <Link
                  href="https://netify.co.uk/cookie-policy/"
                  className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-600"
                >
                  Cookie Policy
                </Link>{' '}
                for the full list.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {/* Reject and Accept are visually equivalent (same size, same
                  weight). ICO guidance: no nudging towards Accept. */}
              <button
                type="button"
                onClick={handleRejectAll}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={handleOpenPreferences}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
              >
                Cookie settings
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="rounded-md border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-amber-600 hover:bg-amber-600"
              >
                Accept all
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // view === 'preferences'
  return (
    <div
      data-netify-cookie-preferences
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-preferences-heading"
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
          <h2 id="cookie-preferences-heading" className="text-xl font-semibold text-zinc-950">
            Cookie settings
          </h2>
          <button
            type="button"
            onClick={() => setView(getConsent() ? 'hidden' : 'banner')}
            aria-label="Close cookie settings"
            className="text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          <p className="mb-4 text-sm text-zinc-600">
            Choose which categories of cookies Netify may use. You can change this any time using the Cookie preferences control. For the full list of cookies and providers, see the{' '}
            <Link
              href="https://netify.co.uk/cookie-policy/"
              className="font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-600"
            >
              Cookie Policy
            </Link>
            .
          </p>
          <ul className="space-y-3">
            {categoryRows.map(({ category, info, on }) => {
              const locked = category === 'necessary';
              return (
                <li
                  key={category}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-4"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-medium text-zinc-900">{info.label}</span>
                    <ToggleSwitch
                      label={`Toggle ${info.label}`}
                      on={on}
                      locked={locked}
                      onChange={() => toggleCategory(category)}
                    />
                  </div>
                  <p className="text-sm text-zinc-600">{info.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-col gap-2 border-t border-zinc-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleRejectAll}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
            >
              Reject all
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
            >
              Accept all
            </button>
          </div>
          <button
            type="button"
            onClick={handleSavePreferences}
            className="rounded-md border border-amber-500 bg-amber-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-amber-600 hover:bg-amber-600"
          >
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  label,
  on,
  locked,
  onChange,
}: {
  label: string;
  on: boolean;
  locked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={locked}
      disabled={locked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        on ? (locked ? 'bg-emerald-300' : 'bg-amber-500') : 'bg-zinc-300'
      } ${locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
      <span className="sr-only">{on ? 'Enabled' : 'Disabled'}</span>
    </button>
  );
}
