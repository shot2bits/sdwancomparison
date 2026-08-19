# Fact Ledger Reliability Gate — Fourth Amendment, 13 August 2026

Commit `19d04af` was **amended in place again** (`git commit --amend`, not a new commit, per your instruction) — it is now `760f45b`, still the only commit on `fact-ledger-reliability-gate`, still on top of unmodified `origin/main` (`5e24698`). Nothing was pushed or merged. Canvas work was not started, as instructed.

Your verdict was that the third amendment's source-ledger *design* is architecturally sound and every automated gate passes, but the *implementation* was incomplete in three connected ways. All three trace to one root cause: the ledger you asked for in the third amendment was real in spirit but not yet real in the record — it lived in a React component's memory and got flattened to a string at save time. This round makes it what it was always meant to be: a canonical, structured, persisted field on the Project itself.

## Reproduced first, exactly as you reported

Before changing anything, I confirmed all three gaps against the committed `19d04af` (a throwaway clone, not part of the diff):

| Gap | Where | Confirmed |
|---|---|---|
| 1. Paste/drop truncation reaches the ledger | `ProjectDesk.tsx`'s `ingestText()` called `keepSourceTurn(chunk)` **inside** the per-chunk extraction loop, over `chunkForIngest()`'s already-capped output | `git show 19d04af:src/components/ProjectDesk.tsx` — line 1368, `keepSourceTurn(chunk)` inside the `for (const chunk of plan.chunks)` loop |
| 2. Re-scope never sends source turns | `refreshRecord()`'s security branch posted `{ manage_token, requirement, consent: true }` to `/rescope` — no source-turn field at all | `git show 19d04af:...` — line 1683-1692, confirmed no `source` key in the POST body |
| 3. Ledger is not durable/structured | `SourceTurn = { id: number; ... }`, numeric ref-counter reset to 0 on every load; flattened via `notesWithSourceTurns("", sourceTurns.map(t => t.text))` into `buyer.notes` at save time | `git show 19d04af:...` — lines 188, 750, 1618 |

## The fix, as built

**Item 3 first, because 1 and 2 build on it.** A new module, `src/lib/workspace/source-ledger.ts`, defines the one shape every write path now shares:

```
SourceLedgerEntry = { id: string, text: string, at: number, via: "typed"|"paste"|"drop" }
```

with two pure functions: `parseIncomingSourceTurns(raw)` (untrusted JSON → validated entries, best-effort per item — one malformed turn drops only itself, never the whole save) and `mergeSourceLedger(existing, incoming)` (append-only union by stable `id`; never reorders, edits or removes an existing entry). `ProjectDetails` gains a new top-level field, `source_ledger: SourceLedgerEntry[]`, sitting alongside `understanding` for the same reason: engine-independent canonical state, not gated by `engine_data`'s authorised-writer invariants, defaulting to `[]` so every pre-amendment record still validates. `buyer.notes` keeps its existing human-readable projection (`notesWithSourceTurns`, unchanged), but is never the canonical store again — exactly your instruction's wording.

Client-side, `SourceTurn`'s `id` is now a stable string generated once at capture time (`newSourceTurnId()`, mirroring `rfp-store.ts`'s own `newId()` pattern, duplicated client-side since that module is Node-only), sent unchanged on every subsequent save — this is what makes idempotent merging possible at all.

**Item 1.** `ingestText()`'s source-turn capture moved from inside the per-chunk loop to a single call with the complete raw entry, before `chunkForIngest()` runs:

```ts
keepSourceTurn(String(raw ?? "").replace(/\r\n/g, "\n").trim(), source);
for (const chunk of plan.chunks) {
  const r = await runCycle(chunk);
  for (const clause of r.unplaced) keepReceipt(clause);
}
```

`chunkForIngest()` itself is untouched — its 3,500-char × 3-chunk budget is a real, disclosed limit on what *extraction* reads, and stays exactly that. The ledger no longer inherits it.

**Item 2, the fix your report centred on.** The structured ledger is now threaded through every save/create/re-scope/publish-refresh path:

- `ProjectDesk.tsx` — a new `sourceTurnsPayload()` helper feeds `rfpPayload()` (wizard path), `createRecord()`'s security branch, and — the actual gap — `refreshRecord()`'s security branch, which now sends `source_turns: sourceTurnsPayload()` on every POST to `/rescope`. This is the one function `saveNow()` (every Save after the first) and `signAndPublish()` (the pre-publish refresh) both call.
- `src/lib/security/create-project.ts` — `CreateSecurityProjectInput.sourceNotes?: string[]` replaced with `sourceTurns?: SourceLedgerEntry[]`; `buildSecurityProject()` builds `source_ledger` via `mergeSourceLedger([], input.sourceTurns ?? [])` and derives the `buyer.notes` projection from that same merged ledger, so the two can never drift apart at creation.
- `src/lib/security/rescope-project.ts` — `RescopeInput` gains `sourceTurns?: SourceLedgerEntry[]`; `buildRescopedProject()` sets `source_ledger: mergeSourceLedger(project.source_ledger ?? [], input.sourceTurns ?? [])` in its existing accretion spread, following the exact `understanding`-field precedent (omitted/empty is a no-op, so the untouched `rescope_security_project` MCP tool can never wipe the ledger).
- Both security-sourcing API routes (`project/route.ts`, `project/[id]/rescope/route.ts`) now parse `source_turns` from the request body via `parseIncomingSourceTurns` and pass it through.
- The wizard's `POST /api/rfp` route merges an initial ledger the same way `create-project.ts` does.
- The wizard's `PUT /api/rfp/[id]` route — the pre-publish refresh path for non-security projects — is the one place this needed care: that handler does a **blind spread merge** of the request body onto the existing project. `source_turns` is extracted and `delete`d from `body` *before* that spread (mirroring the existing `regenerate` extraction pattern already in the file), then merged explicitly: `merged.source_ledger = mergeSourceLedger(existing.source_ledger ?? [], parseIncomingSourceTurns(rawSourceTurns))`. Left to the blind spread, it would have either been silently dropped (wrong field name) or overwritten instead of merged.
- `executePublish()` (`rfp-publish.ts`) needed no changes: read in full this round, every branch builds its saved object as `{ ...working, ... }` — a plain spread of the project it was handed, which by then already carries the refreshed `source_ledger`. No branch constructs a fresh object that could drop the field.

