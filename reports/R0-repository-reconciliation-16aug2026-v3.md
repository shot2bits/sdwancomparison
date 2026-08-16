# R0 — Repository Reconciliation (structured, v3 — authoritative)
Netify Living Procurement OS — against "2030 Production Truth and Next Phase Brief — Version 3.0"
Prepared 16 Aug 2026. R0 itself was a read-only investigation (no files edited, no branch created, no commit/push/merge/deploy/install performed during the reconciliation). Accepted by Robert as the authoritative reconciliation, subject to the terminology corrections applied throughout this version.

**Status note (added after acceptance, same day)**: row 8's finding below has since been reproduced with fresh evidence and fixed at a checkpoint, per Robert's separate row-8 hotfix instruction — see the checkpoint report delivered alongside this file. That work does not change any other finding in this document; it is noted inline at row 8 and in §9/§15 below, with the rest of the reconciliation left exactly as accepted.

**Second status note (market-unlock correction round, same day)**: the row-8 checkpoint referenced above was itself incomplete. Robert's own post-fix evidence review found that `hasPublished(project.status)` — the predicate the row-8 fix used as its gate everywhere — is not the canonical boundary: a project can satisfy it while its Opportunities Board listing (and therefore its market-facing unlock) has failed, and the row-8 evidence itself showed a named invited vendor visible while the UI simultaneously read "Not on the public board yet." A focused correction round introduced a new canonical, server-derived `MarketUnlock` record (binding a frozen document revision to a successfully-created board listing at a recorded timestamp — see `src/lib/market-unlock.ts`), corrected the publish sequence so board publication is a genuine prerequisite rather than an optional afterthought, replaced `hasPublished()` with the canonical check at every governed route, fixed an authentication-ordering gap in the connect route, amended the Stage B design document's envelope shape to bind board publication and the frozen revision together rather than treating a frozen revision alone as sufficient, and added fixtures proving the corrected boundary (including sabotage-and-restore proof that they fail without the fix). See the amended checkpoint report (`reports/row8-checkpoint-16aug2026-market-unlock-correction.md`) for the full account. This second note supersedes the first wherever they'd otherwise conflict: the row-8 fix described below and in the original checkpoint report was real, useful work, but was not itself a completed release — the amended checkpoint is. Nothing from either round has been pushed, merged or deployed.

**Third status note (market-unlock correction round 2, same day)**: the correction round described in the second status note was itself still flawed, on Robert's own review of it. It made an explicit "judgement call" (flagged as such in its own checkpoint report) that `list_on_board: false` should still create a real `Opportunity` (`visibility: "unlisted"`) and still commit a `MarketUnlock` against it — reintroducing, in a different shape, the same class of defect the round it corrected: a project's market could still unlock without a genuinely PUBLIC Opportunities Board listing. Robert's review rejected this outright and stated the non-negotiable product rule in full: vendor identities, matching, invitations, supplier-room access, messages, responses and exports unlock ONLY after a project has been successfully published as a PUBLIC opportunity on the Opportunities Board; an unlisted/private Opportunity never satisfies this, and "not listed on the board" must never be reinterpreted as "listed privately." A second, focused correction round fixed this: `list_on_board: false` now creates no `Opportunity` of any visibility and commits no `MarketUnlock`; `project.status` no longer flips to `"published"` before board publication genuinely succeeds (closing a second reproduced defect: a board failure previously left the project status published with no listing and no unlock); the frozen revision (`FrozenRevision`, a new, minimal, genuinely-immutable type) is now persisted BEFORE the `MarketUnlock` that references it, and `commitMarketUnlock()`/`isMarketUnlocked()` re-verify that binding on every commit and every read, not merely on the KV row's existence; and the publish sequence is now an explicit, idempotent, recoverable saga (A–G) rather than an implicit sequence of side effects. See the same checkpoint report's own "ROUND 3 AMENDMENT" section (added in place, at its top) for the full account, before/after evidence, and sabotage-proof output. This third note supersedes the second wherever they'd otherwise conflict; nothing from any of the three rounds has been pushed, merged or deployed.

This is the same investigation as the earlier narrative and structured reports, with five wording corrections applied throughout: (1) a "guaranteed to drift" overclaim in §10 corrected to name the actual, weaker structural property; (2) "currently-live" claims about row 8 now distinguished from what was source-confirmed-but-unreproduced at R0 time versus what has since been freshly reproduced; (3) "every secret uses `newId()`" corrected to the exact enumerated set of security-sensitive identifiers, not every `newId()` call site (most are plain record ids, not secrets); (4) the Word/PDF export description tightened to Robert's precise phrasing; (5) the MCP transport/CORS finding reframed as needing a tool-by-tool threat model rather than stated as an automatic vulnerability.

