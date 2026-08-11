'use client';

// Netify commercial event tracking for the SASE app - mounted once in
// src/app/layout.tsx.
//
// This app previously shipped NO analytics, so the RFP builder and shortlist
// (two of the six commercial actions) were invisible. This component sends
// events to TWO sinks:
//   1. Vercel Web Analytics (cookieless - no PECR consent needed). The
//      script is same-origin (/_vercel/insights/) so events land in the main
//      netify.co.uk project dashboard alongside apex events.
//   2. GA4 (same property as the main site, G-XNL6HY3BQX). This app has no
//      cookie banner of its own: consent is the shared first-party
//      'netify_consent' cookie written by the main app's banner (Path=/,
//      same origin, so readable here). Consent Mode defaults to denied and
//      upgrades at load if the visitor already opted in on the main site.
//
// DELEGATED listeners - no page component changes needed.
// Events: rfp_start, shortlist_build, shortlist_download, provider_compare,
//         costed_view, contact_click, go_cta, form_start / form_submit.
//
// EXPLICIT calls (fireNetifyEvent, exported below) - added where the
// delegated listeners can't tell one form/CTA apart from another. 11 Aug
// 2026: audited after Robert flagged the site had moved on since this was
// set up - found the "Start a project" nav CTA (href="/") doesn't match the
// rfp_start text patterns above (it only fires later, on RfpBuilder's own
// "Start my RFP" button), the shortlist page's "Get competing bids" link was
// never matched by any pattern, and ShortlistBuilder's lead-capture form had
// a `fireNetifyEvent` import that was never actually called. The generic
// form_start/form_submit pair still fires for that form (any <form> on the
// site trips it), but can't distinguish it from every other form, or a
// submit attempt from a confirmed send - these fill that gap:
// shortlist_lead_submit / shortlist_lead_sent / shortlist_lead_error,
// shortlist_get_bids_click.

import { useEffect } from 'react';

type VaFn = (
  event: 'event',
  props: { name: string; data?: Record<string, string> },
) => void;

declare global {
  interface Window {
    va?: VaFn;
    vaq?: unknown[];
  }
}

function readConsent(): { analytics: boolean; marketing: boolean } {
  try {
    const m = document.cookie.match(/(?:^|; )netify_consent=([^;]*)/);
    const raw = m
      ? decodeURIComponent(m[1])
      : window.localStorage.getItem('netify_consent');
    if (!raw) return { analytics: false, marketing: false };
    const parsed = JSON.parse(raw) as { categories?: Record<string, boolean> };
    return {
      analytics: parsed.categories?.analytics === true,
      marketing: parsed.categories?.marketing === true,
    };
  } catch {
    return { analytics: false, marketing: false };
  }
}

/**
 * Fire a named commercial event into both sinks (Vercel Web Analytics +
 * GA4). Exported so flow components (Describe wizard, builder, publish)
 * can report spec events directly; the delegated listeners below cover
 * generic clicks. Safe to call anywhere client-side.
 */
export function fireNetifyEvent(name: string, data: Record<string, string> = {}): void {
  fire(name, data);
}

/**
 * First-touch attribution for sign-up quality: the original referrer and
 * landing path, captured once per browser session (16 July 2026, Robert's
 * question about whether sign-ups are mistaken-identity traffic).
 * sessionStorage only: no cookie, nothing persistent, nothing
 * consent-bearing. Read by the sign-in flows and carried through the magic
 * link so the new-sign-up alert can say where the person actually arrived
 * from.
 */
export function firstTouch(): { ref: string; landing: string } | null {
  try {
    const raw = sessionStorage.getItem("netify_first_touch");
    if (!raw) return null;
    const t = JSON.parse(raw) as { ref?: string; landing?: string };
    return { ref: t.ref ?? "", landing: t.landing ?? "" };
  } catch {
    return null;
  }
}

function fire(name: string, data: Record<string, string> = {}): void {
  const payload: Record<string, string> = {
    path: window.location.pathname,
    ...data,
  };
  try {
    window.va?.('event', { name, data: payload });
  } catch {
    /* analytics must never break the page */
  }
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
      .gtag;
    gtag?.('event', name, { event_category: 'commercial', ...payload });
  } catch {
    /* ignore */
  }
}

