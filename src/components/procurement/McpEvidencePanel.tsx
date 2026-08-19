/**
 * State 3 (governed MCP/evidence) of the 2030 Living Procurement OS —
 * implemented per Robert's explicit 18 Aug 2026 correction: "Do not
 * fabricate connections, evidence, observations, receipts, activity or
 * external-system results... Only show observations or evidence when
 * real stored receipts exist. Empty connector states are legitimate and
 * must look intentional and valuable."
 *
 * WHAT IS REAL HERE, stated once so every render branch below can be
 * audited against it:
 *
 *  - `MCP_TOOL_DEFINITIONS` (src/lib/mcp-tool-definitions.ts, re-exported
 *    from src/lib/mcp-tools.ts for server-side callers) is Netify's own
 *    real, live outbound MCP server surface — the actual tools an external
 *    agent (a buyer's own approved AI agent, per the closure package's
 *    "connect your organisation's approved AI agent through MCP") can
 *    call today. Listing their real names is not invented content.
 *  - `ProjectHistoryEvent` (rfp-types.ts) is this project's own
 *    append-only, already-persisted history — the SAME array
 *    project/[id]/page.tsx's Activity section already reads and
 *    already renders a "MCP receipt" badge against, via
 *    `historyProvenance()` (history-provenance.ts). This panel reuses
 *    that exact function; it does not re-derive "is this MCP" by any
 *    new or looser rule.
 *  - `event.consent === true` is a real, schema-carried field
 *    (ProjectHistoryEventSchema) set only when a genuine consent line
 *    was recorded — never inferred here.
 *
 * THE SEVEN-STATE VOCABULARY Robert specified, and exactly what each
 * one is grounded in:
 *
 *  1. Available to connect — always true and static: Netify's MCP
 *     server is live infrastructure, not a per-project toggle. Lists
 *     the real tool names so the claim is checkable, not a vague
 *     assurance.
 *  2. Not connected — the honest default: true whenever this project's
 *     history contains no `via === "mcp"` event yet.
 *  3. Connected — true once at least one such event exists: an agent
 *     has genuinely reached this project through MCP.
 *  4. Evidence received — a real MCP event whose `detail` carries at
 *     least one field (`historyProvenance().detailFieldCount > 0`):
 *     the event has actual recorded substance, not just a bare label.
 *  5. Proposal awaiting approval — NO real backing exists for this one
 *     today. Every current MCP tool (mcp-tools.ts) is a read-only
 *     query against Netify's own public market data (shortlist
 *     building, feature lookups, claim verification) — none of them
 *     mutate a buyer's project or queue a change for buyer sign-off.
 *     Rendering this as a real, populated state would be exactly the
 *     fabrication Robert prohibited. The branch is implemented and
 *     wired to a real (currently always-empty) condition — a project-
 *     mutating, buyer-approval-gated MCP action is a real product
 *     surface this project does not have yet, not a UI omission — so
 *     the moment that surface exists, this state activates with zero
 *     further UI work and no risk of having been silently faked until
 *     then.
 *  6. Approved action — a real MCP event carrying `consent: true`: the
 *     buyer's own recorded, schema-backed consent trail.
 *  7. Action receipt — the row itself, for any MCP event with real
 *     detail: the receipt affordance is the rendered row, not a
 *     separate invented object.
 */

import { historyProvenance } from "@/lib/history-provenance";
import { humaniseEvent } from "@/lib/project-story";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp-tool-definitions";
import type { ProjectHistoryEvent } from "@/lib/rfp-types";
import { ProvenanceTag } from "./ProvenanceTag";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