---

## 1. Current branch and exact origin/main SHA

- Branch: `main`
- Local HEAD and `origin/main` (fetched live, moments before writing this): both `f14a956a3a2dc7eacb661dc3562d8a3d57d291e6` — identical to the brief's own cited anchor. Zero drift.

## 2. Repository status

`git status`: clean. `git diff origin/main`: empty. One untracked directory, `reports/`, holding pre-existing scratch logs/bundles from prior engagements (nothing newer than this R0 work, nothing tracked, nothing that changes any source file). `AGENTS.md`/`CLAUDE.md` read in full (§ below) — contain only a generic Next.js-version caution, no project-specific rules that bear on this reconciliation.

**AGENTS.md** (verbatim, in full):
> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**CLAUDE.md**: `@AGENTS.md` (import directive only).

## 3. Production Truth Ledger reconciliation

Each row carries the fields your step 6 asked for: exact paths; component/function/type/route names; evidence; the delta from the document; saved/resumable/published/exportable status; and audience (buyer-facing / supplier-facing / internal).

---

### 1. Canonical entry point — Document: LIVE → Reconciled: **LIVE, with two adjacent defects**

- **Files**: `src/app/home/page.tsx` (canonical canvas), `src/app/workspace/page.tsx` (duplicate), `src/app/page.tsx` (stale marketplace root), `src/components/MegaNav.tsx`, `next.config.ts`.
- **Names**: default export `Page()` in `home/page.tsx`; `metadata.alternates.canonical = "https://netify.co.uk/"`.
- **Evidence**: `home/page.tsx`'s own header comment states it is "served at netify.co.uk/ by the apex rewrite." I independently confirmed this live in Chrome (Engagement A's post-merge smoke test, 15 Aug 2026): `https://netify.co.uk/` renders the `ProjectDesk` canvas.
- **Delta from document**: (a) the apex-level rewrite itself lives in a separate "main site" repository not present in this sandbox — cannot be verified from this repo's code, only from the live behavioural test; (b) `workspace/page.tsx`'s comment claims it "308s to the apex publicly," but the file contains no `redirect()` call and `next.config.ts`'s `redirects()` has no entry targeting `/workspace` — it renders a full independent duplicate of the canvas instead of redirecting; (c) `MegaNav.tsx`'s site-wide brand-logo link (`href="/"`, lines 154 and 237) resolves under `basePath: "/sase"` to `/sase/`, served by `src/app/page.tsx` — a different, older vendor-marketplace listing, not the canvas. The primary nav's own logo does not point at the canonical entry point.
- **Saved/resumable/published/exportable**: N/A (routing, not a data object).
- **Audience**: buyer-facing.

---

### 2. Living document projection — Document: LIVE → Reconciled: **LIVE**

- **Files**: `src/lib/workspace/procurement-document.ts`, `src/components/ProjectDesk.tsx`.
- **Names**: `compileProcurementDocument()` (line 1173); input type `ProcurementCompilerInput` (389-428); output type `LivingProcurementDocument` (292-343); `resolveGovernedRevision()` (1149); `ProjectDesk.tsx`'s `compiledDocument` `useMemo` (~1827-1842).
- **Evidence**: pure function, invoked client-side on every render pass from current facts/decisions.
- **Delta**: none — matches the document's description.
- **Saved/resumable/published/exportable**: **not saved** (see step 9 section below), not published, not exportable in its own right.
- **Audience**: buyer-facing.

---

### 3. Best next decisions — Document: LIVE → Reconciled: **LIVE**

