# Fact Ledger Reliability Gate — 13 August 2026

Built exactly to your instruction: reliability gate only, no Canvas work. New clean worktree from `origin/main` at `5e24698`, your existing dirty checkout untouched. Regression fixture written and run against pristine `origin/main` first (it failed, reproducing both bugs verbatim), then against the fix (all pass). Full `npm run validate`, `tsc --noEmit`, the existing `verify-correction-pass-2.ts` battery, and a full `next build` all pass clean.

## What was actually wrong, confirmed against pristine `origin/main`

Your read was right and sharper than my first pass. Running the exact Doc 1 message against unmodified `origin/main`:

```
sector: {"value":"Healthcare & pharma","provenance":"inferred","reason":"\"health\" indicates this sector"}
bespoke (circuit clause): undefined   <- no fact of any kind, anywhere
```

Both reproduced byte-for-byte, including your screenshot's exact wording. The mechanism is `ProjectDesk.send()` (line ~1367 on `origin/main`): it only calls `keepReceipt(text)` on the branch where `r.landed === 0` — a whole-message all-or-nothing check. A message that lands four facts and misses a fifth clause hits the `landed > 0` branch and returns before the fifth clause's words are ever kept anywhere. That's the actual bug; the sector mislabelling is a separate, second bug in the same message.

## What changed

**`src/lib/workspace/extract.ts`**
1. A new deterministic direct-sector map, checked before the existing inference map: a literal "Healthcare", "Retail", "Manufacturing", "Financial services" (and the other six `WORKSPACE_SECTORS`) now lands `provenance: "stated"` with the buyer's own original-case quote (a new `originalSpan()` helper recovers the real casing, since the search text is lowercased internally). Indirect estate words — hospital, GP, dental, clinic, care home — are untouched, still inferred via the existing `sectorMap`, which now only runs if the direct map didn't already state it.
2. `splitDeclarativeClauses()` — pure sentence-boundary splitting, same law `chunkForIngest()` already uses for pastes.
3. `coverDeclarativeClauses()` — for every clause the accepted updates (model + deterministic, already unioned) don't trace to, either files it as a `requirements.bespoke` fact (when it reads as a discrete requirement — a verb/modal shape: requires/need/must/also have/looking for — deliberately not a circuit/technology noun list, per your instruction) or returns it as an `unplacedClauses[]` entry for the caller to keep as a receipt. A negated requirement ("we don't need X") is never filed as bespoke — it degrades to an unplaced receipt instead, so nothing is invented.
4. `matchedText` (new, optional field on `FieldUpdate`) — threaded through `say()`/`infer()` wherever an existing call uses a fixed canonical display label ("managed security" for an MDR mention, "SD-WAN"/"UK"/"Microsoft" for a bare regex hit) that would never literally appear in the buyer's own clause. Without this, coverage-checking wrongly treated those clauses as unrepresented and started filing spurious duplicate bespoke entries — caught live while writing the regression script (see Regression 4c below), fixed before it shipped.
5. `ExtractResult` gained `unplacedClauses: string[]`.

**`src/components/ProjectDesk.tsx`**
- `send()`: now keeps every clause in `unplacedClauses` as a receipt **before** branching on whether other facts landed, so a message that lands four facts and misses a fifth no longer drops the fifth silently. The old whole-message fallback (`keepReceipt(text)`) only fires when there was no clause structure to keep individually at all (a short aside, or a glossary question, which never reaches the new clause pass).
- `CycleResult`/`runCycle` carry the new `unplaced: string[]` through from the API response.
- `PATH_LABELS` gained `"requirements.bespoke": "Additional requirements"` so the chat reply's "Written in: ..." line names it properly instead of the raw path string.

**`scripts/verify-fact-ledger-reliability-gate.ts`** (new) — the regression fixture, house style (matches `verify-correction-pass-2.ts`).

## Test output

All 13 assertions pass, covering your six named scenarios plus a live catch made while writing the tests:

```
PASS  Doc 1 message: sector stated 'Healthcare' (not guessed), circuit clause lands in requirements.bespoke, nothing unplaced
PASS  Sector: literal "Healthcare"/"Retail"/"Manufacturing"/"Financial services" -> stated, original-case quote  (4 cases)
PASS  Sector: indirect "hospital"/"GP"/"dental" -> still inferred, unchanged  (3 cases)
PASS  Four clauses land facts, the fifth (small talk) is kept as an unplaced receipt, not dropped
PASS  A clause already covered by estate.sites/procurement.buying is not also filed as bespoke
PASS  The rail's own threat-protection bespoke match is not duplicated by the clause-coverage supplement
PASS  A canonical-label fact (managed security, off an 'MDR' mention) is not duplicated as a bespoke requirement
PASS  extractRequirement falls back to the deterministic rail when the model is unavailable, and the gate still runs on top of it
PASS  A correction ('actually 25 sites') still upgrades the ledger to 25, not 20
PASS  A negated requirement clause is not filed as a bespoke requirement -- it surfaces as an unplaced receipt instead
PASS  A short CONTIGUOUS phrase from a long unplaced-clause receipt matches ProjectDesk's drop/remove command predicate

ALL PASS (13/13)
```

