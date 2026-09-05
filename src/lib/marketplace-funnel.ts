import "server-only";
import { kvRaw } from "@/lib/rfp-store";

export const MARKETPLACE_FUNNEL_VERSION = "marketplace-funnel/1.0.0" as const;
export type MarketplaceFunnelEvent = "project_started" | "requirements_updated" | "match_previewed" | "publication_prepared" | "identity_verified" | "publication_completed" | "publication_incomplete" | "supplier_interest" | "supplier_response";

export async function recordMarketplaceFunnelEvent(input: { event: MarketplaceFunnelEvent; project_id: string; source?: string; mode?: string; channel: "web" | "api" | "mcp" | "system"; detail?: Record<string, string | number | boolean | null> }) {
  const record = { version: MARKETPLACE_FUNNEL_VERSION, at: Date.now(), event: input.event, project_id: input.project_id, source: input.source ?? "unknown", mode: input.mode ?? "unknown", channel: input.channel, detail: input.detail ?? {} };
  try {
    if (["publication_completed", "identity_verified"].includes(input.event)) {
      const first = await kvRaw(["SET", `marketplace:funnel:unique:${input.event}:${input.project_id}`, "1", "NX"]);
      if (first !== "OK") return record;
    }
    await kvRaw(["LPUSH", "marketplace:funnel:events", JSON.stringify(record)]); await kvRaw(["LTRIM", "marketplace:funnel:events", "0", "9999"]); } catch { /* analytics never changes the buyer outcome */ }
  return record;
}
