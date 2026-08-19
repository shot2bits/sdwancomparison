# Fact Ledger Reliability Gate — Eighth Amendment, 13 August 2026

Commit `0faab6f` was **amended in place again** (`git commit --amend`, not a new commit, per your instruction) — it is now `c08cc53`, still the only commit on `fact-ledger-reliability-gate`, still directly on top of unmodified `origin/main` (`5e24698`). Nothing was pushed or merged. Canvas work was not started.

The tombstone architecture itself stood. Three implementation defects in it did not: `removalsIn()` only ever looked at each vocabulary term's first occurrence, so an earlier positive mention could block a later, genuine retraction from ever being seen; two of the retraction aliases were ambiguous enough to remove the wrong structured fact; and the drop/remove command's own live-fact branch struck a session fact without ever tombstoning the matching value in the persisted base, so a value present in both places came straight back on the next save. All three fixed below, and the Azure command fixture that only proved the merge arithmetic — never the handler that is supposed to produce it — has been replaced with one that drives the real matching function.

## Reproduced first

Before changing anything, I ran each of your three examples against the pre-fix code: `removalsIn("We use MPLS today, but we no longer use MPLS.")` returned `[]` (the first "MPLS" failed the retraction window and nothing ever looked at the second); `removalsIn("We no longer use Microsoft Defender.")` returned an `estate.cloud:m365` removal (bare "Microsoft" was an alias for Microsoft 365); and a resumed session that restated Azure this sitting, then typed "drop Azure", struck the live Azure fact but left the base's own Azure value un-tombstoned, so the very next merge brought it back.

## 1. Every occurrence is inspected, not only the first

`removalsIn()` now runs each vocabulary pattern as a global regex and walks every match left to right, stopping at the first occurrence that both sits inside a retraction window and isn't an adjectival modifier (item 2 below) of a different noun. "We use MPLS today, but we no longer use MPLS." now correctly removes MPLS: the first, unrelated positive mention no longer blocks the second, genuine retraction from being found.

## 2. Unambiguous aliases only

Two fixes, one principle: retraction requires an unambiguous value reference, because retracting is the stronger, more consequential action.

- **Microsoft 365** no longer matches bare "Microsoft" — only "Microsoft 365", "M365", "Office 365" or "O365" now qualify. "We no longer use Microsoft Defender" produces no removal at all; "We no longer use Microsoft 365" still removes it correctly.
- Every vocabulary entry gained a new, general guard: a matched term functioning as a compound **adjective** describing a different noun ("UK-**based** SOC coverage", "US-**based** support team") is not itself the retraction target — the object of "no longer use" there is "SOC coverage", not the UK region. The guard checks for `-based`/`-only`/`-hosted`/`-specific`/`-focused`/`-native`/`-first`/`-centric` (hyphenated or spaced) immediately after any matched term, not only region names, since the identical ambiguity can occur with any short token ("MPLS-based failover"). "We no longer use UK-based SOC coverage" now removes nothing.

## 3. Ambiguous text produces no tombstone — and stays visible

Both fixes above simply produce no `FieldRemoval`. Nothing new had to be built to keep the buyer's wording visible: `coverDeclarativeClauses()` (unchanged since the third amendment) only ever treats a clause as "explained" by an accepted `FieldUpdate`, never by a `FieldRemoval` — so a clause with neither an update nor an accepted removal was already, by the existing binary rule, an unplaced clause. "We no longer use Microsoft Defender." and "We no longer use UK-based SOC coverage." both now surface as visible unplaced receipts, proven directly against the real `coverDeclarativeClauses()`, not asserted.

## 4/5/6. One strike-and-tombstone primitive, exercised through real matching

Three related fixes, one mechanism:

