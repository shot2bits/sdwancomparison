# Fact Ledger Reliability Gate — Fifth Amendment, 13 August 2026

Commit `760f45b` was **amended in place again** (`git commit --amend`, not a new commit, per your instruction) — it is now `206cf3e`, still the only commit on `fact-ledger-reliability-gate`, still directly on top of unmodified `origin/main` (`5e24698`). Nothing was pushed or merged. Canvas work was not started.

Your review found the fourth amendment's persistence architecture correct but two of its own acceptance requirements still incomplete, plus a real verification gap. All three are fixed below, in the order you raised them.

## 1. Paste/drop is now retained exactly

`ingestText()` was still running the buyer's raw entry through `.replace(/\r\n/g, "\n").trim()` — the exact normalisation `chunkForIngest()` applies to its own extraction copy — before keeping it. That silently rewrote CRLF line endings and dropped leading/trailing content from what the ledger remembered.

Fixed with a new, exported, testable helper in `source-ledger.ts`:

```ts
export function captureRawSourceEntry(raw: unknown): string {
  return String(raw ?? "");
}
```

Identity on content — no trim, no CRLF rewrite, only the same defensive `null`/`undefined` coercion `chunkForIngest()` itself already does. `ingestText()` now calls it directly:

```ts
keepSourceTurn(captureRawSourceEntry(raw), source);
```

`chunkForIngest(raw)` is unchanged and still receives the same untouched raw string separately — it derives its own normalised copy internally, for extraction only. The two copies are independent from that point on.

This is exported and called directly by `ProjectDesk.tsx` — not duplicated inline — specifically so a fixture can exercise the real capture path. That's the precise gap in the fourth amendment's own fixture: it applied the identical normalisation itself before calling `buildSecurityProject()`, so it never touched the real UI capture path at all, and the bug hid behind it.

## 2. Rehydration is now implemented — the "Minimal resume link"

`initialSourceLedger` was an unused optional prop; neither real `ProjectDesk` caller supplied it, and there was no existing "reopen an existing project" journey anywhere in the app (`/workspace`, `/home`, `/project/[id]`, `/rfp-builder/[id]` — traced every caller, confirmed none renders `ProjectDesk` with any project-identifying data). Building real rehydration meant designing a new entry point, so I stopped and asked which shape you wanted rather than guess. You chose the **minimal resume link**.

Built as specified:

- `ProjectDesk.tsx`'s arrival effect now reads `?id=` and `?manage=` from the URL — the same convention every other owner-gated link in this app already uses. If present, it fetches the project through the existing generic `GET /api/rfp/[id]?manage=...` route (no new route needed), and — only for a Security Sourcing project — hydrates `sourceTurns` from the persisted `source_ledger` and marks the session as already-saved under that id/manage, so the next Save or Publish updates the same project instead of minting a new one.
- `hydrateSourceTurns()` itself moved out of `ProjectDesk.tsx` (where it was built in the fourth amendment but genuinely unwired, and unexported/untestable) into `source-ledger.ts`, exported, for the same reason `captureRawSourceEntry` lives there: so a fixture calls the real function, not a hand-rolled stand-in. `ProjectDesk.tsx`'s local `SourceTurn` type is now a plain alias for `SourceLedgerEntry` — the two shapes were already field-for-field identical.
- One real entry point now exists: `/project/[id]`'s dashboard page gained an **"Add more detail"** link (owner-gated by the same `tokenOk` check every other link on that page already uses, visible only while the project is still editable), pointing to `/workspace/?id={id}&manage={manage}`.

