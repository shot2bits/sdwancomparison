/**
 * Minimal client-side analytics event layer for the Opportunity Board /
 * Notice Builder wizard (RouteDiagnosis, BoardList, NoticeBuilder). Pushes to
 * window.dataLayer when present (GTM) and mirrors to console in development.
 * Server components never import this. Event names follow the marketplace
 * tracking plan (docs: rebuild spec, Part M).
 *
 * Fixed 11 Aug 2026: this only ever pushed to window.dataLayer, on the
 * assumption a Google Tag Manager container would read it. No GTM script is
 * (or was) installed anywhere in this app, so every one of these events -
 * post_project_started, opportunity_published, publish_clicked, etc. - has
 * been going into an array nobody reads since this file was written. Now
 * also calls window.gtag directly, the same way NetifyEvents.tsx's fire()
 * does for the rest of the site's commercial events, so this reaches GA4
 * (G-XNL6HY3BQX) immediately without depending on a GTM container existing.
 * The dataLayer.push is left in place in case one is added later.
 */

export type AnalyticsProps = Record<string, string | number | boolean | string[] | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;
  const payload = { event, ...props, ts: Date.now() };
  try {
    window.dataLayer?.push(payload);
  } catch {
    /* best effort */
  }
  try {
    window.gtag?.("event", event, { event_category: "opportunity_board", path: window.location.pathname, ...props });
  } catch {
    /* analytics must never break the page */
  }
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", payload);
  }
}