export default function NetifyEvents() {
  useEffect(() => {
    // First-touch attribution capture, once per browser session (see
    // firstTouch above). Must run before anything else so a visitor who
    // signs in on their landing page still gets attributed.
    try {
      if (!sessionStorage.getItem("netify_first_touch")) {
        sessionStorage.setItem(
          "netify_first_touch",
          JSON.stringify({ ref: document.referrer || "", landing: window.location.pathname + window.location.search, at: Date.now() }),
        );
      }
    } catch { /* private mode */ }

    // Vercel Web Analytics: official queue shim + script, idempotent.
    if (!document.querySelector('script[data-netify-va]')) {
      if (typeof window.va !== 'function') {
        window.va = function () {
          // eslint-disable-next-line prefer-rest-params
          (window.vaq = window.vaq || []).push(arguments);
        } as unknown as VaFn;
      }
      const s = document.createElement('script');
      s.defer = true;
      s.src = '/_vercel/insights/script.js';
      s.setAttribute('data-netify-va', '1');
      document.head.appendChild(s);
    }

    // GA4 loader with Consent Mode (default denied; upgrade from the shared
    // netify_consent cookie).
    if (!document.querySelector('script[data-netify-ga]')) {
      const w = window as unknown as {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
      };
      w.dataLayer = w.dataLayer || [];
      if (typeof w.gtag !== 'function') {
        w.gtag = function () {
          // eslint-disable-next-line prefer-rest-params
          (w.dataLayer as unknown[]).push(arguments);
        };
      }
      const consent = readConsent();
      w.gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
      if (consent.analytics || consent.marketing) {
        w.gtag('consent', 'update', {
          analytics_storage: consent.analytics ? 'granted' : 'denied',
          ad_storage: consent.marketing ? 'granted' : 'denied',
          ad_user_data: consent.marketing ? 'granted' : 'denied',
          ad_personalization: consent.marketing ? 'granted' : 'denied',
        });
      }
      w.gtag('js', new Date());
      w.gtag('config', 'G-XNL6HY3BQX');
      const g = document.createElement('script');
      g.async = true;
      g.src = 'https://www.googletagmanager.com/gtag/js?id=G-XNL6HY3BQX';
      g.setAttribute('data-netify-ga', '1');
      document.head.appendChild(g);
    }

    const startedForms = new WeakSet<Element>();

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target && target.closest ? target.closest('a,button') : null;
      if (!el) return;
      const href = el.getAttribute('href') ?? '';
      const text = (el.textContent ?? '').trim().toLowerCase();

      if (href.startsWith('mailto:')) {
        fire('contact_click', { method: 'email' });
        return;
      }
      if (href.startsWith('tel:')) {
        fire('contact_click', { method: 'phone' });
        return;
      }
      if (href.includes('/sase/shortlist/print') || href.includes('/shortlist/print')) {
        fire('shortlist_download');
        return;
      }
      if (href.includes('/scenario/') || text === 'share this scenario') {
        fire('costed_view');
        return;
      }
      if (href.startsWith('/go/') || href.includes('netify.co.uk/go/')) {
        const slug = href.split('/').filter(Boolean).pop() ?? '';
        fire('go_cta', { slug });
        return;
      }
      if (el.tagName === 'BUTTON') {
        if (text.includes('start my rfp') || text.includes('start rfp')) {
          fire('rfp_start');
          return;
        }
        if (text.includes('build my shortlist')) {
          fire('shortlist_build');
          return;
        }
        if (text === 'compare') {
          fire('provider_compare');
          return;
        }
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      const form = target && target.closest ? target.closest('form') : null;
      if (!form || startedForms.has(form)) return;
      startedForms.add(form);
      fire('form_start');
    };

    const onSubmit = (e: Event) => {
      const form = e.target as Element | null;
      if (!form || form.tagName !== 'FORM') return;
      fire('form_submit');
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, []);

  return null;
}

