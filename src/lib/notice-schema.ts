/**
 * JSON-LD and formatting helpers for public project notice pages. Kept apart
 * from structured-data.ts because these operate on opportunity projections.
 */

import { SITE_URL } from "@/lib/structured-data";
import { OPP_SCOPE_LABELS, RESPONSE_MODE_LABELS, type PublicOpportunity } from "@/lib/opportunity-types";
import { SECTORS, REGIONS, labelFor } from "@/lib/notice-options";

export function noticePath(o: { id: string }): string {
  return `/opportunities/${o.id}`;
}

export function noticeUrl(o: { id: string }): string {
  return `${SITE_URL}${noticePath(o)}/`;
}

export function formatDate(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function isoDate(ms: number | null): string | undefined {
  return ms ? new Date(ms).toISOString().slice(0, 10) : undefined;
}

export function scopeLabels(o: PublicOpportunity): string[] {
  return o.scope.map((s) => OPP_SCOPE_LABELS[s] ?? s);
}

export function sectorLabel(o: PublicOpportunity): string {
  return o.buyer_sector ? labelFor(SECTORS, o.buyer_sector) : "";
}

export function regionLabels(o: PublicOpportunity): string[] {
  return o.regions.map((r) => labelFor(REGIONS, r));
}

export function buyerLabel(o: PublicOpportunity): string {
  if (o.buyer_visibility === "anonymous" || !o.buyer_org) {
    // "Not stated" is a sector value, not a buyer description: the phrase
    // "Not stated buyer" would read as nonsense, so an explicit not-stated
    // sector falls back to the plain anonymous label.
    const sector = o.buyer_sector === "not_stated" ? "" : sectorLabel(o);
    return sector ? `${sector} buyer (anonymous)` : "Anonymous buyer";
  }
  return o.buyer_org;
}

/**
 * JSON-LD for a public project notice. WebPage + Demand: the notice is a page
 * describing a buyer-side demand for a service. This markup mirrors visible
 * page content only; pricing amounts and buyer contact details never appear.
 */
export function getNoticeSchema(o: PublicOpportunity, opts?: { canonicalPath?: string; isSample?: boolean }) {
  const path = opts?.canonicalPath ?? noticePath(o);
  const url = `${SITE_URL}${path}/`;
  const demand = {
    "@type": "Demand",
    name: o.title,
    description: o.summary,
    itemOffered: {
      "@type": "Service",
      name: scopeLabels(o).join(", "),
      serviceType: scopeLabels(o),
      areaServed: regionLabels(o),
    },
    // A closed or awarded notice states the observed end of the demand
    // (closed notices stay published forever, with their close date); an
    // open notice states its stated deadline.
    availabilityEnds: o.status !== "open" && o.closed_at
      ? isoDate(o.closed_at)
      : isoDate(o.response_deadline ?? o.deadline),
    seller: undefined,
  };
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#notice`,
    url,
    name: o.title,
    description: o.ai_summary || o.summary,
    datePublished: new Date(o.created).toISOString(),
    dateModified: new Date(o.updated).toISOString(),
    isPartOf: { "@id": `${SITE_URL}/opportunities/board/#board` },
    about: demand,
    ...(opts?.isSample
      ? { creativeWorkStatus: "Sample", alternativeHeadline: "Sample project notice (worked example, not a live opportunity)" }
      : {}),
    publisher: { "@id": `${SITE_URL}/#organization` },
    speakable: { "@type": "SpeakableSpecification", cssSelector: ["#page-h1", "#ai-summary"] },
  };
}

/** Human + agent readable status line used on notice pages and feeds. */
export function responseModeLabel(o: PublicOpportunity): string {
  return RESPONSE_MODE_LABELS[o.response_mode] ?? o.response_mode;
}
