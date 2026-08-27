/**
 * The decision ledger (Living Procurement UK Decision-Maker Blueprint,
 * correction pass, Robert, 15 Aug 2026, defects 3 and 4).
 *
 * Defect 3 ("Make question state durable"): answered NextQuestion state,
 * temporarily dismissed questions, accepted/declined sector suggestions and
 * any structured option selection needed to reconstruct the document were
 * ALL only ever `useState` in ProjectDesk.tsx -- gone on reload, and never
 * threaded through Save/Publish at all. Robert's instruction: "Use the
 * existing project/source-ledger persistence and resume architecture. Do
 * not create a browser-only parallel store."
 *
 * Defect 4 ("Record button answers honestly"): a clicked NextQuestion
 * option is buyer intent, but it is not free-typed buyer wording -- landing
 * it as `quote: opt.label` inside the ordinary structured-fact merge (as
 * `landOption`/`pickChip` correctly do for the pre-existing twin editor)
 * would, if it also touched the source ledger, misrepresent a button click
 * as typed prose with no ledger receipt distinguishing the two. Robert:
 * "Either introduce an explicit structured-action provenance or another
 * honest provenance type."
 *
 * This module is the SAME shape and the SAME two pure operations as
 * source-ledger.ts (SourceLedgerEntry / mergeSourceLedger /
 * hydrateSourceTurns / resumeStateFromProject), deliberately -- one new
 * canonical, structured, persisted, top-level Project field
 * (`decision_ledger`, rfp-types.ts) closes both defects at once: each
 * entry IS the honest structured-action receipt defect 4 asks for
 * (question id, option id, the user-facing selected label -- never the
 * question text, a timestamp/order, and the resulting governed field/note
 * changes), and replaying the whole ledger (`replayDecisionLedger`) is
 * what reconstructs `noted`/`dismissedQuestionIds`/`declinedSuggestionIds`
 * on resume for defect 3, from the SAME durable store, not a second one.
 */

import { z } from "zod";

/** The five ways `answerNextQuestion` (ProjectDesk.tsx) can resolve a
 *  card, mirrored 1:1 from that function's own branches. `items`/`note`
 *  land a real structured selection (a fact merge or a noted item);
 *  `dismiss_question` sets an earned question aside without landing
 *  anything; `decline_suggestion`/`accept_suggestion` are the sector-pack
 *  law's own two verdicts on a `sector_suggestion`-sourced card (an
 *  accepted suggestion lands as a `note`, so it is recorded with action
 *  "note", not a sixth kind -- `resultingNoted`'s `ps-` prefixed id is
 *  what distinguishes it on replay). */
export const DECISION_LEDGER_ACTIONS = ["items", "note", "dismiss_question", "decline_suggestion"] as const;
export type DecisionLedgerAction = (typeof DECISION_LEDGER_ACTIONS)[number];

/** One immutable structured buyer action -- the honest alternative to
 *  presenting a clicked option as an ordinary typed buyer quote. `id` is
 *  the merge key (generated once, client-side, the moment the option is
 *  clicked) so repeated saves are idempotent by construction, exactly like
 *  `SourceLedgerEntry.id`. `optionLabel` is the user-facing selected
 *  label shown on the button -- the buyer's OWN wording never enters this
 *  ledger via this path (see notedIsFromButton). */
export const NotedItemShapeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  section: z.string(),
  own: z.boolean().optional(),
});
export type NotedItemShape = z.infer<typeof NotedItemShapeSchema>;

