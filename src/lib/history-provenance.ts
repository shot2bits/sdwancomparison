/**
 * 2030 blueprint, Checkpoint C (17 Aug 2026): "agentic decision
 * intelligence and governed MCP connections" -- visible provenance for
 * every agent/MCP-originated action, per the blueprint's component
 * grammar (Observe/Propose/Approve/Act/Receipt; "visible provenance ...
 * no unreceipted agent/MCP actions"). The audit substrate for this
 * ALREADY existed before this change: `ProjectHistoryEvent.via` has
 * carried a real `"mcp"` value since spec 1.6 (rfp-types.ts), and the
 * Activity feed (project/[id]/page.tsx) already rendered it as a plain
 * grey text suffix ("assistant · mcp"). What was missing was a
 * DISTINGUISHING visual treatment -- the blueprint's own violet
 * agent/MCP token, a receipt affordance -- not a new audit trail; this
 * file adds exactly that reading, as a pure function so it is testable
 * without a server (scripts/validate-history-provenance.ts) and so the
 * Activity feed and any future surface (the Procurement Room, a
 * dedicated MCP log) share one definition rather than duplicating the
 * "is this an MCP receipt" judgment.
 */
import type { ProjectHistoryEvent } from "@/lib/rfp-types";

export type HistoryProvenance = {
  /** True when this event was an agent/MCP tool call, not a human web
   *  action -- the ONLY thing that should ever earn the violet MCP
   *  badge (never confused with "actor === assistant" alone: a
   *  human-triggered assistant suggestion accepted through the web UI
   *  is `via: "web"`, not an MCP receipt). */
  isMcp: boolean;
  /** True when this specific event carries a recorded consent (the
   *  ProjectConsentSchema-shaped `granted_by`/`text` trail some events
   *  attach) -- surfaced so an MCP action that required and received
   *  explicit consent reads differently from one that did not need it. */
  hasConsent: boolean;
  /** How many extra fields this event's `detail` carries beyond the
   *  bare event name -- a non-zero count is the signal a receipt has
   *  real substance behind it (a mcp tool's actual arguments/result),
   *  not just a label. */
  detailFieldCount: number;
};

export function historyProvenance(h: ProjectHistoryEvent): HistoryProvenance {
  return {
    isMcp: h.via === "mcp",
    hasConsent: h.consent === true,
    detailFieldCount: Object.keys(h.detail ?? {}).length,
  };
}
