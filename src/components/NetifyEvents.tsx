'use client';

// Consent-dependent commercial events. Only route categories and bounded
// operational properties are sent; server-confirmed outcomes are reported separately.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsPath, analyticsReferrer, analyticsLocation, analyticsProps } from '@/lib/analytics-privacy';

type VaFn = {
 (event: 'event', props: {name:string;data?:Record<string,string>}):void;
 (event: 'beforeSend', callback:(event:{type:string;url:string;[key:string]:unknown})=>unknown):void;
};

declare global {
  interface Window {
    va?: VaFn;
    vaq?: unknown[];
    "ga-disable-G-XNL6HY3BQX"?: boolean;
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

// Enhanced Measurement reads raw search parameters independently of page_location.
// Use Google's documented opt-out for private/query-bearing pages. Once entered,
// stay opted out for this document lifetime so queued private events cannot flush.
let googlePrivateSeen=false;
let googleGuardInstalled=false;
function googleAllowed(target=window.location.href):boolean {
  try {
    const url=new URL(target,window.location.href);
    googlePrivateSeen ||= Boolean(url.search||url.hash) || /^\/sase-sd-wan-rfp-builder(?:\/|$)/.test(url.pathname) || /^\/sase\/(home|workspace|circuit-pricing|account|admin|rfp-builder|opportunities)(?:\/|$)/.test(url.pathname);
  } catch {googlePrivateSeen=true;}
  window['ga-disable-G-XNL6HY3BQX']=googlePrivateSeen||!readConsent().analytics;
  return !window['ga-disable-G-XNL6HY3BQX'];
}
function installGooglePrivacyGuard(){
  googleAllowed();
  if(googleGuardInstalled)return;
  googleGuardInstalled=true;
  for(const method of ['pushState','replaceState'] as const){
    const original=window.history[method].bind(window.history);
    window.history[method]=(...args:Parameters<History['pushState']>)=>{
      if(args[2]!=null)googleAllowed(String(args[2]));
      return original(...args);
    };
  }
  window.addEventListener('popstate',()=>googleAllowed(),true);
  window.addEventListener('hashchange',()=>googleAllowed(),true);
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
 * sessionStorage only; queries, fragments and private path identifiers are excluded. Read by the sign-in flows and carried through the magic
 * link so the new-sign-up alert can say where the person actually arrived
 * from.
 */
export function firstTouch(): { ref: string; landing: string } | null {
  try {
    const raw = sessionStorage.getItem("netify_first_touch");
    if (!raw) return null;
    const t = JSON.parse(raw) as { ref?: string; landing?: string };
    return { ref: analyticsReferrer(t.ref ?? ""), landing: analyticsPath(t.landing ?? "") };
  } catch {
    return null;
  }
}

function fire(name: string, data: Record<string, string> = {}): void {
  if (!readConsent().analytics) return;
  const payload = { ...analyticsProps(data), path: analyticsPath(window.location.href) };
  try {
    window.va?.('event', { name, data: payload });
  } catch {
    /* analytics must never break the page */
  }
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
      .gtag;
    if(googleAllowed())gtag?.('event', name, { event_category: 'commercial', ...payload, page_location: analyticsLocation(window.location.href), page_referrer: analyticsReferrer(document.referrer), page_title: 'Netify buying platform' });
  } catch {
    /* ignore */
  }
}

export default function NetifyEvents() {
  const pathname=usePathname();
  useEffect(() => {
    installGooglePrivacyGuard();
    // First-touch attribution capture, once per browser session (see
    // firstTouch above). Must run before anything else so a visitor who
    // signs in on their landing page still gets attributed.
    try {
      if (!sessionStorage.getItem("netify_first_touch")) {
        sessionStorage.setItem(
          "netify_first_touch",
          JSON.stringify({ ref: analyticsReferrer(document.referrer), landing: analyticsPath(window.location.href), at: Date.now() }),
        );
      }
    } catch { /* private mode */ }

    // Vercel Web Analytics: official queue shim + script, idempotent.
    if (readConsent().analytics && !document.querySelector('script[data-netify-va]')) {
      if (typeof window.va !== 'function') {
        window.va = function () {
          // eslint-disable-next-line prefer-rest-params
          (window.vaq = window.vaq || []).push(arguments);
        } as unknown as VaFn;
      }
      window.va?.('beforeSend', event => readConsent().analytics ? {...event,url:analyticsLocation(event.url)} : null);
      const s = document.createElement('script');
      s.defer = true;
      s.src = '/_vercel/insights/script.js';
      s.setAttribute('data-netify-va', '1');
      document.head.appendChild(s);
    }

    // GA4 loader with Consent Mode (default denied; upgrade from the shared
    // netify_consent cookie).
    if (googleAllowed() && !document.querySelector('script[data-netify-ga]')) {
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
      w.gtag('set', { page_location: analyticsLocation(window.location.href), page_referrer: analyticsReferrer(document.referrer), page_title: 'Netify buying platform' });
      w.gtag('config', 'G-XNL6HY3BQX', { send_page_view: false });
      const g = document.createElement('script');
      g.async = true;
      g.src = 'https://www.googletagmanager.com/gtag/js?id=G-XNL6HY3BQX';
      g.setAttribute('data-netify-ga', '1');
      document.head.appendChild(g);
    }

    if(readConsent().analytics){
      const safePage={page_location:analyticsLocation(window.location.href),page_referrer:analyticsReferrer(document.referrer),page_title:'Netify buying platform'};
      if(googleAllowed()){window.gtag?.('set',safePage);window.gtag?.('event','page_view',safePage);}
      const params=new URLSearchParams(window.location.search);
      fire('buying_entry',{intent:params.get('intent')==='pricing'?'pricing':'project',channel:params.get('source')==='mcp'?'mcp':'web'});
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
  }, [pathname]);

  return null;
}