- `draft.ts` gains `dropListFact(facts, removals, fact)`: a pure function that strikes exactly one live fact **and** tombstones its `factId` into the removals set, in one call. `dropFact()` (ProjectDesk.tsx) now calls it, so the row button (`dropRow` → `dropFact` → `dropListFact`) and the typed drop/remove command's live-fact match both go through the identical operation — a value restated this session and then dropped is removed from the live ledger and the persisted base at the same time, closing the gap you found.
- `draft.ts` also gains `resolveDropTarget(target, opts)`: the same target-matching the typed command uses (live facts, then held notes, then kept receipts, then — last — a value that lives only in the resumed base), extracted as a pure function so a fixture can drive the real decision logic directly instead of hand-constructing a `FieldRemoval`. `ProjectDesk.tsx`'s `handleCommand` now calls this function instead of carrying its own inline copy of the matching logic.
- The route-level fixture that previously bypassed all of this — building an `estate.cloud:azure` `FieldRemoval` by hand and calling `mergeRequirementBase()` alone — is gone. The new fixture simulates a session that restated Azure (a live fact exists), calls `resolveDropTarget("Azure", …)` and asserts it matches the live fact (not the resumed-base fallback the old fixture only ever reached), applies `dropListFact`, and proves the row-button path (`dropListFact` on the identical fact) produces byte-identical output.

## Fixtures — the real functions, through the real routes

New Round 9 fixtures in `verify-fact-ledger-reliability-gate.ts` (hermetic, wired into `npm run validate`):

| Step | What it proves |
|---|---|
| `removalsIn("We use MPLS today, but we no longer use MPLS.")` | Item 1: the later, genuine retraction is found despite the earlier positive mention |
| `removalsIn("We no longer use Microsoft Defender.")` / `removalsIn("We no longer use Microsoft 365.")` | Item 2: bare "Microsoft" no longer removes m365; the unambiguous full name still does |
| `removalsIn("We no longer use UK-based SOC coverage.")` | Item 2: a region name modifying a different noun is not itself removed |
| `coverDeclarativeClauses()` on both ambiguous sentences | Item 3: no tombstone, and the complete original wording survives as a visible unplaced clause |
| Create requirement E (Azure, AWS, Microsoft 365, MPLS, VPN, UK) → resume → simulate a restated Azure fact → `resolveDropTarget("Azure", …)` → `dropListFact` → save through the real re-scope route → reload | Items 4/5/6/7: the command finds the live fact first, strikes it and tombstones the base in one operation, and the save/reload round trip shows Azure gone from both places while AWS/Microsoft 365/MPLS/UK (untouched) all survive |
| Row-button equivalence: `dropListFact` called directly on the same fact | Item 5: byte-identical result to the command path |
| A second resumed sitting, combined text ("We use MPLS today, but we no longer use MPLS. We no longer use Microsoft Defender. We no longer use UK-based SOC coverage.") → real `removalsIn()` → real merge → save → reload | Item 7: exactly one removal (MPLS) is produced and persisted; Microsoft 365 and the UK region, never genuinely retracted, both survive the round trip; the buyer's exact combined wording — including the two ambiguous mentions — survives verbatim in `source_ledger` |

All pass. Every round 1–8 fixture re-ran unchanged and still passes.

## Full verification, this round

```
tsc --noEmit                                    clean
verify-fact-ledger-reliability-gate.ts          ALL PASS (Round 9's new assertions,
                                                  every round 1-8 fixture unchanged and passing)
npm run validate                                ALL PASS, exit 0
next build --webpack                            Compiled successfully
```

The `next build` run needed the same sandbox-only font-fetch workaround as every prior round — temporarily stubbed, confirmed success, reverted immediately (`git diff` on `src/app/layout.tsx` shows zero changes; it was never part of the amended commit).

Bundled the amended commit, cloned it into a clean directory, ran `npm install`, `tsc --noEmit` and `npm run validate` there from scratch — same clean result, confirming the amended commit is self-contained.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`c08cc53`, amended from `0faab6f`, itself amended from `94a5097`, `206cf3e`, `760f45b`, `19d04af`, `8612832`, `1ef8bc6`, `c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-round9-13aug.bundle`:

```
cd ~/Downloads
git clone -b fact-ledger-reliability-gate sdwan-reliability-gate-round9-13aug.bundle review-reliability-gate-round9
cd review-reliability-gate-round9
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate --force
```

`--force` is needed because the commit hash changed under the amend. Say the word when you want it merged.

Canvas work was not started, as instructed. Stopping here.