**Item 4, rehydration on reopen.** `ProjectDesk.tsx` has no "reopen an existing project and resume" capability at all today — confirmed by an explicit, pre-existing in-code comment: *"R2: nothing is restored. The twin starts empty every time except for what the link itself carries."* That is a separate, deliberate, prior design decision, not something this ticket should silently overturn. I built the honest, proportionate piece: a pure `hydrateSourceTurns(ledger)` function and an optional `initialSourceLedger` prop on `ProjectDesk`, both wired and ready — but no current caller passes real data, because building a full authenticated resume-by-id flow (restoring facts, receipts and notes too, not just source turns) is a materially larger, separate initiative outside this ticket's scope. Flagging this rather than quietly deciding it for you.

**A related, smaller design call.** `buyer.notes` does not get re-synced on every subsequent save. Your own instruction downgrades it explicitly ("may remain a human-readable projection, but must not be the canonical ledger"), so `source_ledger` alone is the continuously-updated canonical store; `buyer.notes` stays a creation-time snapshot, consistent with how every other buyer field already behaves under the existing "accretes, never rewrites buyer" design in `rescope-project.ts`. Recomputing `buyer.notes` on every rescope was the more complex option and risked subtle bugs for no durability benefit — durability comes entirely from `source_ledger` now.

## Fixtures — all five you named

Added directly to `scripts/verify-fact-ledger-reliability-gate.ts` (wired into `npm run validate` / the build gate, same as every prior round), exercised through the real persistence-core functions (`buildSecurityProject`, `buildRescopedProject`, `chunkForIngest`, `parseIncomingSourceTurns`, `mergeSourceLedger`) — not reimplementations:

| Fixture | Result |
|---|---|
| A paste past `maxChunks` (15,239 chars, cap is 10,500) survives completely and exactly in `source_ledger`, even though `chunkForIngest()` still honestly truncates extraction | PASS — entry length 15,239 == input length; extraction read only 10,284 |
| Wording added after the first save (turn B) survives a second save, via `buildRescopedProject()` — the exact function the re-scope route's core calls | PASS — both turns present after the second save |
| Wording added just before publish (turn C) survives the refresh call `signAndPublish()` makes | PASS — all three turns present in the project publish would receive; publish itself proven by code inspection to spread, never reconstruct, the project |
| Newlines, a pipe character, and leading/trailing whitespace round-trip as one entry, untouched | PASS — output byte-identical to input through `parseIncomingSourceTurns` and `mergeSourceLedger` |
| Repeated saves (same batch, same ids, twice) never duplicate a turn | PASS — entry count unchanged, turn A appears exactly once |

The round-4 fixture that exercised `buildSecurityProject`'s `sourceNotes` parameter was updated for the renamed/restructured input (`sourceTurns`, not a bare string array) and extended with a new assertion that `source_ledger` itself — not just the `buyer.notes` projection — carries the structured entry.

## What did not change

Every already-passing extraction, sector, complete-clause and no-invented-bespoke fixture from rounds 1–4 re-ran unchanged and still passes — `coverDeclarativeClauses`, `splitDeclarativeClauseSpans`, the sector compound-phrase handling, the bespoke-clause length fixtures, all untouched by this round.

## Full verification, this round

```
tsc --noEmit                                    clean
verify-fact-ledger-reliability-gate.ts          ALL PASS (10 new/updated round-5 assertions,
                                                  every round 1-4 fixture unchanged and passing)
verify-correction-pass-2.ts                      ALL PASS (unaffected)
npm run validate (includes both scripts above)   ALL PASS, exit 0
next build --webpack                             Compiled successfully
```

Fixture-first reproduction against the pre-amendment `19d04af` (throwaway clone, deleted afterward) confirmed all three gaps exactly as you described, before anything was changed — see the table above.

Additionally: cloned the regenerated bundle into a clean directory, ran `npm install`, `tsc --noEmit`, and `npm run validate` there from scratch — same clean result, proving the amended commit is self-contained and not relying on anything left in this sandbox's working tree.

The `next build` run needed the same sandbox-only workaround as every prior round (no route to `fonts.googleapis.com` in this container): temporarily stubbed the font import, ran the build, confirmed success, reverted immediately — `git diff` against `src/app/layout.tsx` shows zero changes; it was never part of the amended commit.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`760f45b`, amended from `19d04af`, itself amended from `8612832`, `1ef8bc6`, `c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-round5-13aug.bundle`:

```
cd ~/Downloads
git clone -b fact-ledger-reliability-gate sdwan-reliability-gate-round5-13aug.bundle review-reliability-gate-round5
cd review-reliability-gate-round5
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate --force
```

`--force` is needed because the commit hash changed under the amend — your existing dirty `main` checkout is still never touched by any of this. Say the word when you want it merged.

Canvas work was not started, as instructed. Stopping here.
