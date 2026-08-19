# Fact Ledger Reliability Gate — Sixth Amendment, 13 August 2026

Commit `206cf3e` was **amended in place again** (`git commit --amend`, not a new commit, per your instruction) — it is now `94a5097`, still the only commit on `fact-ledger-reliability-gate`, still directly on top of unmodified `origin/main` (`5e24698`). Nothing was pushed or merged. Canvas work was not started.

You found a real, unreproduced data-loss bug in the fifth amendment's "Minimal resume link": `facts` stays empty on resume, so `requirementFrom(facts)` after reopening reflects only what the resumed session itself typed, and re-scope replaces the project's whole `engine_data.requirement` with that partial state. You also found two related gaps: the UI could act before the async resume finished, and the "Add more detail" link excluded a signed-in owner with no manage token. Everything is fixed below.

## Reproduced first

Before changing anything, I confirmed the bug with a throwaway script (not part of the diff): created a project with a rich requirement (sector, estate, drivers, compliance, SOC capacity, budget, timeline), then resumed and saved sending only a second, independently detailed but *different* requirement — exactly what the old code would have sent, since it never merged the resumed session's facts with anything from before. The save succeeded (the new facts alone cleared the confidence gate), and the reloaded project's `engine_data.requirement` was the new session's data only — sector, sites, compliance, budget and timeline from the original scoping conversation were gone. Confirmed byte-for-byte, exactly the failure mode you described.

## 1 & 2. Resume now preserves the existing requirement, correctly merged

The root problem: `source_ledger` was rehydrated on resume, but `facts` (the client's own per-message ledger, with quote/reason/provenance) never was — and there's no way to reconstruct it faithfully, because `engine_data.requirement` (what's actually persisted) is a flattened `SecurityRequirementInput`, not a fact ledger. It never carried per-field provenance in the first place.

Rather than fabricate fake `WorkspaceFact`s with invented quotes, `draft.ts` gets a new pure function:

```ts
export function mergeRequirementBase(
  base: SecurityRequirementInput | null | undefined,
  addition: SecurityRequirementInput,
): SecurityRequirementInput
```

`base` is the resumed project's fetched requirement, kept immutable for the whole session. `addition` is `requirementFrom(facts)` — whatever this session's own messages derive. The merge rule: a scalar the resumed session states wins (a genuine correction — the same "new value replaces old" rule `mergeUpdates` already applies within one session); every list field accretes (unions with the base, never drops what was already there). When `base` is null (every non-resumed session, the overwhelming majority), this is byte-identical to `addition` alone — nothing changes for the common case.

This is now the **one** `requirement` value the whole component reads — the verdict assessment, the brief, the extraction-context POST, and every create/save/publish payload all close over the same variable, so fixing it once fixes all of them:

```ts
const requirement = useMemo(
  () => mergeRequirementBase(resumeRequirementBase, requirementFrom(facts)),
  [facts, resumeRequirementBase],
);
```

`source-ledger.ts` gets a matching function, `resumeStateFromProject()`, which is the **one** place that decides what a resume restores from a fetched project — source ledger and requirement base together, scoped to Security Sourcing only. `ProjectDesk.tsx`'s resume effect calls this exact function; so does the new fixture, per your item 5.

## 3. Resume no longer races the UI

The resume fetch used to be fire-and-forget. A new `resuming` state is set true the instant resume is attempted, and stays true until the fetch has **either succeeded or visibly failed** — every exit path now calls `say()` to explain what happened, never a silent return. While `resuming` is true: the composer is disabled (with a "Loading your saved project…" placeholder), `sendReady` is false, `signLocked` is true (with a matching `lockLine`), and `saveNow()`/`send()` both carry their own non-UI guard too, since Enter-to-send calls `send()` directly and bypasses the button's `disabled` attribute entirely.

As a second, independent defense against the same race: the source-ledger hydration now **merges** rather than replaces —

```ts
setSourceTurns((current) => mergeSourceLedger(resumeState.sourceLedger, current));
```

— so even in a race the UI gate should already prevent, a turn captured locally during the fetch's own async gap can never be discarded.

## 4. Signed-in owners can resume without a manage token

The server never actually required one: `requireRfpOwner()` already falls back to a session-authorised owner (matching `owner_email`) when no token is present, the same as every other RFP route. Only the client was too narrow — `project/[id]/page.tsx`'s "Add more detail" link required `tokenOk` specifically, even though the page's own access gate two lines above already accepts `tokenOk || sessionOwner`. Fixed: the link now uses the same `tokenOk || sessionOwner` gate, and only appends `?manage=` when a real token is actually held; a session-only visitor's link omits it, and the resume fetch authenticates by the same-origin session cookie instead (browsers send it automatically; no client change needed there).

## Fixtures — mirroring production, not a manually supplied requirement

Your diagnosis of why the fifth amendment's own fixtures missed this: *"every resumed-save fixture sends FULL_REQ manually. That is not what ProjectDesk does after reopening."* Correct — and the fifth amendment's fixture that fed `hydrateSourceTurns()`'s output back into a save alongside a constant `FULL_REQ` is **removed outright**, not kept alongside the fix; it could not have caught this bug by construction.

New Round 7 fixtures in `verify-fact-ledger-reliability-gate.ts` (hermetic, wired into `npm run validate`):

| Step | What it proves |
|---|---|
| Create with requirement A through the real route | Baseline: a rich, real requirement is persisted |
| Reload through the real `GET /api/rfp/[id]` route | The same fetch ProjectDesk's resume effect makes |
| `resumeStateFromProject()` — the real helper — recovers requirement A verbatim | Item 5: the exact function ProjectDesk calls, not a stand-in |
| `mergeRequirementBase()` — the real function — merges in one new detail (a compliance requirement) | Item 7: never a manually supplied `FULL_REQ` |
| Save through the real re-scope route with the real merged requirement | The resumed-save path, exercised honestly |
| Reload and assert every field from A survives, the new detail is added, source ids are unique | The exact scenario that silently lost data before this amendment — now proven fixed |
| A dedicated race fixture: `mergeSourceLedger(fetched, locallyTyped)` | Item 6: a turn typed during the resume gap is never discarded |
| `mergeRequirementBase(null, addition)` equals `addition` | Baseline safety: the non-resumed case is untouched |

All pass. Every round 1–6 fixture re-ran unchanged and still passes.

## Full verification, this round

```
tsc --noEmit                                    clean
verify-fact-ledger-reliability-gate.ts          ALL PASS (Round 7's new assertions,
                                                  every round 1-6 fixture unchanged and passing)
npm run validate                                ALL PASS, exit 0
next build --webpack                            Compiled successfully
```

The `next build` run needed the same sandbox-only font-fetch workaround as every prior round — temporarily stubbed, confirmed success, reverted immediately (`git diff` on `src/app/layout.tsx` shows zero changes; it was never part of the amended commit).

Bundled the amended commit, cloned it into a clean directory, ran `npm install`, `tsc --noEmit` and `npm run validate` there from scratch — same clean result, confirming the amended commit is self-contained.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`94a5097`, amended from `206cf3e`, itself amended from `760f45b`, `19d04af`, `8612832`, `1ef8bc6`, `c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-round7-13aug.bundle`:

```
cd ~/Downloads
git clone -b fact-ledger-reliability-gate sdwan-reliability-gate-round7-13aug.bundle review-reliability-gate-round7
cd review-reliability-gate-round7
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate --force
```

`--force` is needed because the commit hash changed under the amend. Say the word when you want it merged.

Canvas work was not started, as instructed. Stopping here.