export const DecisionLedgerEntrySchema = z
  .object({
    id: z.string().min(1),
    at: z.number(),
    questionId: z.string().min(1),
    optionId: z.string().min(1),
    optionLabel: z.string().min(1),
    action: z.enum(DECISION_LEDGER_ACTIONS),
    /** WorkspaceFact paths this action touched, e.g. an `items` answer
     *  landing `procurement.buying`. Audit trail only -- the values
     *  themselves already live in `facts`/the persisted requirement base;
     *  this is never turned back into fake facts on replay. */
    resultingFactPaths: z.array(z.string()).default([]),
    /** The noted item(s) this action created, if any (`note` and the
     *  `note`-landing half of an accepted sector suggestion). Replayed
     *  verbatim into `noted` on resume. */
    resultingNoted: z.array(NotedItemShapeSchema).default([]),
    /** Noted slots this action supersedes. This keeps the ledger
     *  append-only while allowing a later structured correction to remove
     *  an earlier free-text fallback during server-side resume. */
    clearedNotedIds: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type DecisionLedgerEntry = z.infer<typeof DecisionLedgerEntrySchema>;

/** Untrusted request-body JSON -> validated entries. Same "duplication is
 *  safer than disappearance" per-item best-effort as
 *  parseIncomingSourceTurns: one malformed item drops only itself. */
export function parseIncomingDecisionTurns(raw: unknown): DecisionLedgerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DecisionLedgerEntry[] = [];
  for (const item of raw) {
    const parsed = DecisionLedgerEntrySchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** The same accretion-only, id-deduplicated merge every source-ledger
 *  write path shares (mergeSourceLedger): append every incoming entry
 *  whose id is not already present, in order, change nothing else.
 *  Idempotent by construction -- a repeated save with nothing new clicked
 *  is a no-op. */
export function mergeDecisionLedger(existing: DecisionLedgerEntry[], incoming: DecisionLedgerEntry[]): DecisionLedgerEntry[] {
  const seen = new Set(existing.map((e) => e.id));
  const merged = existing.slice();
  for (const entry of incoming) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  return merged;
}

/**
 * Defect 3's actual reconstruction step: replays a full decision ledger
 * (in recorded order) back into the three pieces of UI state that were
 * previously browser-only -- `noted`, `dismissedQuestionIds`,
 * `declinedSuggestionIds`. PURE, and the exact function ProjectDesk.tsx's
 * resume effect calls (not a hand-rolled stand-in), so "what resume
 * restores" and "what a fixture proves" cannot drift apart, the same
 * discipline resumeStateFromProject() itself documents.
 *
 * A later "decline_suggestion" entry for the same questionId a later
 * "note" entry then re-accepts (or vice versa) resolves to whichever came
 * LAST in the ledger's own recorded order -- the ledger is an ordered,
 * append-only log of what the buyer actually did, in the order they did
 * it, so the buyer's most recent choice always wins, exactly like
 * dismissedQuestionIds/declinedSuggestionIds already behave (there is no
 * hidden "first answer wins" rule anywhere in this codebase).
 */
export function replayDecisionLedger(ledger: DecisionLedgerEntry[]): {
  noted: NotedItemShape[];
  dismissedQuestionIds: string[];
  declinedSuggestionIds: string[];
} {
  const noted: NotedItemShape[] = [];
  const dismissed = new Set<string>();
  const declined = new Set<string>();
  for (const entry of ledger) {
    for (const id of entry.clearedNotedIds ?? []) {
      const index = noted.findIndex((n) => n.id === id);
      if (index !== -1) noted.splice(index, 1);
    }
    if (entry.action === "dismiss_question") {
      dismissed.add(entry.questionId);
    } else if (entry.action === "decline_suggestion") {
      const suggestionId = entry.questionId.replace(/^sector:/, "");
      declined.add(suggestionId);
      // Living Procurement UK Decision-Maker Blueprint, correction pass
      // round 3 (Robert, 15 Aug 2026), release blocker 1: this header
      // comment already promised "a later decline reverses an earlier
      // accept, exactly like the reverse direction below" -- the code
      // only ever implemented the accept-reverses-decline half. A later
      // decline for a suggestion the buyer had ALREADY accepted (a real,
      // reproduced case: accept -> decline in the same session) left the
      // earlier `ps-<suggestionId>` noted item in `noted` forever, so
      // compileProcurementDocument (which only checks for that noted tag,
      // never declinedSuggestionIds) kept compiling the governed clause
      // for a suggestion the buyer had explicitly declined. Fixed by
      // removing the matching noted item here too -- the buyer's most
      // recent choice wins in BOTH directions, not just one.
      const psId = `ps-${suggestionId}`;
      const acceptedIndex = noted.findIndex((n) => n.id === psId);
      if (acceptedIndex !== -1) noted.splice(acceptedIndex, 1);
    } else {
      // "items" | "note": accepting a sector suggestion later than a
      // decline reverses the decline -- the buyer changed their mind, and
      // this ledger entry is strictly later in recorded order.
      for (const n of entry.resultingNoted) {
        if (n.id.startsWith("ps-")) declined.delete(n.id.replace(/^ps-/, ""));
        const existing = noted.findIndex((x) => x.id === n.id);
        if (existing === -1) noted.push(n);
        else noted[existing] = n;
      }
    }
  }
  return { noted, dismissedQuestionIds: [...dismissed], declinedSuggestionIds: [...declined] };
}

/**
 * The other half of resume, mirroring resumeStateFromProject() exactly:
 * the ONE function ProjectDesk.tsx's arrival effect calls to restore
 * decision state from a fetched project, and the same function a fixture
 * calls directly against a project built by the real
 * buildSecurityProject()/buildRescopedProject() core, so "what
 * ProjectDesk restores" and "what this fixture proves" cannot drift
 * apart. Scoped identically to resumeStateFromProject() (security_sourcing
 * only) -- the SAME architecture and the SAME boundary, not a wider one:
 * a non-engine/wizard project's Save path does not drive this resume flow
 * either.
 */
export function resumeDecisionsFromProject(
  proj: { engine?: string; decision_ledger?: DecisionLedgerEntry[] } | null | undefined,
): { decisionLedger: DecisionLedgerEntry[]; noted: NotedItemShape[]; dismissedQuestionIds: string[]; declinedSuggestionIds: string[] } | null {
  if (!proj || proj.engine !== "security_sourcing") return null;
  const decisionLedger = proj.decision_ledger ?? [];
  return { decisionLedger, ...replayDecisionLedger(decisionLedger) };
}
