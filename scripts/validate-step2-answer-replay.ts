import assert from "node:assert/strict";

import { replayDecisionLedger, type DecisionLedgerEntry } from "../src/lib/workspace/decision-ledger";

const noteId = "guided-answer:q-service-desk";
const entry = (id: string, label: string, overrides: Partial<DecisionLedgerEntry> = {}): DecisionLedgerEntry => ({
  id,
  at: Number(id.replace(/\D/g, "")) || 1,
  questionId: "q-service-desk",
  optionId: "custom",
  optionLabel: "Custom answer",
  action: "note",
  resultingFactPaths: [],
  resultingNoted: [{ id: noteId, label, section: "operating", own: true }],
  clearedNotedIds: [noteId],
  ...overrides,
});

const corrected = replayDecisionLedger([
  entry("turn-1", "Weekday service desk"),
  entry("turn-2", "24/7 UK service desk"),
]);
assert.deepEqual(corrected.noted, [
  { id: noteId, label: "24/7 UK service desk", section: "operating", own: true },
]);

const structuredCorrection = replayDecisionLedger([
  entry("turn-1", "Weekday service desk"),
  entry("turn-2", "Structured correction", {
    action: "items",
    resultingFactPaths: ["procurement.operatingModel"],
    resultingNoted: [],
    clearedNotedIds: [noteId],
  }),
]);
assert.deepEqual(structuredCorrection.noted, []);

console.log("Step 2 answer replay validation passed.");
