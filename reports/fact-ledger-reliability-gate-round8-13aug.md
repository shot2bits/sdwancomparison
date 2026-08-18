# Fact Ledger Reliability Gate — Seventh Amendment, 13 August 2026

Commit `94a5097` was **amended in place again** (`git commit --amend`, not a new commit, per your instruction) — it is now `0faab6f`, still the only commit on `fact-ledger-reliability-gate`, still directly on top of unmodified `origin/main` (`5e24698`). Nothing was pushed or merged. Canvas work was not started.

You held the round-seven fix — resume no longer starts from an empty requirement, the async race is closed, session-only owners work — but found the one flaw that remained: `mergeRequirementBase()` only ever **unions** the resumed base's list fields with whatever this session adds. A buyer can say "we no longer use MPLS; we now use SD-WAN" and the extractor correctly avoids adding the negated MPLS back as a new fact, but nothing ever told the merge to actually take the base's own pre-existing MPLS value off the record. The immutable source ledger holds the correction; the structured requirement kept insisting the opposite. Fixed below.

## Reproduced first

Before changing anything, I ran the exact scenario against the pre-fix code (a throwaway script, not part of the diff): a resumed project whose base held `existingNetwork: ["mpls", "vpn"]`, then a save carrying the merge of that base with `requirementFrom(facts)` for a session that had typed "We no longer use MPLS; we now use SD-WAN." The deterministic extractor correctly produced no `mpls` fact from that text (the negation window already guaranteed that), so nothing in the old two-argument `mergeRequirementBase(base, addition)` had any way to know MPLS should leave — the union simply carried it straight through from `base`, unchanged, byte for byte.

## 1. A new, separate channel for explicit retraction — never a positive fact

`extract.ts` gains `FieldRemoval` and a dedicated deterministic pass, `removalsIn(text)`, that recognises when a known list-vocabulary term (a network technology, a cloud platform, a compliance standard, a driver, a region) sits inside a **retraction** window — "no longer use", "stopped using", "removed", "decommissioned", "don't use ... any more" — deliberately narrower than the extractor's existing negation window (which also treats "except"/"instead of"/"rather than" as reasons *not to add* something, but those don't on their own mean the buyer is taking something off the record). `removalsIn()` never writes into `updates` — its output is a completely separate channel, so item 3's rule ("a negated phrase must never itself become a positive fact") holds structurally, not just by convention. `extractRequirement()` now returns `removals` alongside `updates`, and the extract API route already spreads the whole result, so no route change was needed.

## 2 & 5. The effective requirement: base minus removals, plus additions

`mergeRequirementBase()` gains a third, optional argument: a set of tombstoned `factId`s (the same `path:value` identity draft.ts already uses for fact identity). Before it unions a list field, it now strips any tombstoned value **out of the base only** — never out of `addition`. That ordering is deliberate and does two things at once:

- "we no longer use MPLS; we now use SD-WAN" removes MPLS from the base and leaves everything else (VPN, Azure, ISO 27001, whatever else the base held) untouched.
- if the **same session**, later in the same sitting, restates MPLS in words, it arrives through `addition` and the union brings it straight back — resurrection, mirroring the rule a struck `WorkspaceFact` already follows (a buyer's own later words always win).

The formula is exactly item 5's: `(base − removals) ∪ addition`, field by field, for every list path you named (regions, cloud, existing security, existing networks, drivers, compliance requirements). `removals` defaults to an empty set, so every existing two-argument call site is untouched and behaves exactly as it did before this amendment.

## 3. A negated phrase never becomes a positive fact

Unchanged, and re-proven: the extractor's existing negation window already refused to add MPLS as a positive `estate.existingNetwork` fact from "no longer use MPLS" (round 1's own design). `removalsIn()` is additive and structurally separate — it cannot produce a `FieldUpdate`, only a `FieldRemoval` — so this holds by construction, not by coincidence.

## 4. Omission preserves the base

