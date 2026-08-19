# Living Procurement OS — 2030 Blueprint: Consolidated Checkpoint (B–F)

**Date:** 17 August 2026
**Branch:** `living-procurement-2030-shell`
**Commit range:** `caa437c` → `7e85a64` (this segment; Checkpoint A was `8070a02`, delivered and reported separately)
**Final commit SHA:** `7e85a64a1ef221356222c208118e2573ee976fb5`
**Cadence:** per your controlling instruction — reconciled once, then continued through Checkpoints B–F without stopping for review between them. Six internal commits mark safe points; nothing has been pushed, merged, or deployed. This is the one consolidated report for this segment, as instructed.

---

## 1. Bottom line

Every checkpoint B through F now has real, verified, committed work — not just Checkpoint A. None of them is *complete* against the blueprint's full scope; each is honestly a bounded, safely-verified slice, reported with the required labels below rather than overclaimed. Three of the six visual/architectural deviations you called out directly are fixed and measured, not just visually eyeballed:

- **Mobile Mission Control no longer dominates the screen.** Measured via Playwright: it went from 1025px tall (over the full 844px viewport) to showing exactly one decision card, matching the blueprint's "one decision card readable above the fold" rule.
- **The fixed composer no longer obscures content.** The mission rail now carries its own reserved clearance from the dock; verified by scrolling to the exact seam and confirming the visible card sits fully clear of the fixed bar (screenshot evidence below).
- **The marketing footer no longer renders in the workspace.** Confirmed via Playwright: footer element count went from 1 to 0 on `/home/`, while every marketing page keeps it unchanged.

The fourth thing you flagged — "the oversized marketing hero remains" — I investigated rather than assumed. Measured via Playwright computed style: the hero already compacts correctly from 58px to 16px on project start (confirmed empirically, `fontSize BEFORE: 58px` → `AFTER: 16px`). What reads as a large hero in the screenshots is the compacted hero text itself, not a bug. I did not change it, to avoid "fixing" something that already works — this is stated here so you can see the evidence rather than take my word for it.

## 2. What actually changed, checkpoint by checkpoint

### Checkpoint B — canonical versioned envelope, exact save/reopen fidelity
**Status: IMPLEMENTED / NOT DEPLOYED**

`ProjectDetails` (`src/lib/rfp-types.ts`) was already, and remains, the single canonical persisted record — that part was already true before this pass. The real gap was a *formal* schema-version migration boundary. Added:
- `envelope_schema_version` (optional field, `ProjectDetailsSchema`) and `CURRENT_ENVELOPE_SCHEMA_VERSION = 1`.
- `migrateProjectDetails()` (`src/lib/rfp-store.ts`) — the one place a record's version is read and upgraded, called on every `getProject()`/`getProjectsBulk()` read; `saveProject()` stamps the current version on every write.
- This is the same self-healing-on-read pattern the pre-existing `healSectionCategories()` already used, now versioned and checkable instead of an unbounded ad hoc repair with no marker for "already fixed."

`scripts/validate-envelope-schema-version.ts` (9 assertions, all pass) proves: an absent version defaults to 1 and gets stamped; an already-current record is a true no-op (same object reference, not even a copy); a record from a *newer* deploy is never downgraded; and a full `ProjectDetails` record round-trips through `JSON.stringify`/`JSON.parse` — the actual KV serialization boundary — byte-identical.

### Checkpoint C — agentic decision intelligence and governed MCP connections
**Status: PARTIALLY IMPLEMENTED / NOT DEPLOYED**

