/**
 * Minimal client-side analytics event layer. Pushes to window.dataLayer when
 * present (GTM) and mirrors to console in development. Server components never
 * import this. Event names follow the marketplace tracking plan
 * (docs: rebuild spec, Part M).
 */

export type AnalyticsProps = Record<string, string | number | boolean | string[] | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
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
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", payload);
  }
}
