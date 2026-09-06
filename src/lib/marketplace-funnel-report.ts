/** Aggregate operational events without exposing project identifiers or free text. */
export const FUNNEL_EVENTS = ["project_started", "requirements_updated", "match_previewed", "publication_prepared", "identity_verified", "publication_completed", "publication_incomplete", "supplier_interest", "supplier_response"] as const;
export type FunnelEvent = typeof FUNNEL_EVENTS[number];
export const FUNNEL_SOURCES = ["rfp_builder", "shortlist", "marketplace", "sector", "mcp", "circuit_pricing", "notice_builder", "unknown"] as const;
export const FUNNEL_MODES = ["quick_list", "find_providers", "build_rfp", "check_rfp", "short", "detailed", "circuit", "notice", "unknown"] as const;
export const FUNNEL_CHANNELS = ["web", "api", "mcp", "system"] as const;
export const FUNNEL_LABELS: Record<FunnelEvent, string> = {
 project_started: "Project saved", requirements_updated: "Requirements updated", match_previewed: "Match preview requested", publication_prepared: "Publication prepared", identity_verified: "Business identity verified", publication_completed: "Published on the board", publication_incomplete: "Publication incomplete", supplier_interest: "Supplier interest received", supplier_response: "Supplier response received",
};
export const knownValue = (value: unknown, allowed: readonly string[], fallback = "unknown") => typeof value === "string" && allowed.includes(value) ? value : fallback;
const emptyCounts = () => Object.fromEntries(FUNNEL_EVENTS.map(e => [e, 0])) as Record<FunnelEvent, number>;
type Row = { source: string; mode: string; channel: string; counts: Record<FunnelEvent, number> };
type Event = { at: number; event: FunnelEvent; project_id: string; source: string; mode: string; channel: string };
export function aggregateFunnel(raw: unknown[], now = Date.now()) {
 const start = now - 28 * 86400000;
 const events: Event[] = [];
 for (const item of raw) {
  try {
   const e = typeof item === "string" ? JSON.parse(item) : item;
   if (!e || !Number.isFinite(e.at) || e.at > now || !FUNNEL_EVENTS.includes(e.event) || typeof e.project_id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(e.project_id)) continue;
   events.push({ at:e.at, event:e.event, project_id:e.project_id, source:knownValue(e.source,FUNNEL_SOURCES), mode:knownValue(e.mode,FUNNEL_MODES), channel:knownValue(e.channel,FUNNEL_CHANNELS,"system") });
  } catch { /* Ignore malformed historical analytics, never return their contents. */ }
 }
 events.sort((a,b)=>a.at-b.at);
 const origins = new Map<string, Event>();
 for (const e of events) if (!origins.has(e.project_id) || (origins.get(e.project_id)?.source === "unknown" && e.source !== "unknown")) origins.set(e.project_id,e);
 const groups = new Map<string, Row>(); const seen = new Set<string>(); const counts=emptyCounts();
 for (const e of events.filter(e=>e.at>=start)) {
  const key=e.project_id+":"+e.event; if(seen.has(key))continue; seen.add(key); counts[e.event]++;
  const origin=origins.get(e.project_id)!; const groupKey=[origin.source,origin.mode,origin.channel].join(":");
  let group=groups.get(groupKey); if(!group){group={source:origin.source,mode:origin.mode,channel:origin.channel,counts:emptyCounts()};groups.set(groupKey,group);}
  group.counts[e.event]++;
 }
 return { generated_at:now, period_start:start, period_days:28, oldest_available:events[0]?.at??null, retained_event_limit:10000, retention_limit_reached:raw.length>=10000, counts, rows:[...groups.values()].sort((a,b)=>a.source.localeCompare(b.source)||a.mode.localeCompare(b.mode)||a.channel.localeCompare(b.channel)), interpretation:"Unique projects reaching each stage in the last 28 days, not one acquisition cohort or a conversion rate. Some projects started earlier. Browser entry counts are separate consent-dependent analytics. Coverage was extended on 6 September 2026; missing historical events are not backfilled." };
}
export type FunnelReport = ReturnType<typeof aggregateFunnel>;