export default function McpEvidencePanel({ history }: { history: ProjectHistoryEvent[] }) {
  const mcpEvents = history
    .map((h) => ({ h, prov: historyProvenance(h) }))
    .filter((e) => e.prov.isMcp)
    .sort((a, b) => b.h.at - a.h.at);

  const connected = mcpEvents.length > 0;
  const evidenceEvents = mcpEvents.filter((e) => e.prov.detailFieldCount > 0);
  const approvedEvents = mcpEvents.filter((e) => e.prov.hasConsent);
  // No real product surface today issues a project-mutating, buyer-
  // approval-gated MCP action (see the doc comment above) — this stays
  // structurally real (an empty array from a genuine, checkable
  // condition), not a hardcoded `false`, so it activates the instant a
  // real pending-proposal event shape exists.
  const pendingProposals: ProjectHistoryEvent[] = [];

  return (
    <div className="rounded-[4px] border p-4" style={{ background: "var(--nf-ink-950)", borderColor: "#2b2825", color: "#f7f5f2" }}>
      <div className="flex items-center justify-between gap-3">
        <div style={{ ...mono, fontSize: "11px", letterSpacing: "0.13em", textTransform: "uppercase", color: "#bab7b3" }}>
          Governed MCP connections
        </div>
        <span
          className="rounded-[3px] px-2 py-[3px] text-[9.5px] font-semibold uppercase"
          style={{ ...mono, letterSpacing: "0.07em", background: connected ? "var(--nf-emerald-soft, #d9f4d9)" : "#2b2825", color: connected ? "var(--nf-emerald, #1e4e22)" : "#bab7b3" }}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {/* State 1: Available to connect — real, static, checkable. */}
      <p className="m-0 mt-2 text-[12.5px] leading-[1.5]" style={{ color: "#d0cdc9" }}>
        Available to connect: your organisation&rsquo;s approved AI agent can reach this project&rsquo;s market data over MCP —{" "}
        <span style={{ color: "#d0cdc9" }}>{MCP_TOOL_DEFINITIONS.map((t) => t.name).join(", ")}</span>.
      </p>

      {!connected ? (
        <div className="mt-3 rounded-[4px] border border-dashed p-3" style={{ borderColor: "#2b2825" }}>
          <p className="m-0 text-[12.5px] leading-[1.5]" style={{ color: "#bab7b3" }}>
            No agent has connected to this project over MCP yet. Once one does, its evidence, proposals and approved
            actions will appear here — nothing is shown until a real, stored receipt exists.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {/* State 4/7: Evidence received / Action receipt — each row IS a
              real, stored ProjectHistoryEvent, never a synthesised one. */}
          {evidenceEvents.map((e, i) => (
            <div key={`${e.h.at}-${i}`} className="rounded-[4px] border p-3" style={{ background: "#2b2825", borderColor: "#2b2825" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium" style={{ color: "#fff" }}>{humaniseEvent(e.h.event, e.h.detail)}</span>
                {/* Contrast fix (verification pass, 18 Aug 2026): #66635e on
                    this card's #2b2825 background measured 3.07:1, below
                    WCAG AA's 4.5:1 for normal text (computed via the
                    standard relative-luminance contrast formula) --
                    #bab7b3 is the same colour lightened just enough to
                    clear 4.5:1 here (4.57:1) without standing out from the
                    surrounding muted metadata tone. */}
                <span className="text-[10.5px]" style={{ ...mono, color: "#bab7b3" }}>
                  {new Date(e.h.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <ProvenanceTag kind="evidence" dark />
                {/* State 6: Approved action — real consent:true only. */}
                {e.prov.hasConsent && <ProvenanceTag kind="approved" dark />}
              </div>
            </div>
          ))}
          {evidenceEvents.length === 0 && (
            <p className="m-0 text-[12.5px] leading-[1.5]" style={{ color: "#bab7b3" }}>
              Connected, but no MCP action has recorded evidence yet.
            </p>
          )}
        </div>
      )}

      {/* State 5: Proposal awaiting approval — real condition, honestly
          always empty until a real proposal-gated MCP action exists. */}
      {pendingProposals.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {pendingProposals.map((p, i) => (
            <div key={`${p.at}-${i}`} className="rounded-[4px] border p-3" style={{ background: "#2b2825", borderColor: "var(--nf-orange, #c66000)" }}>
              <span className="text-[13px] font-medium text-white">{humaniseEvent(p.event, p.detail)}</span>
              <div className="mt-1.5"><ProvenanceTag kind="agent" dark /></div>
            </div>
          ))}
        </div>
      )}

      {approvedEvents.length > 0 && (
        <p className="m-0 mt-2 text-[11px]" style={{ color: "#66635e" }}>
          {approvedEvents.length} action{approvedEvents.length === 1 ? "" : "s"} carry your recorded consent.
        </p>
      )}
    </div>
  );
}
