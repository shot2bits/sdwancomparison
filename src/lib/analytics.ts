import { fireNetifyEvent } from "@/components/NetifyEvents";
import { analyticsProps } from "@/lib/analytics-privacy";

export type AnalyticsProps = Record<string, string | number | boolean | string[] | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;
  fireNetifyEvent(event,analyticsProps(props));
}