Plus the pre-existing `verify-correction-pass-2.ts` battery (glossary questions, quantity validation, retraction/correction sequences) — unaffected, all pass.

On item 5 (model timeout/unavailability): `ANTHROPIC_API_KEY` isn't set in this sandbox, so every case above already runs the deterministic-only path end to end — an honest limitation of the *test environment*, not a gap in coverage, since the gate runs identically regardless of which engine produced the underlying facts.

## Remaining limitations

1. **Drop/remove command matching on long receipts.** `ProjectDesk.tsx`'s "drop X"/"remove X" command matches by concatenating all whitespace out of both the receipt text and the typed target, then checking substring inclusion. That's fine for short fragments but breaks for a **non-adjacent** two-word phrase inside a longer clause — "Ethernet circuit" doesn't match "...point to point **Ethernet private circuit**" because "private" sits between the words and concatenation removes the space that would normally separate them. A contiguous phrase ("point to point Ethernet") still matches fine. This existed before today's change but is more likely to surface now that a whole sentence can be a receipt. Not fixed here — it's a UI-command matching change, out of this gate's scope, but worth a small follow-up (matching on normalized-with-spaces substrings instead of fully concatenated ones) if it bothers you in testing.
2. **Model-inferred facts still contribute no coverage anchor.** If the model infers a fact with no literal quote (free-text `reason` only), that clause can still end up looking "unplaced" too, alongside the inferred fact — redundant, not silent, so it's the safe failure direction, but you'll occasionally see a fact and a receipt for the same clause when the model made a judgement call rather than quoting your words. Deliberate, documented in the code, not fixed — closing it properly means changing how the model reports inferred spans, a bigger change than this gate's scope.
3. **Clause granularity is sentence-level only** (split on `.`/`!`/`?`). A single very long sentence carrying two unrelated requirements would still be treated as one clause; if the first requirement lands a fact, the second wouldn't trigger a separate bespoke/receipt unless it also has its own anchor-free content. Not observed in your two examples or the regression cases, flagged as a known boundary.

## Proposed compiler input contract (for when you approve Canvas Phase 1)

The gap you flagged — "the Living Canvas compiler must consume bespoke requirements and retained receipts, not only `WorkspaceFact[]`" — is real and is exactly what this gate's output now makes possible. Since `requirements.bespoke` is itself a `WorkspaceFact` path, bespoke requirements already flow through `facts` today; the piece that was genuinely missing is the **receipts**, which live in ProjectDesk's own `Receipt[]` state (`{id, text}`), separate from the fact ledger entirely.

Proposed shape, not yet built:

```ts
type ProcurementCompilerInput = {
  facts: WorkspaceFact[];              // the structured ledger -- includes requirements.bespoke
  receipts: Receipt[];                 // verbatim, unplaced -- the new half this gate surfaces
  requirement: SecurityRequirementInput;
  verdict: SecurityScopeVerdict;
  noted: NotedSelection[];             // existing multi-select "noted" slots
  rfiSet: RfiQuestionSet;
  instrument: InstrumentLadder;
  previousDocument?: LivingProcurementDocument;  // for diff/versioning
};
```

And on the output side, `ProcurementClause.origin` (currently `"buyer" | "netify" | "sector" | "buyer_override"` per the brief) should gain a fifth value, `"unplaced_receipt"`, so a compiled document can render "we saw this, we're not sure where it belongs, please review" distinctly from a confirmed clause — rather than either dropping receipts from the compiled document entirely (repeating today's bug one layer up) or silently promoting them to full clauses (inventing structure you never confirmed).

I haven't touched `procurement-document.ts` or any Canvas file — this is a proposal for you to react to when you're ready, not a start on Phase 1.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-13aug.bundle`. To review without touching your existing checkout:

```
cd ~/Downloads
git clone sdwan-reliability-gate-13aug.bundle review-reliability-gate
cd review-reliability-gate
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate
```

That pushes a new branch (not `main`) to GitHub, which should trigger a Vercel preview deployment you can test live, and gives you a real diff to review on GitHub — your existing dirty `main` checkout is never touched by any of this. Say the word when you want it merged, or if you'd rather I open a PR directly for review comments.
