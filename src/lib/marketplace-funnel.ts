import "server-only";
import { kvRaw } from "@/lib/rfp-store";
import { FUNNEL_EVENTS, FUNNEL_SOURCES, FUNNEL_MODES, FUNNEL_CHANNELS, knownValue, type FunnelEvent } from "@/lib/marketplace-funnel-report";

export const MARKETPLACE_FUNNEL_VERSION = "marketplace-funnel/1.0.0" as const;
export type MarketplaceFunnelEvent = FunnelEvent;
// One atomic operation: a failed append must never leave a success marker.
export const FUNNEL_APPEND_ONCE = `-- netify-funnel-append-once
if redis.call('exists', KEYS[1]) == 1 then return 0 end
redis.call('lpush', KEYS[2], ARGV[1])
redis.call('ltrim', KEYS[2], 0, 9999)
redis.call('set', KEYS[1], '1', 'EX', 7776000)
return 1`;
export async function recordMarketplaceFunnelEvent(input: { event: MarketplaceFunnelEvent; project_id: string; source?: string; mode?: string; channel: "web" | "api" | "mcp" | "system"; detail?: Record<string, string | number | boolean | null> }) {
 if (!FUNNEL_EVENTS.includes(input.event) || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.project_id)) return;
 const detail = Object.fromEntries(Object.entries(input.detail??{}).filter(([key,value])=>["revision","considered_count","board_created"].includes(key) && (typeof value==="boolean" || (typeof value==="number" && Number.isFinite(value)))));
 const record={version:MARKETPLACE_FUNNEL_VERSION,at:Date.now(),event:input.event,project_id:input.project_id,source:knownValue(input.source,FUNNEL_SOURCES),mode:knownValue(input.mode,FUNNEL_MODES),channel:knownValue(input.channel,FUNNEL_CHANNELS,"system"),detail};
 try {
  if (["project_started","publication_completed","identity_verified","supplier_response","supplier_interest"].includes(input.event)) {
   await kvRaw(["EVAL",FUNNEL_APPEND_ONCE,2,`marketplace:funnel:unique:${input.event}:${input.project_id}`,"marketplace:funnel:events",JSON.stringify(record)]);
  } else {
   await kvRaw(["LPUSH","marketplace:funnel:events",JSON.stringify(record)]);
   await kvRaw(["LTRIM","marketplace:funnel:events",0,9999]);
  }
 } catch { /* Analytics never changes the buyer outcome. */ }
 return record;
}