- **Files**: same as row 2.
- **Names**: a structured field on `LivingProcurementDocument`'s output type, rendered by `ProjectDesk.tsx`/`LivingProcurementCanvas.tsx`.
- **Evidence**: emitted directly by the compiler, same call chain as row 2.
- **Delta**: none.
- **Saved/resumable/published/exportable**: not saved independently of the parent document (row 2's caveat applies).
- **Audience**: buyer-facing.

---

### 4. Document outline — Document: LIVE → Reconciled: **LIVE**

- **Files/Names**: same compiler output type as rows 2-3.
- **Evidence/Delta**: as above.
- **Saved/resumable/published/exportable**: as row 2.
- **Audience**: buyer-facing.

---

### 5. Manufacturing sector intelligence — Document: LIVE → Reconciled: **LIVE**

- **Files**: `src/lib/sector/packs.ts`, `src/lib/sector/derive.ts`.
- **Names**: `SECTOR_PACKS` (packs.ts:293); `manufacturing` pack (line 219); `healthcare` pack (line 93) — exactly two packs exist, no more.
- **Evidence**: governed accept/decline suggestion lifecycle plus risk notes, sourced from the pack, never writing a fact directly ("no pack ever writes a fact" — the pack law, enforced structurally).
- **Delta**: none against the document's description; note only two sector packs exist total, not a larger library.
- **Saved/resumable/published/exportable**: suggestion *decisions* are saved via the decision ledger (row 6); the pack content itself is static code, not data.
- **Audience**: buyer-facing.

---

### 6. Decision ledger reversal — Document: LIVE → Reconciled: **LIVE**

- **Files**: `src/lib/sector/derive.ts`, `src/components/LivingProcurementCanvas.tsx`, `scripts/validate-sector-suggestion-reversal-ui.mjs`.
- **Names**: `acceptedOnRecord()`, `recordDecision(questionId, optionLabel, entry)`, `declineAcceptedSuggestion()`, `AcceptedSuggestions` component.
- **Evidence**: this is Engagement A's hotfix, merged into the exact SHA this report is anchored to (commit `f14a956a`, itself a merge of `fffe472d`). Proved by a real Playwright fixture clicking the production "Mark as not needed" control, desktop and 390px mobile, and independently confirmed live on `https://netify.co.uk/` by direct browser test 15 Aug 2026.
- **Delta**: none — this row is fully current as of this reconciliation.
- **Saved/resumable/published/exportable**: saved to the decision ledger (part of `ProjectDetails`), resumable for `security_sourcing`-engine projects only (row 10's caveat), not separately published/exported.
- **Audience**: buyer-facing.

---

### 7. Readiness semantics — Document: LIVE → Reconciled: **LIVE**

- **Files**: `src/lib/sector/packs.ts`, `src/lib/sector/derive.ts`.
- **Evidence**: sector suggestions are structurally optional — no code path treats a pending/declined suggestion as a buyer fact, a mandatory gate, or a readiness penalty.
- **Delta**: none.
- **Saved/resumable/published/exportable**: as row 6.
- **Audience**: buyer-facing.

---

### 8. Pre-publish identity boundary — Document: LIVE, "release-blocking invariant" → Reconciled at R0 time: **PARTIAL — the most significant finding in this reconciliation**. Status now: **fixed at a checkpoint, pending your review** (see note below).

- **Files**: `src/components/RfpBuilder.tsx`; `src/app/api/openapi/build_sase_shortlist/route.ts` (call target); `src/lib/rfp-connect.ts`; `src/app/api/rfp/[id]/connect/route.ts`; `src/app/api/rfp/[id]/route.ts`; `scripts/validate-rfp-builder-match-disclosure.ts`.
- **Names**: `RfpBuilder.tsx`'s "Vendors and service providers" panel (lines 1779-1841); its data call `suggestSuppliers()` (927-942); the always-visible "Response link" copy control (line 1455); the fixture's Part B8 block (validate-rfp-builder-match-disclosure.ts:213-220).
- **Evidence, as it stood at R0**: source-level — the vendor panel has **no `hasPublished` gate at all** and calls the unauthenticated `build_sase_shortlist` endpoint with this project's own fields; `connect/route.ts` + `rfp-connect.ts` have **no status/hasPublished check anywhere** (confirmed by exhaustive grep of both files); `GET /api/rfp/[id]?token=` (lines 51-76) has no `hasPublished` gate on the share-token supplier-read branch; Part B8 only asserts owner-gating. At R0 time this was a **source-confirmed reachable disclosure path** — established from the code itself, not yet exercised against a running instance. It was not asserted as freshly reproduced against production at that point, and this correction records that distinction explicitly.
- **Delta from document**: this is the direct contradiction of "Live — treat as a release-blocking invariant." The newer `ProjectDesk.tsx`/compiler path is not implicated — this leak is entirely inside the older `RfpBuilder.tsx` surface and its supporting routes.
- **Saved/resumable/published/exportable**: the leaked data (vendor suggestions, supplier connections) was genuinely persisted server-side pre-publish — which was precisely the defect.
- **Audience**: buyer-facing panel, but the leak's effect is supplier-identity exposure and an unguarded supplier-facing write (the connect route) before the buyer has published anything.
- **Update, same day, post-acceptance**: per your separate row-8 hotfix instruction, all three paths were reproduced with fresh evidence against a faithful local runtime of this exact commit (real route handlers, real rfp-store/rfp-connect/project-machine logic, fake-kv-server.mjs standing in only for the Upstash REST network hop) — not against `https://netify.co.uk/` directly, deliberately: reproducing the connect-route write against real production would itself have created a real, addressable `SupplierConnection` against a real vendor slug, i.e. would have caused the exact harm being reproduced. All three paths were then fixed and re-verified closed, with a fourth check proving the intended reveal still happens correctly once a project is genuinely published. Full evidence, the diff, fixture output and a git bundle are in the checkpoint report delivered alongside this document — not merged, pushed or deployed, per your instruction.

---

### 9. Publish/matching machinery — Document: PARTIAL → Reconciled: **PARTIAL, confirmed, plus one new finding**

- **Files**: `src/lib/published-snapshot.ts`, `src/lib/rfp-publish.ts`, `src/app/api/rfp/[id]/list-on-board/route.ts`.
- **Names**: `PublishedSnapshot` type; `publishEventId()` (rfp-publish.ts:390-397); `executePublish()` (478-823); `listRfpOnBoard()` (132-228); route handler (list-on-board/route.ts:44-84).
- **Evidence**: `published-snapshot.ts`'s own header comment (lines 14-27) states it freezes the **older** `rfp_sections`/`buyer` fields, not the `LivingProcurementDocument`. `list-on-board/route.ts` reads the **live** (possibly post-publish-edited) project record to build the board notice, not the frozen snapshot.
- **Delta**: the board-listing behaviour contradicts the codebase's own documented claim elsewhere that the public board notice is sourced only from the frozen snapshot — new finding, not in the original document.
- **Saved/resumable/published/exportable**: published and snapshotted for the **old** pipeline only; the Living Procurement Document has no publish path at all.
- **Audience**: the frozen snapshot is supplier-facing (board notice, matched-vendor view); the live-read bug means a buyer's post-publish draft edits can leak into what suppliers see before an explicit republish — a boundary violation in spirit similar to row 8. Unchanged by the row-8 hotfix, which did not touch this route.

---

### 10. Exact workspace persistence — Document: PARTIAL → Reconciled: **PARTIAL, sharper than the document implies — see the dedicated step 9 section below**

- **Files**: `src/lib/rfp-types.ts`, `src/lib/workspace/source-ledger.ts`, `src/components/ProjectDesk.tsx`.
- **Names**: `ProjectDetailsSchema` (rfp-types.ts:175-289); `resumeStateFromProject()` (source-ledger.ts:216-244); `previousProcurementDocumentRef` (ProjectDesk.tsx:~969); `rfpPayload()` (2572-2625); `createRecord()` (2627-2662); `refreshRecord()` (2666-2693); `saveNow()` (2699-2730).
- **Evidence/Delta/Saved-resumable status**: fully detailed in the dedicated section below (your step 9).
- **Audience**: buyer-facing (internal storage, buyer-visible effect).

---

### 11. Canonical published document — Document: MISSING → Reconciled: **MISSING, confirmed**

- **Files**: none exist — this is an absence, not a partial implementation.
- **Evidence**: no code path freezes, versions, or publishes the `LivingProcurementDocument` compiler output anywhere in the repository. The only "canonical published document" that exists is `PublishedSnapshot` (row 9), which is a different object (the older `rfp_sections`/`buyer` pipeline).
- **Delta**: matches the document's own MISSING classification exactly — no change.
- **Saved/resumable/published/exportable**: none of the above, for the Living Procurement Document specifically.
- **Audience**: n/a (does not exist).

---

### 12. Frozen Word/PDF/JSON exports — Document: PARTIAL → Reconciled: **PARTIAL, confirmed, plus one new finding**

- **Files**: `src/app/rfp-builder/[id]/preview/download/route.ts` (gated, snapshot-citing); `src/app/rfp-builder/[id]/preview/page.tsx` + `src/components/PrintButton.tsx` (ungated, new finding).
- **Evidence**: the gated route serves four formats. JSON is genuine (real `content_hash`/`published_version` from the frozen snapshot). The "Word" export is **HTML compatible with Word, not a native `.docx`** — served with an `application/msword` content-type, but no OOXML generation exists anywhere in the repo. The "PDF" export is **a print workflow, not generated PDF** — HTML plus a client-side `window.print()` call, no server-side PDF library involved. The second surface (`preview/page.tsx` + `PrintButton.tsx`) renders the **live draft**, ignoring publish state and the frozen snapshot entirely, and is untested by any fixture.
- **Delta**: the second ungated print surface is a new finding not distinguished in the document's ledger.
- **Saved/resumable/published/exportable**: exportable (four nominal formats) only from the gated route; the second surface exports the live draft, which is not "frozen" in any sense.
- **Audience**: the gated export is intended buyer-facing (and matched-supplier-facing per snapshot rules); the ungated second surface has no audience restriction implemented at all.

---

### 13. Scenario Lab — Document: LATER → Reconciled: **LATER, confirmed**

- **Files**: none — exhaustive case-insensitive grep for `scenario.lab`/`scenariolab` across `src/` returns zero matches.
- **Evidence/Delta**: matches document exactly, no implementation exists.
- **Saved/resumable/published/exportable**: n/a.
- **Audience**: n/a (does not exist).

---

### 14. MCP capability broker — Document: LATER, "no connector is authorised" → Reconciled: **LIVE — contradicts the document, second most significant finding**

- **Files**: `src/app/api/mcp/route.ts`, `src/lib/mcp-rfp-tools.ts`.
- **Names**: JSON-RPC 2.0 handler (route.ts, 276 lines, protocol handling at lines 11-38/155-276); 38 tools defined across `mcp-rfp-tools.ts` (425 lines), including `publish_rfp` (265-276) and `opportunity_respond`/`supplier_reply` (277-325).
- **Evidence**: live, publicly reachable at `https://netify.co.uk/sase/api/mcp/`. There is no transport-level authentication and CORS is wide open (route.ts:22-32) — but every write-capable tool is independently, individually credential/token-gated at the tool level (confirmed for `publish_rfp` and `opportunity_respond`/`supplier_reply` specifically). Open transport plus independently authenticated sensitive writes is not automatically a vulnerability; whether the open transport itself is acceptable depends on what each of the 38 tools can do and to whom, which this reconciliation did not evaluate tool-by-tool. What is a plain factual error, independent of that judgment, is "no connector is authorised" — the connector exists and is already reachable.
- **Delta**: direct contradiction of the document's LATER classification on existence/reachability; the security characterisation requires the tool-by-tool review named above before drawing a conclusion either way.
- **Saved/resumable/published/exportable**: the server itself is stateless routing; individual tools read/write the same persisted objects as the human-facing routes (subject to their own gating, including row 8's gap where the underlying route was implicated — now fixed at the checkpoint).
- **Audience**: designed for external AI agents acting on behalf of buyers or suppliers — effectively both, tool-dependent; some tools (e.g. `publish_rfp`) are buyer-authority actions, others (`supplier_reply`) are supplier-authority actions.

---

### 15. Durable agent missions — Document: LATER → Reconciled: **PARTIAL, and already executing on a production schedule — third significant finding**

- **Files**: `src/lib/agent-run.ts`, `src/lib/agent-store.ts`, `src/lib/agent-types.ts`, `vercel.json`.
- **Names**: `ProcurementGoal` (autonomy levels), `ApprovalItem` queue, `AuditEntry`, budget fields; the hard-coded send-block at `agent-types.ts:227-231` (`sends: 0`, audited).
- **Evidence**: `vercel.json`'s `crons` array invokes `/sase/api/agent/run` three times daily in production (`0 8 * * *`, `30 7,13 * * *`) against real buyer projects, alongside `publish-nudge`, `deadlines`, `daily-digest`, `account-activation` crons.
- **Delta**: the document's LATER framing understates this — the scaffolding is real, the safety block (no autonomous supplier-facing send) does hold, but the system is not dormant; it runs today, on a schedule, against live data.
- **Saved/resumable/published/exportable**: `AuditEntry`/`ApprovalItem` are persisted and auditable; no publish/export capability of their own.
- **Audience**: internal/buyer-facing (proposes actions for a human buyer to approve); never supplier-facing directly, per the hard-coded `sends: 0` block.

---

### 16. Netify MCP server/App — Document: LATER → Reconciled: **LIVE — same evidence as row 14**

- **Files/Names/Evidence**: identical to row 14; this row and row 14 describe the same artifact (`api/mcp/route.ts` + `mcp-rfp-tools.ts`). There is no separate, not-yet-built "Netify MCP server" distinct from what already exists.
- **Delta**: as row 14.
- **Saved/resumable/published/exportable/Audience**: as row 14.

---

## 4. Existing architecture map

Two structurally separate document/publish systems coexist and do not communicate:

- **New — Living Procurement Document**: `ProjectDesk.tsx` (canonical `/home/` route) → `compileProcurementDocument()` → sector packs (`healthcare`, `manufacturing`). Purely client-invoked, never persisted, never reaches publish/snapshot/export.
- **Old — RFP document pipeline**: `RfpBuilder.tsx` (`/rfp-builder/[id]`) → `rfp_sections`/`buyer` fields → `executePublish()` → `PublishedSnapshot` → export route. This is what is actually saved, published, frozen, and exported. Row 8's now-fixed leak and row 12's second print path both live entirely here.

Supporting systems: `src/lib/auth.ts` (cookie session), `src/lib/rfp-access.ts`'s `requireRfpOwner` (lines 50-64), `ProjectDetails.consents` + `hasPublishConsent` (`project-machine.ts:113-119`, server-minted, append-only), `src/lib/rfp-store.ts` (Upstash-REST-compatible KV; `newId()` at lines 82-84, the identifier generator discussed in §9 below).

The brief's **Procurement Room** (post-publish frozen-document + invitation pipeline + evidence comparison + human decision queue, brief §7, "Stage D") has **zero implementation** — exhaustive grep for "Procurement Room" across `src/` returns nothing. The closest existing analog is `src/app/project/[id]/page.tsx` (responses, signoffs, `ApprovalRequest`), but it operates entirely on the old `rfp_sections`/`PublishedSnapshot` pipeline, not a frozen `LivingProcurementDocument` — it cannot fulfil the brief's Procurement Room concept as specified without Stage C/D work first (canonical publication of the *new* document has to exist before a room can be built around it).

## 5. Persistence and reopen analysis — including your step 9

**Does the canonical `LivingProcurementDocument` survive save and reopen exactly, or does the app recompile it from partial source state? — It recompiles. It does not survive exactly.**

- `ProjectDesk.tsx`'s `previousProcurementDocumentRef` (~line 969) is unconditionally initialised to `null` on load; there is no code path that hydrates it from a stored prior compiled document.
- `ProjectDetailsSchema` (`rfp-types.ts:175-289`) has no `workspace_state` field or any versioned bundle capable of holding a compiled `LivingProcurementDocument`. What is saved is only the *source* state the compiler consumes — `source_ledger`, `decision_ledger`, `engine_data` — via `rfpPayload()`/`saveNow()` (ProjectDesk.tsx:2572-2730).
- On reopen, `compileProcurementDocument()` is re-run from scratch against whatever source state was saved, with `previousDocument: null`. If the compiler's logic changes between save and reopen (a code deploy in between), the reopened document can differ from what the buyer last saw, even though the underlying facts are unchanged — this is the concrete risk "recompiled from partial source state" describes.
- `resumeStateFromProject()` (`source-ledger.ts:216-244`) — the function that reconstructs source state on reopen — is gated to `engine === "security_sourcing"` only. For any project on the general/wizard engine, there is **no reopen path in `ProjectDesk.tsx` at all**: "Partial" undersells this half of the product, where it is closer to Missing.

## 6. Publish and frozen-snapshot analysis

Covered in ledger row 9. `PublishedSnapshot` is real, versioned, content-hashed, idempotent — but freezes the wrong object relative to the brief's central concept. The board-listing route's live-read (rather than snapshot-read) is a new, unreported divergence risk, covered further in §10 below.

## 7. Export analysis

Covered in ledger row 12. Four nominal formats exist from one gated route (JSON genuine; "Word" is HTML compatible with Word, not a native `.docx`; "PDF" is a print workflow, not generated PDF); a second, entirely separate, ungated, untested surface exports the live draft regardless of publish state.

## 8. MCP and agentic capability gap analysis

Covered in ledger rows 14-16. The gap is not "doesn't exist yet" — a full 38-tool MCP server is live, and agent-mission scaffolding already executes on a production cron schedule multiple times daily, hard-blocked from autonomous supplier-facing sends. Every write-capable tool checked is independently, individually authenticated at the tool level. Whether the open transport/CORS on top of that is itself acceptable is a tool-by-tool threat-modelling question this reconciliation surfaces but does not answer — see §9. The one plain factual error, independent of that judgment, is the "Later, no connector authorised" documentation: the connector exists and is already reachable today.

## 9. Security, permission and audit-boundary findings

- **Row 8** was the standout finding at R0 time: a source-confirmed reachable pre-publication supplier-identity/supplier-contact disclosure path in `RfpBuilder.tsx` and its supporting routes, on a boundary the document calls release-blocking, uncaught by the fixture built to police it. It has since been reproduced with fresh evidence (against a faithful local runtime, not production directly — see row 8 above for why) and fixed at a checkpoint pending your review; see the separate checkpoint report.
- **MCP endpoint** has no transport-level auth and wide-open CORS. This is not, by itself, a confirmed vulnerability: every write-capable tool checked is independently credential/token-gated, so a caller reaching the transport without authentication still cannot perform a sensitive write without separately satisfying that tool's own gate. What this reconciliation did not do is walk all 38 tools individually to confirm every one of them follows that pattern, or assess what an unauthenticated caller can *read* through the open transport. **Recommendation**: a tool-by-tool threat model (each tool's read/write classification, its own auth requirement, and what an unauthenticated transport-level caller can learn or do) before treating this as either "fine" or "a vulnerability" — this reconciliation surfaces the question, it does not close it.
- **Identifier generation**: `newId()` (`rfp-store.ts:82-84`) = `Date.now().toString(36) + Math.random().toString(36).slice(2,8)` — not a CSPRNG, roughly 31 bits of true randomness. It is used throughout the codebase for plain record ids (rfp/nda/thread/response/snapshot/message/connection/artefact/audit ids and similar), which are not secrets and do not need unguessability. A smaller set of genuinely security-sensitive, bearer-credential identifiers also uses it, specifically: `share_token`/`tok` and `manage_token`/`mtok` (`rfp-store.ts`), the opportunity `buyer_token`/`btok` (`opportunity.ts`, `rfp-publish.ts`), the per-supplier connection token `stok` (`rfp-connect.ts`), the per-vendor bearer credential `svtok` and the opportunity token `otok` (`rfp-store.ts`), and the session/magic-link tokens `sess`/`magic` (`rfp-store.ts`). These are the identifiers where weak randomness is a real structural weakness — "multiple security-sensitive identifiers use `newId()`" is the accurate claim; "every secret" overstated it by conflating this set with the much larger population of non-secret record ids that happen to use the same generator function. No confirmed exploit path was found for any of them.
- Consent is genuinely server-enforced (server-minted text, server-checked `hasPublishConsent`, append-only history) — not client-spoofable.
- `requireRfpOwner` is correctly applied everywhere else checked; row 8's defect (now fixed at the checkpoint) was specifically a missing *publish-state* check layered on otherwise-correct ownership checks, not a broken ownership boundary itself.

## 10. Projection divergence points — your step 10

Every place a separate projection of the same underlying facts could diverge from another, with the concrete mechanism:

- **Living document vs. supplier pack (sector suggestions)**: cannot diverge from stored state on reopen because neither is stored — both are recomputed together, atomically, from the same source ledger each time (§5). The divergence risk here is purely cross-deploy (compiler logic changes between save and reopen), not cross-projection.
- **Living document vs. evaluation/matching (`build_sase_shortlist`)**: row 8 shows this call is made directly from `RfpBuilder.tsx`'s own project fields, entirely outside the Living Procurement Document's compiler. The two systems read fundamentally different source data (old `rfp_sections` fields vs. new compiler input) — they are **structurally independent and already capable of divergence** between what a buyer sees in the canvas and what the "Vendors and service providers" panel shows, since they are different systems today, not variations on one shared source of truth.
- **Live project vs. published snapshot**: `list-on-board/route.ts` (row 9) reads the live, possibly-edited project rather than the frozen snapshot — a buyer's post-publish draft edit can change the public board notice before any explicit republish, directly contradicting the document's "a draft edit after publication never changes the live room until explicit republish" principle.
- **Published snapshot vs. exports**: the gated download route (row 12) correctly cites the frozen snapshot — no divergence there. The second, ungated print surface (`preview/page.tsx`/`PrintButton.tsx`) reads the live draft unconditionally, so it diverges from the snapshot whenever a post-publish edit has occurred.
- **Procurement Room**: does not exist (§4), so it cannot yet diverge from anything — but building it against the *old* pipeline's `PublishedSnapshot` (the only frozen object that currently exists) rather than a frozen `LivingProcurementDocument` would bake in the same living-document/old-pipeline split that already causes every divergence above. This is the central architectural risk for Stage C/D.

## 11. Recommended next stage

Unchanged from the earlier reports: **Stage B — exact save/reopen**, per the brief's own Section 12 sequencing, is the correct next architectural step — §5/§10 show persistence is the root cause of the compiler-recompute risk and half the projection-divergence surface. Row 8 was a live production defect, not a roadmap gap, and per your explicit instruction it was fixed at a checkpoint first, ahead of Stage B; Stage B itself has not been started.

## 12. Exact proposed file scope for Stage B, pending authorisation

- `src/lib/rfp-types.ts` — add a versioned, unified procurement-envelope field to `ProjectDetailsSchema` (superseding the earlier "just the compiled document" framing — see the amended Stage B design delivered alongside this report, which reflects your added persistence instruction: source ledger, fact ledger, decision ledger, suggestion states, compiler/rulebook version, compiled document snapshot and hash, draft revision and frozen published revision all together, not the compiled document alone).
- `src/lib/workspace/source-ledger.ts` — extend `resumeStateFromProject()` (or add a sibling) to cover `engine !== "security_sourcing"` projects.
- `src/components/ProjectDesk.tsx` — hydrate `previousProcurementDocumentRef` from the persisted envelope's exact saved snapshot on load (not a silent recompile — see the amended design); persist via the existing `saveNow()` path (2699-2730).
- Fixtures — extend `validate-published-resume-hydration.ts` or add a new wired fixture proving round-trip save → reopen → the exact saved snapshot renders first, for both engines, plus a desktop + 390px-mobile Playwright fixture per your standing testing requirement.
- Explicitly out of scope: `published-snapshot.ts`, `rfp-publish.ts`, export routes, MCP/agent files.

## 13. Risks and assumptions

- **Assumption**: the apex-level rewrite (netify.co.uk/ → `/sase/home/`) lives outside this repo; confirmed only via a prior live Chrome test, not by reading the rewrite config directly. Recommend a fresh live check before Stage B begins if time has passed.
- **Risk**: `/sase/workspace/`'s duplicate-not-redirect and the MegaNav stale-homepage link (row 1) are real but low-severity; not sized for a fix here.
- **Risk**: the MCP transport/CORS question (§9) remains open pending the recommended tool-by-tool review; treat it as unresolved, not as either cleared or confirmed.
- **Assumption**: the 13 wired `npm run validate` fixtures were not re-run during the original R0 pass (to avoid any perception of state change beyond reading); they were run as part of the row-8 checkpoint work and passed — see the checkpoint report.

## 14. Explicit list of capabilities I will not reopen

- The product will not move back to `/sase/workspace/`.
- `app.netify.co.uk`/`sase.netify.co.uk` will not be treated as product destinations (both correctly 301 to the apex, confirmed this session).
- The fact ledger, correction/removal semantics, and source-turn retention will not be redesigned.
- Vendor names, project-specific counts, rankings, evidence, or links will not be reintroduced before publish.
- Best-next questions will not be hidden inside Project details.
- Optional sector suggestions will not become buyer facts, mandatory gates, or readiness penalties.
- The accepted-suggestion reversal affordance will not be removed; the decision ledger will not be bypassed.
- The UI will not become a conventional admin dashboard.
- MCP/agent packages will not be newly expanded while the canonical save/publish/export lifecycle is incomplete — noting an MCP server and agent-run cron infrastructure already exist and already run, so this is preserved as "will not expand or newly authorise," since starting fresh is no longer the applicable verb.
- Nothing will be pushed, merged, or deployed without the explicit stage-specific instruction and final production smoke checks.

## 15. Checkpoint decision: REWORK (row 8 addressed, then corrected; awaiting your review before Stage B)

At acceptance, this was REWORK, not a clean PROCEED to Stage B, because row 8 (a ledger row you mark "Live — release-blocking invariant") was actually Partial, with a source-confirmed reachable disclosure path and a fixture that passed incorrectly. Per your explicit decision, row 8 was fixed first, with fresh reproduction evidence, ahead of Stage B.

**Amendment (market-unlock correction round, same day)**: that first fix gated everything on `hasPublished(project.status)`, which your own post-fix evidence review showed is not the canonical boundary — a project can satisfy it while its board listing never completed, and a named vendor could still be visible in that state. A focused correction round replaced that gate with a canonical, server-derived `MarketUnlock` record everywhere it governs, corrected the publish sequence to make board publication a genuine prerequisite, fixed an authentication-ordering gap, and added non-vacuous fixtures (including sabotage-and-restore proof). The remaining REWORK status is unchanged in kind — still not a clean PROCEED — but is now anchored to the corrected boundary, not the superseded one. See the amended checkpoint report (`reports/row8-checkpoint-16aug2026-market-unlock-correction.md`) for the diff, evidence, fixtures and bundle, not yet pushed, merged or deployed.

**Second amendment (market-unlock correction round 2, same day)**: that correction round's own gate was itself still wrong — it let an unlisted Opportunity satisfy the board prerequisite just as a public one does, which your review rejected outright as a reinterpretation of "not listed on the board" as "listed privately," and it could still leave a project's status "published" ahead of a genuinely successful board listing. A second, focused correction round on the same branch fixed both: only a genuinely PUBLIC Opportunity, bound to an already-persisted frozen revision, may ever cause a `MarketUnlock` to be committed, verified on every commit and every read; `project.status` now transitions to published strictly after that unlock succeeds, via an explicit, idempotent, recoverable publish saga. REWORK remains the correct status — this is the second time the same boundary needed correcting, which argues for review before Stage B, not against it. See the same checkpoint report's "ROUND 3 AMENDMENT" section for the diff, before/after evidence, sabotage-proof output and screenshots, not yet pushed, merged or deployed.

Stage B has not been started, per your instruction that the amended design should be prepared but not implemented until the row-8 checkpoint is reviewed and merged. The amended Stage B design (versioned procurement envelope, exact-snapshot reopen, explicit/version-aware/auditable recompilation, single frozen revision for publish/board/room/matching/exports, and — per this correction round's own further amendment to that design — a frozen revision alone never being sufficient for market unlock, and, per the round-2 correction, only a PUBLIC listing ever sufficient) is delivered separately, for your review only.