Deliberately narrow, as instructed if I couldn't do the full thing without approval — and flagged rather than smoothed over: **facts, receipts and the requirement sheet are not restored, only `source_ledger`.** A Save immediately after resuming, with nothing newly typed, sends an empty `requirement` to the re-scope route — the route's own existing confidence gate refuses that the same way it refuses any under-described requirement (a loud, clear error, never a silent overwrite of the project's real data). That's the honest consequence of rehydrating the ledger without also rehydrating the requirement this round, not a bug.

## 3. The verification gap — real routes, not persistence-core functions

Every prior round's fixtures called `buildSecurityProject()` / `buildRescopedProject()` directly. That's real code, but it skips request parsing, auth, and everything else the actual HTTP path does — exactly your critique.

Built `scripts/fake-kv-harness.ts`: a from-scratch, in-memory emulator of Upstash Redis's REST command convention (the same `POST {url} → ["CMD", ...args] → {result}` shape `rfp-store.ts` speaks), installed over `global.fetch` for the duration of a test. This lets the **real, unmodified Next.js route handler functions** — dynamically imported after the fake KV env vars are set, since `rfp-store.ts` captures `KV_REST_API_URL`/`TOKEN` once at import time — run in-process, end to end, against nothing but memory.

New route-level fixtures in `verify-fact-ledger-reliability-gate.ts` (wired into `npm run validate`, fully hermetic, no real network), all against the real `POST /security-sourcing/project`, `POST .../rescope`, and `GET /api/rfp/[id]` route handlers:

| Scenario | Result |
|---|---|
| Initial create persists a source turn | PASS |
| A later save, through the real re-scope route | PASS |
| Pre-publish refresh (the same rescope call `signAndPublish()` makes) | PASS |
| Reload/reopen returns every turn persisted so far | PASS |
| Reload/reopen followed by another real save | PASS |
| Reopening and saving again with an already-persisted id never duplicates it | PASS |
| A raw paste with CRLF, leading/trailing spaces, blank lines and a pipe survives `captureRawSourceEntry()` → the real create route → persistence → a real reload, byte-for-byte | PASS |
| The relocated `hydrateSourceTurns()` faithfully reshapes a real, freshly-reloaded ledger, and feeding its output straight back into a real Save adds zero duplicates (the exact resume-then-save sequence `ProjectDesk.tsx` now performs) | PASS |

**Publish** is the one scenario that couldn't join the hermetic gate honestly: `executePublish()` always calls real business-email verification — real DNS MX lookup, real HTTPS reachability check. I tried mocking `node:dns/promises`'s `resolveMx`; confirmed empirically that reassigning it on the imported namespace object is a silent no-op under Node's ESM live-binding rules (the mock "succeeds," a real DNS call still runs). A proper fix needs a Node loader hook — version-sensitive, fragile test machinery, the same category of thing this codebase's hermetic-model-mocking already argues against.

So publish coverage lives in a **separate, new, deliberately NOT-build-gate script**, `scripts/verify-publish-route-live-demo.ts` — same fake-KV harness, `passThroughOtherHosts: true` so only that one real network call reaches the internet, using `netify.co.uk` (your own domain, same precedent as the 11 Aug bounce-webhook round) as the publishing email's domain. It creates, saves again, mints a real session, publishes through the real route, and reloads — confirming `status: "published"` and both source turns present in the final record. Run by hand (`npx tsx scripts/verify-publish-route-live-demo.ts`), never in CI, documented at the top of the file with the reasoning above.

## What did not change

Every round 1–5 fixture re-ran unchanged and still passes: the canonical `ProjectDetails.source_ledger` field, stable string ids, idempotent `mergeSourceLedger`, initial-creation and re-scope threading, wizard POST/PUT threading, and every extraction/sector/clause fixture from rounds 1–4.

## Full verification, this round

```
tsc --noEmit                                    clean
verify-fact-ledger-reliability-gate.ts          ALL PASS (8 new route-level round-6 assertions,
                                                  every round 1-5 fixture unchanged and passing)
verify-publish-route-live-demo.ts               ALL PASS (real DNS/HTTPS to netify.co.uk;
                                                  standalone, not part of validate/build)
npm run validate                                ALL PASS, exit 0
next build --webpack                            Compiled successfully
```

The `next build` run needed the same sandbox-only workaround as every prior round (no route to `fonts.googleapis.com` in this container): temporarily stubbed the font import, ran the build, confirmed success, reverted immediately — `git diff` against `src/app/layout.tsx` shows zero changes; it was never part of the amended commit.

Additionally: bundled the amended commit, cloned it into a clean directory, ran `npm install`, `tsc --noEmit` and `npm run validate` there from scratch — same clean result, confirming the amended commit is self-contained.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`206cf3e`, amended from `760f45b`, itself amended from `19d04af`, `8612832`, `1ef8bc6`, `c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-round6-13aug.bundle`:

```
cd ~/Downloads
git clone -b fact-ledger-reliability-gate sdwan-reliability-gate-round6-13aug.bundle review-reliability-gate-round6
cd review-reliability-gate-round6
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate --force
```

`--force` is needed because the commit hash changed under the amend — your existing `main` checkout is never touched by any of this. Say the word when you want it merged.

Canvas work was not started, as instructed. Stopping here.