The MCP server itself (`src/app/api/mcp/route.ts` and its tool modules) was already real and live before this pass — unrelated to this work. `ProjectHistoryEvent.via` already carried a real `"mcp"` value distinguishing agent/tool-originated actions from web actions. What was missing was a *distinguishing visual treatment* on the one place this was already shown (the Project Overview's Activity feed) — previously a plain grey text suffix.

Added `src/lib/history-provenance.ts` (`historyProvenance()`, a pure function) and wired it into `project/[id]/page.tsx`'s Activity feed: a violet "MCP receipt" badge on genuinely MCP-originated events, and a "Consent recorded" badge when present — both derived from data the feed already had. Deliberately keyed on `via === "mcp"`, never `actor === "assistant"` alone, since a human-triggered assistant suggestion accepted through the web UI must not be misread as an MCP receipt. `scripts/validate-history-provenance.ts` (10 assertions) proves this distinction against every real `via` value.

**Not done:** a dedicated MCP activity log/dashboard, and a real Propose/Approve gate in front of a state-mutating MCP tool call. This pass makes already-governed actions visibly provenanced after the fact; it does not add a new pre-action approval surface. That remains **MISSING**.

### Checkpoint D — frozen publication revision and Procurement Room
**Status: PARTIALLY IMPLEMENTED / NOT DEPLOYED**

`PublishedSnapshot`/`FrozenRevision` (`src/lib/published-snapshot.ts`) already existed and are unchanged — mature, immutable-by-design infrastructure from an earlier phase. The frozen-revision *mechanism* was already real; what was **MISSING** entirely was a Procurement Room UI — confirmed by searching the whole repo: the only prior reference was one aspirational code comment.

Added:
- `src/lib/procurement-room.ts` — `procurementRoomState(phase, snapshot)`, a pure function distinguishing three honest states: `not_published` (nothing to show, honestly), `published_no_snapshot` (a legacy published record with nothing frozen — said plainly, never faked), and `frozen` (a real snapshot exists).
- `src/app/project/[id]/room/page.tsx` — the room itself, gated with the same owner auth as every other Project tab. Renders **exclusively** from `getLatestPublishedSnapshot()`: frozen title/sections, matched/invited vendor names, the frozen market report, accepted assumptions, open decisions, content hash, methodology/rulebook versions. Never reads from the live, possibly-since-edited `ProjectDetails`.
- `ProjectNav.tsx` — a new "Procurement Room" tab so it's actually reachable, not a hidden URL.

`scripts/validate-procurement-room.ts` (26 assertions) proves the state function against every `ProjectPhase` × snapshot-presence combination (confirms full phase coverage, none omitted) and that the room's fields survive the snapshot's own JSON round trip unchanged.

**Not done:** the blueprint's other lifecycle-specific visual states (ready-to-publish, publication-failed) still use existing generic UI, not distinct per-state treatment. Still **MISSING**.

### Checkpoint E — native Word/PDF/structured exports from the canonical document
**Status: PARTIALLY IMPLEMENTED / NOT DEPLOYED**

Discovered during reconnaissance: a structured JSON export (`?format=json`) already existed on the gated download route, predating this work — genuinely **LIVE/MERGED** already, nothing needed there. The existing "Word" export was styled HTML that Word happens to open (`?format=doc`, honestly documented as such in the code's own comments) — not a real binary.

Added `?format=docx` to the *same existing gated route* (`src/app/rfp-builder/[id]/preview/download/route.ts`) rather than a parallel one, so it inherits the identical owner-only + market-unlocked + frozen-snapshot-only gating every other format on that route already enforces. `src/lib/rfp-export-docx.ts` renders the **same canonical markdown** `buildRfpMarkdown()` already produces for the `.doc`/`.md` exports into a real OOXML binary via the `docx` npm package (new production dependency) — one canonical document, one text pipeline, one new binary renderer.

Verified three ways: `scripts/validate-export-parity.ts` (8 assertions, structural checks against the *real* `buildRfpMarkdown()` output plus an end-to-end Packer call proving a genuine ZIP/OOXML binary); a manual smoke test rendering a realistic RFP, independently opened and converted by LibreOffice (`soffice --headless --convert-to pdf`, exit 0 — proof it's a genuinely well-formed document, not just parseable by its own writer); and a rendered preview image (attached) confirming headings, tables, bullets and bold formatting all render correctly in a real document viewer.

**Not done:** a true server-generated PDF binary. The existing `format=print` path (browser print-to-PDF) is unchanged and was already honestly documented as an approximation. Still **MISSING** against the blueprint's "native PDF" requirement.

### Checkpoint F — aesthetic convergence and lifecycle verification
**Status: PARTIALLY IMPLEMENTED / NOT DEPLOYED**

The three concrete deviations you named are fixed and measured (see §1 and §3 for evidence): mobile Mission Control overflow, the composer's dock-overlap, and the workspace marketing footer. The fourth (the hero) was investigated and found to already work correctly — no change made, evidence provided.

**Not done:** a full pass against the blueprint's complete visual-standard no-go list (I did not re-audit every existing screen for "no dashboard landfill" etc.), and the lifecycle-specific lighting for ready/failed-publication states (tracked under Checkpoint D above). Still **MISSING**.

## 3. Evidence

**Screenshots** (attached, `reports/screenshots/2030-shell-checkpoint-a/`, re-captured fresh against the final commit):
- `04-mobile-scope-forming.png` — mobile Mission Control now shows exactly one decision card, not three; the document and command dock are both reachable without the rail consuming the viewport.
- `06-mobile-aside-main-seam.png` — the single visible decision card renders fully clear of the fixed composer dock at the exact scroll position where they'd otherwise meet.
- `02-desktop-scope-forming.png` — desktop unchanged (still shows up to 3 ranked cards, as the blueprint's desktop rule specifies).

**Measured, not eyeballed** (Playwright, exact numbers in this segment's own commit messages):
- Mobile Mission Control height: 1025px → cards limited to 1 below `lg:` (mechanism: `hidden lg:flex` on cards after the first, in `LivingProcurementCanvas.tsx`'s `bare` mode).
- Footer element count on `/home/`: 1 → 0; unchanged (1) on marketing pages.
- Hero computed `fontSize`: 58px → 16px on project start, confirmed working as designed.

**Test/build results:**

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (`reports/tsc-final.txt`) |
| `npm run validate` | **777 PASS / 0 FAIL** (`reports/validate-final.txt`) — up from 724 at the end of Checkpoint A; 53 new fixture assertions added across B/C/D/E |
| `npm run build` | exit 0; embedded fixture suite `ALL PASS` throughout; `/project/[id]/room` correctly registered as a dynamic route (`reports/build-checkpoint-final.txt`) |
| `eslint` on every file touched, vs. unmodified baseline | exactly the 4 pre-existing `react-hooks/set-state-in-effect` warnings in `ProjectDesk.tsx` (same count/locations as the Checkpoint A baseline); 0 new errors (`reports/lint-checkpoint-final.txt`) — one new lint error *was* introduced mid-pass (`prefer-const` in `rfp-store.ts`) and is fixed in the final commit |

**Save/reopen and frozen-publication evidence:** `scripts/validate-envelope-schema-version.ts` and `scripts/validate-procurement-room.ts`, both described above, are the direct evidence for these two specific blueprint requirements.

**MCP authority and audit evidence:** `scripts/validate-history-provenance.ts`, described above — proves the MCP-vs-web provenance distinction is correct in both directions (no missed receipts, no false ones).

**Files and schema changes** (full list, `caa437c`..`7e85a64`): 18 files, +1059/−17 lines. New files: `src/lib/procurement-room.ts`, `src/lib/history-provenance.ts`, `src/lib/rfp-export-docx.ts`, `src/components/SiteFooter.tsx`, `src/app/project/[id]/room/page.tsx`, and four new `scripts/validate-*.ts` fixtures (all wired into `npm run validate`). Schema change: one new optional field, `ProjectDetails.envelope_schema_version` (backward-compatible; every existing record still validates unchanged). New production dependency: `docx@9.7.1`.

## 4. What remains genuinely missing (using your required labels, no exceptions)

- Checkpoint B: **PARTIALLY IMPLEMENTED** — the migration *mechanism* is real and tested; no structural migration has ever actually been needed yet (there is nothing to migrate FROM), so the upgrade branch itself is a documented no-op until a real one is needed.
- Checkpoint C: **MISSING** — a dedicated MCP log/dashboard and a pre-action Propose/Approve gate for state-mutating MCP tool calls.
- Checkpoint D: **MISSING** — per-lifecycle-state visual treatment (ready-to-publish, publication-failed) beyond the existing generic UI.
- Checkpoint E: **MISSING** — a true server-generated PDF binary (the print-to-PDF path is unchanged, pre-existing, and honestly documented as an approximation).
- Checkpoint F: **MISSING** — a full audit against the blueprint's complete visual no-go list beyond the four items you specifically flagged.
- Residual from Checkpoint A, still open: the marketing hero comment above is new evidence it isn't a bug; no other residual items changed.

## 5. Requested approval

Nothing here has been pushed, merged, or deployed — six commits sit locally on `living-procurement-2030-shell`, final SHA `7e85a64a1ef221356222c208118e2573ee976fb5`. Per your stop conditions, I'm asking for one explicit approval covering: push to `origin`, merge to `main`, allow production deployment, and run production smoke-testing against the result.

If you'd like me to continue into a deeper pass on any specific one of the MISSING items above (the PDF binary, the MCP approval gate, or the lifecycle-state visuals are the three with the most product weight, in my view), say so and I'll continue in the same cadence — nothing above is blocked, it's a matter of which slice you want next.
