# Checkpoint: full unification of the three canonical objects

**Commit:** `c330e0392b03157407bc9f6cfd549f65de89b0a3` on `living-procurement-2030-shell` (local only — not pushed, merged, or deployed)
**Date:** 17 Aug 2026

## What this closes

Your own independent code review of the Checkpoint B–F bundle (commit `7e85a64`) found, precisely, that the platform still had three related but non-identical canonical objects: durable `ProjectDetails` + ledgers, a regenerated-never-persisted `LivingProcurementDocument`, and an immutable `PublishedSnapshot` frozen mainly from the legacy `rfp_sections` pipeline. You then selected **"Full unification now"** — making `LivingProcurementDocument` the real persisted/versioned envelope, migrating `PublishedSnapshot` to freeze it, and repointing the Room and every export to read from it, as its own bounded, fixture-first phase.

That is what this checkpoint implements.

## The obstacle, and how it's handled honestly

`compileProcurementDocument()`'s `facts: WorkspaceFact[]` input cannot be reconstructed server-side from anything currently persisted — the codebase's own comment in `source-ledger.ts` says plainly there is "nothing to restore them FROM." A server-side recompile-on-read would silently produce a facts-empty, wrong document.

This is sidestepped, not solved from thin air: the compiler is pure and deterministic, and the client (`ProjectDesk.tsx`) already holds live facts and already compiles the document via its `compiledDocument`/`canvasDocument` useMemo. So the server never recomputes — it durably **records** the client's own already-compiled output on every save, the same "client acts, server records" shape this codebase already uses for `source_ledger`/`decision_ledger`. No parallel source of truth is introduced: the document's content is still 100% a function of the same ledgers the compiler always read.

## IMPLEMENTED / NOT DEPLOYED (all of the below)

1. **Persisted, versioned envelope.** `ProjectDetails` gains an optional `procurement_document: LivingProcurementDocument` field (`rfp-types.ts`), backed by a new, strictly-validated `LivingProcurementDocumentSchema` (`procurement-document.ts`) — full validation on every field a downstream reader actually uses (clauses, evaluation, openDecisions, readiness, counts, architecture), permissive only on `factSnapshot` (a documented internal diffing artefact, never read by anything else). `ProjectDesk.tsx`'s `rfpPayload()` sends `canvasDocument` with every save; because the PUT/POST routes already blind-spread validated body fields, no route changes were needed for this half.

2. **Reopen continuity.** The Security Sourcing resume path now seeds the compiler's `previousDocument` ref from the project's own persisted `procurement_document`, so `version` continues from where the prior session left off (proven by fixture: reopening with no new edit keeps the same version; a genuine new edit still advances it by exactly one) instead of silently resetting to 1 on every reload. Facts themselves are still not rehydrated — that limitation is unchanged and stated plainly in the code, not hidden.

3. **Frozen publication.** `PublishedSnapshot`/`FrozenRevision.frozen_content` gains `living_document: LivingProcurementDocument | null`, written by `rfp-publish.ts` at both freeze points (the early `FrozenRevision` and the final `PublishedSnapshot`). The legacy `rfp_sections`/`buyer` fields are kept, unchanged — every existing snapshot and every reader that hasn't been repointed keeps working exactly as before. `rfpContentSnapshot()` (the idempotent-replay/MarketUnlock content hash) **deliberately excludes** `procurement_document` — documented inline — so this addition cannot make the replay/unlock machinery sensitive to a derived recompute.

4. **Procurement Room.** When a snapshot has a living document, the "What was published" panel now reads its title/clause/section counts directly; a pre-unification snapshot (no living document) falls back to the legacy `rfp_sections` line, honestly, exactly matching this page's existing three-state "never fabricate a frozen reading that isn't real" discipline.

5. **Every export.** A new, documented projection — `livingDocumentToRfpSections()` in `rfp-document.ts` — maps the living document's clauses into this pipeline's own `RfpSection[]` shape (grouped by section, mandatory → required priority, weight clamped into range, supplier-response/evidence/quote all carried through). The gated download route (`preview/download/route.ts`) uses it to build `frozenProject.rfp_sections` whenever a snapshot has a living document — one change that repoints markdown, styled HTML/.doc, print **and** the native `.docx` all at once, since they all share that one object. The `json` export additionally carries the raw `living_document`. Pre-unification snapshots fall back to the legacy fields unchanged — no regression to any previously-published project's export.

## Fixture-first verification

New: `scripts/validate-procurement-document-persistence.ts` — 16 checks, all against the real compiler and real schemas, not mocks:
- a genuinely compiled document round-trips through the persistence schema; malformed/incoming JSON drops cleanly (never throws, never corrupts an existing valid record);
- `ProjectDetailsSchema` stays backward compatible with and without the new field;
- `rfpContentSnapshot()` is proven byte-identical across two records differing only in `procurement_document` (the content-hash exclusion actually holds, not just claimed);
- the export projection is proven lossless (every clause → exactly one question, no empty sections, weights clamped, mandatory↔required mapping exact);
- reopen version continuity is proven directly against `compileProcurementDocument()`: no new revision this session → same version; a genuine new revision → version advances by exactly one.

All pre-existing fixtures in `npm run validate` (the full chain, unchanged scripts included) still pass — nothing regressed. `tsc --noEmit` is clean. `eslint` introduces zero new errors (the 4 pre-existing errors are byte-identical on the unmodified baseline, confirmed via `git stash`).

## Known limitation this session

`next build`'s webpack step fails on a Google Fonts fetch (`fonts.googleapis.com`) — reproduced identically on the unmodified baseline commit via `git stash`, and confirmed as a sandbox network restriction (`curl` to the same host returns a 403 from the egress proxy), not a code defect. `tsc --noEmit` — the actual type-correctness check — is clean, so this is a build-tooling/network gap in this session, not a regression.

## What's still honestly unresolved

- Facts (`WorkspaceFact[]`) are still never durably persisted or rehydrated on their own — only the compiled *output* of a session's facts now survives a reload. A buyer who closes the tab mid-conversation still loses the ability to keep editing exactly where they left off at the fact level (an existing, pre-dating limitation, unchanged by this phase).
- The wizard/non-security resume path does not yet exist in `ProjectDesk.tsx` at all (per `resumeStateFromProject()`'s own documented scope), so the reopen-seeding fix above currently only benefits Security Sourcing projects — consistent with, not a regression of, that existing scope boundary.
- `rfpQuestion.source` has no clause-origin-shaped value to map onto; the export adapter uses `"methodology"` as an honest catch-all (documented inline) rather than inventing a new enum value outside this phase's bounded scope.

Everything above is local-only. No push, merge, deploy, or supplier-facing action has occurred.
