"use client";

/**
 * Phase 0 vertical slice — the orchestrator (W0 preview, isolated route
 * only: /preview/quick-sor). New, focused, typed-prop composition; does
 * NOT modify ProjectDesk.tsx and is not reachable from any live route.
 *
 * Every submitted message is routed through the EXISTING production path,
 * unmodified: POST /sase/api/workspace/extract (extractRequirement()) then
 * mergeUpdates() from @/lib/workspace/draft. No new backend route, no new
 * persistence rule, no vendor field, no auth, no MCP change. State lives in
 * this component only (React state), never localStorage — closing the tab
 * loses the draft, same limitation the retired PositionWorkspace/
 * LiveWorkspace components accepted for their own scratch state.
 */

import { useState } from "react";
import JourneySelector, { type JourneyId } from "./JourneySelector";
import PersistentAssistantInput from "./PersistentAssistantInput";
import CaptureReceiptBanner from "./CaptureReceiptBanner";
import StatementOfRequirements from "./StatementOfRequirements";
import { mergeUpdates, requirementFrom, type WorkspaceFact } from "@/lib/workspace/draft";
import type { FieldUpdate } from "@/lib/workspace/extract";

type Receipt = { cycle: number; updates: FieldUpdate[] };

export default function QuickSorWorkspace() {
  const [journey, setJourney] = useState<JourneyId>("quick_sor");
  const [facts, setFacts] = useState<WorkspaceFact[]>([]);
  const [cycle, setCycle] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);

  const started = facts.length > 0 || lastReceipt !== null;

  async function runCycle() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Same endpoint, same request shape, same requirementFrom() bridge
      // ProjectDesk.tsx uses today — nothing new on the wire.
      const res = await fetch("/sase/api/workspace/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, requirement: requirementFrom(facts) }),
      });
      if (!res.ok) throw new Error(`Could not read that just now (${res.status}). Try again.`);
      const data = (await res.json()) as { updates: FieldUpdate[]; engine: string; notes: string[] };
      const nextCycle = cycle + 1;
      const merged = mergeUpdates(facts, data.updates ?? [], nextCycle, "extract");
      setFacts(merged.facts);
      setCycle(nextCycle);
      setLastReceipt({ cycle: nextCycle, updates: data.updates ?? [] });
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong reading that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <JourneySelector current={journey} onSelect={setJourney} />

      {journey !== "quick_sor" ? (
        <div className="rounded-[13px] border border-dashed border-[#EAE7E1] p-6 text-center">
          <p className="m-0 text-[13px] text-[#8C8A85]">
            This journey isn&rsquo;t built in this preview yet. Choose &ldquo;Quick Statement of Requirements&rdquo;
            above to try the working slice.
          </p>
        </div>
      ) : (
        <>
          <PersistentAssistantInput
            value={input}
            onChange={setInput}
            onSubmit={() => void runCycle()}
            busy={busy}
            started={started}
            error={error}
          />

          {lastReceipt && (
            <div className="mt-6">
              <CaptureReceiptBanner updates={lastReceipt.updates} cycle={lastReceipt.cycle} />
            </div>
          )}

          {started && (
            <div className="mt-2">
              <StatementOfRequirements facts={facts} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