A resumed message that simply never mentions an existing value produces no removal signal for it at all, so the tombstone set stays empty for that value and the base passes through the union completely untouched — proven directly (Round 8 fixture 9 below) and as a natural consequence of "only an explicit removal is ever tombstoned."

## The drop/remove command reaches the persisted base too

`ProjectDesk.tsx`'s existing `drop X`/`remove X` command already searched this session's own facts, noted items and receipts, in that order, before giving up. It now has one more fallback, tried last: if `X` matches a value that lives **only** in the resumed base (never extracted into this session's own ledger at all — the exact situation "remove Azure" hits the instant a project is reopened with nothing yet retyped), it is matched against the same display labels the page already shows and fed into the identical `FieldRemoval` shape the text-based path uses. "Drop Azure" removes exactly Azure and leaves every other cloud platform untouched.

Two-part application, always both: a matching **live fact** from this session (if one exists) is struck, the same way clicking "drop" on a row already works; and the value's `factId` is tombstoned regardless, which only ever has any effect when a resumed base is set — harmless for the ordinary non-resumed session.

## Fixtures — the real functions, through the real routes

New Round 8 fixtures in `verify-fact-ledger-reliability-gate.ts` (hermetic, wired into `npm run validate`):

| Step | What it proves |
|---|---|
| Create requirement C (MPLS, VPN, Azure, AWS, ISO 27001) through the real route | Baseline: a rich, real requirement is persisted |
| Reload, then `resumeStateFromProject()` — the real helper | The exact function ProjectDesk's resume effect calls |
| `removalsIn("We no longer use MPLS; we now use SD-WAN.")` — the real function | Flags exactly MPLS, never SD-WAN; `deterministicExtract()` on the same text never proposes mpls as a positive update either |
| `mergeRequirementBase(base, {pci_dss addition}, removalIds)` — the real function, then save through the real re-scope route | Item 6: adding PCI DSS while retracting MPLS, composed correctly in one save |
| Reload and assert: MPLS gone, VPN/Azure/ISO 27001 (untouched) still present, PCI DSS added | Items 1/2/4/6 together — exactly the scenario that silently kept the opposite value before this amendment |
| `source_ledger` after the save | The correction wording ("We no longer use MPLS; we now use SD-WAN.") survives verbatim |
| `mergeRequirementBase(base, {}, {azure removal})` | Item 3: dropping Azure removes exactly Azure, AWS untouched — the command path's own mechanism |
| `mergeRequirementBase(base, {}, new Set())` | Item 4: omitting an item (no removal signal) preserves the base exactly |
| `mergeRequirementBase(base, {mpls restated}, removalIds)` | Resurrection: a value removed this sitting still returns if the same session restates it |

All pass. Every round 1–7 fixture re-ran unchanged and still passes.

## Full verification, this round

```
tsc --noEmit                                    clean
verify-fact-ledger-reliability-gate.ts          ALL PASS (Round 8's new assertions,
                                                  every round 1-7 fixture unchanged and passing)
npm run validate                                ALL PASS, exit 0
next build --webpack                            Compiled successfully
```

The `next build` run needed the same sandbox-only font-fetch workaround as every prior round — temporarily stubbed, confirmed success, reverted immediately (`git diff` on `src/app/layout.tsx` shows zero changes; it was never part of the amended commit).

Bundled the amended commit, cloned it into a clean directory, ran `npm install`, `tsc --noEmit` and `npm run validate` there from scratch — same clean result, confirming the amended commit is self-contained.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`0faab6f`, amended from `94a5097`, itself amended from `206cf3e`, `760f45b`, `19d04af`, `8612832`, `1ef8bc6`, `c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-round8-13aug.bundle`:

```
cd ~/Downloads
git clone -b fact-ledger-reliability-gate sdwan-reliability-gate-round8-13aug.bundle review-reliability-gate-round8
cd review-reliability-gate-round8
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate --force
```

`--force` is needed because the commit hash changed under the amend. Say the word when you want it merged.

Canvas work was not started, as instructed. Stopping here.
