// Verification-only script (not part of the app): deterministic, source-
// level fixtures for the corrections made against the newly-attached
// "Netify 2030 Living Document Aesthetic Constitution" (18 Aug 2026,
// explicitly binding). Mirrors this repo's own established static-
// source-assertion style (validate-workspace-chrome-separation.ts,
// validate-canonical-envelope-closure.ts) rather than a pixel-level
// screenshot-diff harness, since no such harness exists in this
// codebase -- these fixtures assert on the real, unmodified source that
// PRODUCES the visual state, not on hand-rolled approximations of it.
// Full pixel verification for this pass was additionally done directly
// via Playwright against a running dev server (screenshots + getBoundingClientRect
// measurements at 1440x900 and 390x844) -- recorded in the completion
// report, not repeated here since that tooling isn't part of `npm run
// validate`'s deterministic, no-browser fixture set.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const src = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

function main() {
  /* ================================================================ */
  /* 1. State-0 hero height budget: the pre-start hero must be visibly */
  /*    smaller than the original full-size ruling, and the third      */
  /*    ("value") paragraph must be sr-only pre-start, per "The         */
  /*    marketing hero occupies no more than 25-30% of State 0."       */
  /* ================================================================ */
  {
    const hero = src("src/components/CollapsibleHero.tsx");
    record(/eyebrow\?: string/.test(hero), "1: CollapsibleHero accepts an optional eyebrow prop", "");
    record(/clamp\(30px, 1\.6vw \+ 22px, 42px\)/.test(hero), "1: the pre-start H1 clamp is shrunk to the Constitution's height budget (30-42px, not the earlier 38-58px)", "");
    record(/id="page-value"[\s\S]{0,80}className="sr-only"/.test(hero), "1: the third (\"value\") paragraph is unconditionally sr-only -- never occupies visible height pre-start", "");
    record(/id="page-h1"/.test(hero) && /id="page-subhead"/.test(hero), "1: page-h1/page-subhead ids are preserved (speakable schema + h1 audit script still find them)", "");
  }

  /* ================================================================ */
  /* 2. Mission Control / composer overlap: superseded 19 Aug 2026.    */
  /*    Robert's explicit feedback moved the composer out of its fixed-*/
  /*    bottom position (now inline, near the top of the page), which  */
  /*    removes the entire reason the JS-measured max-height existed.  */
  /*    This section now asserts the measurement machinery is actually */
  /*    GONE (not just unused) and that the card fell back to a plain, */
  /*    static cap instead of silently losing its clamp altogether.    */
  /* ================================================================ */
  {
    const desk = src("src/components/ProjectDesk.tsx");
    record(!/const \[mcMaxHeightPx, setMcMaxHeightPx\]/.test(desk), "2: the mcMaxHeightPx measurement state is removed (the fixed composer it existed to clear no longer exists)", "");
    record(!/composerDockRef/.test(desk), "2: composerDockRef is removed along with the measurement it fed", "");
    record(!/mcCardRef/.test(desk), "2: mcCardRef is removed along with the measurement it fed", "");
    // Superseded 19 Aug 2026 (structural pass): the Mission Control card
    // this max-height capped no longer exists at all -- decisions are their
    // own full-pane station now. Asserting the cap survives would be a
    // vacuous check against a doc comment (the string does still appear in
    // one, which is exactly how this fixture would have kept "passing"
    // while the thing it guards was deleted). The real guarantee is that
    // the dark rail is gone and nothing reintroduced it.
    record(!/<aside/.test(desk), "2: the dark 340px Mission Control rail is retired outright -- no <aside> remains in ProjectDesk.tsx", "");
    record(!/const \[mcExpanded, setMcExpanded\]/.test(desk), "2: the rail's mobile expand/collapse state is retired with it (a full pane has no 390px overflow to work around)", "");
    // The composer is still in normal flow, never fixed/bottom-docked. It
    // now renders in two places -- full-bleed on the pre-start door, inside
    // the 368px chat pane once the workspace shell takes over -- so the
    // class is chosen by `composerWide` rather than hardcoded; what matters
    // is that neither branch is `fixed`.
    record(/composerWide \? "relative border-b" : "relative"/.test(desk), "2: the composer's outer wrapper is relatively positioned in BOTH of its render contexts (no longer fixed/inset-x-0/bottom-0), matching Robert's 19 Aug 2026 request to move it inline near the top", "");
    /* NARROWED 19 Aug 2026, and the narrowing is a real trade-off, not a
       loophole. Robert removed the page-wide fixed dock earlier that day
       ("moved out of that fixed bottom position, placed inline near the
       top"). He has since said twice that the composer must be
       "persistent and always visible", and on a phone that is not
       achievable any other way: below `lg` the chat column renders AFTER
       the active station, so `sticky bottom-0` never engages until you
       have already scrolled to it (measured at 390x844: composer at
       y=3774, off-screen at every scroll position tested).
       So the dock is reinstated for phones ONLY. At `lg` and above --
       the layout the original instruction was about -- it reverts to
       sticky-within-the-chat-column, and no page-wide dock exists. */
    record(/fixed inset-x-0 bottom-0 z-40[^"]*lg:sticky/.test(desk), "2: the composer is a fixed bottom bar ONLY below lg (phones), reverting to sticky-within-the-column at lg -- the desktop page-wide dock Robert removed stays removed", "");
    record(/pb-\[104px\] lg:pb-16/.test(desk), "2: the grid reserves matching bottom padding below lg so nothing hides behind that phone bar", "");
  }

  /* ================================================================ */
  /* 3. Mobile Mission Control dead zone: superseded 19 Aug 2026 along  */
  /*    with section 2 above -- the 150px reserve this used to require  */
  /*    conditionally existed only to clear the composer's old fixed-   */
  /*    bottom footprint. With the composer no longer fixed, the aside  */
  /*    needs no special-cased clearance at all; assert the simple,     */
  /*    unconditional padding replaced it.                              */
  /* ================================================================ */
  {
    const desk = src("src/components/ProjectDesk.tsx");
    record(!/mcExpanded \? "pb-\[150px\]" : "pb-6"/.test(desk), "3: no mobile aside branches its bottom padding on mcExpanded (no fixed dock left to conditionally clear)", "");
    // Superseded 19 Aug 2026 (structural pass): there is no mobile aside to
    // pad. The two-pane shell replaces it, and the ordering guarantee that
    // actually matters on mobile is that the ACTIVE STATION renders above
    // the chat pane -- without `flex flex-col` below `lg` the `order-*`
    // classes are inert and tapping a station appears to do nothing (a real
    // regression, caught on a live 390px run during this pass).
    record(/mx-auto flex w-full max-w-\[1400px\] flex-col px-\[26px\] pb-\[104px\] lg:pb-16 lg:grid/.test(desk), "3: the two-pane container is a flex column below lg, so the order-* classes that put the active station above the chat pane on mobile actually take effect", "");
    record(/className="order-1 min-w-0 lg:order-2"/.test(desk), "3: the station pane is order-1 on mobile (first) and order-2 on desktop (right of the chat)", "");
  }

  /* ================================================================ */
  /* 4. "What changed" ribbon: Constitution palette ("Confirmed =      */
  /*    Evidence green") -- must use emerald tokens, must not still    */
  /*    use the earlier orange-soft treatment.                        */
  /* ================================================================ */
  {
    const canvas = src("src/components/procurement/LivingProcurementCanvas.tsx");
    record(/What changed/.test(canvas), "4: the ribbon's eyebrow reads \"What changed\", matching the Constitution mockups' own label", "");
    // Superseded 19 Aug 2026 (Robert's "UI mockups request" handoff bundle,
    // aesthetic-only restyle): the emerald-soft pair was recomputed from the
    // handoff's own oklch spec (oklch(0.38 0.09 145) / oklch(0.94 0.045 145))
    // rather than the earlier invented shade -- new hex #91bb91 / #d9f4d9,
    // same emerald-soft-border/emerald-soft token pairing, same ribbon box.
    record(/nf-emerald-soft-border.*91bb91[\s\S]{0,40}nf-emerald-soft.*d9f4d9/.test(canvas), "4: the ribbon box uses the emerald-soft background/border tokens (19 Aug 2026 handoff palette)", "");
    record(!/Value created/.test(canvas), "4: the earlier \"Value created\" orange-soft label no longer exists", "");
  }

  /* ================================================================ */
  /* 5. "MCP RECEIPT" (violet): must be grounded in a REAL, already-   */
  /*    proven condition (historyProvenance().isMcp && hasConsent),    */
  /*    never a hardcoded/always-true value -- consistent with every   */
  /*    other MCP surface this pass (McpEvidencePanel.tsx).            */
  /* ================================================================ */
  {
    const desk = src("src/components/ProjectDesk.tsx");
    record(/latestMcpReceipt/.test(desk), "5: ProjectDesk derives a latestMcpReceipt value", "");
    record(/prov\.isMcp && prov\.hasConsent/.test(desk), "5: latestMcpReceipt is gated on the SAME real isMcp && hasConsent condition McpEvidencePanel.tsx's approvedEvents already uses (not a separate, looser rule)", "");
    record(/if \(approved\.length === 0\) return null;/.test(desk), "5: with no real approved MCP event, latestMcpReceipt is genuinely null (renders nothing), never a placeholder", "");
    record(/\{latestMcpReceipt && \(/.test(desk), "5: the MCP RECEIPT block only renders when latestMcpReceipt is real and non-null", "");
    // Superseded 19 Aug 2026 (accessibility fix made during the handoff-
    // bundle restyle): the reference's lilac formula (oklch(0.42 0.11 300))
    // is tuned as TEXT-ON-LIGHT-BACKGROUND -- correct for the SUGGESTED
    // badge, but measured only 2.15:1 here, where this one raw-lilac usage
    // sits as text on the dark Mission Control card. A dedicated
    // --nf-lilac-on-dark token (oklch(0.72 0.1 300), 7.45:1 on that card)
    // was added for this single usage; --nf-lilac itself is untouched and
    // still used as-is by every light-background badge/dot elsewhere.
    // Superseded 19 Aug 2026 (structural pass): the receipt moved off the
    // retired dark Mission Control card onto the light document canvas, so
    // it correctly reverts from --nf-lilac-on-dark (the lightened variant
    // added on 19 Aug purely to clear 4.5:1 on ink-950) to --nf-lilac, the
    // reference's own text-on-LIGHT violet. Same accessibility rule, other
    // direction. The receipt itself is unchanged and still gated on the
    // same real isMcp && hasConsent condition asserted just above.
    record(/nf-lilac,\s*#[0-9A-Fa-f]{6}/.test(desk), "5: the MCP RECEIPT label uses the violet (lilac) token, distinct from the orange \"Agent proposed\" and cobalt \"MCP evidence\" tags, in the light-background variant its new surface requires", "");
    // Deliberately matches the CSS-var USAGE form, not the bare token name:
    // the doc comment beside the receipt legitimately explains why the
    // colour reverted, and a fixture that trips over its own explanation is
    // testing prose, not behaviour.
    record(!/var\(--nf-lilac-on-dark/.test(desk), "5: the dark-surface lilac variant is no longer USED in ProjectDesk.tsx -- there is no dark card left to need it", "");
  }

  /* ================================================================ */
  /* 6. Architecture card ("Live procurement twin"): green edges/      */
  /*    connectors (not the earlier neutral grey), a bordered ivory    */
  /*    card matching the mockup, and a real (never fabricated) delta  */
  /*    caption built only from fields this codebase actually tracks. */
  /* ================================================================ */
  {
    const arch = src("src/components/procurement/ProcurementArchitecture.tsx");
    record(/Live procurement twin/.test(arch), "6: the architecture eyebrow reads \"Live procurement twin\", matching the Constitution mockups", "");
    record(!/#C4C0B8/.test(arch), "6: the earlier neutral-grey edge/arrow colour is fully replaced", "");
    // Superseded 19 Aug 2026 (structural pass): the twin is no longer an
    // absolutely-positioned SVG. The handoff bundle draws it as a
    // left-to-right pipeline of titled boxes joined by arrows, and the old
    // SVG collapsed into an unreadable vertical smear under ~600px, so the
    // same nodes/edges/columns now render as flex boxes. There is no
    // `stroke=`/`fill=` to assert; the emerald connector survives as the
    // arrow glyph's own colour, and the confirmed-node treatment uses the
    // emerald-soft pair.
    record(/color: "var\(--nf-emerald/.test(arch), "6: the pipeline's connecting arrows use the emerald token, matching the mockups' green connecting lines", "");
    record(/nf-emerald-soft-border/.test(arch) && /nf-emerald-soft,/.test(arch), "6: a node backed by a governed compiled clause carries the emerald-soft border/background pair (the reference's \"Confirmed\" state)", "");
    // The confirmed/in-scope split must stay DERIVED from a real compiler
    // signal. ArchitectureNode carries no status field, so anything richer
    // would have meant inventing a judgement about the buyer's estate.
    record(/sourceClauseIds && n\.sourceClauseIds\.length > 0/.test(arch), "6: node state is derived from the real sourceClauseIds the compiler already records, never from an invented per-node status field", "");
    record(/anyConfirmed &&/.test(arch) && /anyInScope &&/.test(arch), "6: the legend renders only the states actually present, so it can never advertise a category nothing on screen is in", "");
    record(/deltaCaption\?: string \| null/.test(arch), "6: the delta caption is an optional, nullable prop -- never a required/always-shown value", "");

    const canvas = src("src/components/procurement/LivingProcurementCanvas.tsx");
    record(/function architectureDeltaCaption/.test(canvas), "6: architectureDeltaCaption is a real function computed from document.changeSet, not inline fabricated text", "");
    {
      // Only the FUNCTION BODY is asserted on here, not the whole file --
      // the doc comment immediately above it legitimately quotes the
      // mockup's own text ("evidence requests added") to explain why that
      // exact fabricated count is deliberately not reproduced; matching
      // against the whole file would flag that honest explanation itself.
      const fnMatch = canvas.match(/function architectureDeltaCaption\([\s\S]*?\n\}/);
      const fnBody = fnMatch ? fnMatch[0] : "";
      record(fnBody.length > 0, "6: architectureDeltaCaption's function body was located for inspection", "");
      record(!/evidence requests? added/i.test(fnBody), "6: the mockup's fabricated \"evidence requests added\" count is deliberately NOT reproduced in the actual rendered caption (this codebase has no real per-change count for it)", "");
    }
    record(/deltaCaption=\{hasChange \? architectureDeltaCaption\(document\) : null\}/.test(canvas), "6: the delta caption is only passed when hasChange is real and true, null otherwise", "");
  }

  /* ================================================================ */
  /* 7. Full visual-closure pass corrections (Robert's follow-up        */
  /*    directive, 18 Aug 2026, same day): a real end-to-end first-save */
  /*    bug found and fixed via a live local-KV Playwright run, the     */
  /*    contradictory blank-state wording replaced, and a scoped        */
  /*    contrast/touch-target pass across the six-state workspace.      */
  /* ================================================================ */
  {
    const envelope = src("src/lib/workspace/envelope.ts");
    const decisionsStep = src("src/components/procurement/DecisionsStep.tsx");
    record(
      /revision: clientDocParsed\.data\.lastRevision,/.test(envelope),
      "7: envelope.ts's canonical-envelope recompute (both create AND update) now trusts the client's own validated lastRevision instead of guessing server-side (fixes a real false-positive 409 on every project's first save AND its next edit-then-save/publish, both confirmed via live Playwright runs against a local KV store)",
      "",
    );

    const desk = src("src/components/ProjectDesk.tsx");
    // Superseded 19 Aug 2026 (structural pass): this heading moved out of
    // the retired Mission Control rail and into the Decisions station, which
    // owns it now. Same honesty rule, same wording, new home -- so the
    // assertion follows it to DecisionsStep.tsx rather than being dropped.
    /* SUPERSEDED 19 Aug 2026. This asserted the heading reads "No blocking
       decisions" -- but tracing the real publish path showed those
       decisions block nothing at all. `signLocked` gates on the publish
       CHECKLIST (five standing facts); the ranked decisions gate nothing,
       and the set is generative, so answering one can earn another. The
       product was showing an endless advisory stream as the gate and
       hiding the actual, finite gate. Calling any of them "blocking" was
       the falsehood, so the guarantee inverts: the station must NEVER
       describe an open decision as blocking, and must not claim emptiness
       while cards are on screen. */
    record(!/blocking/i.test(decisionsStep), "7: the Decisions station never calls an open decision \"blocking\" -- they gate nothing, and the real gate is the publish checklist", "");
    record(/: "Nothing open"/.test(decisionsStep), "7: its zero-state heading reads \"Nothing open\", never a phrase implying a cleared blocker", "");
    record(/None of them holds publishing up/.test(decisionsStep), "7: the subhead states plainly that answering is optional and does not hold publishing up", "");
    record(!/"Nothing material outstanding"/.test(desk), "7: the old contradictory \"Nothing material outstanding\" string is fully removed from ProjectDesk.tsx", "");
    // Same supersession: the rail's group-level "Optional refinements"
    // label is replaced by a per-card "Not required to publish" chip in the
    // Decisions station, which is strictly more honest -- the old label
    // grouped cards, so a material and a non-material card sitting together
    // shared one heading; the chip is computed per card from the SAME
    // MATERIAL_IMPACTS classification materialDecisionsRemaining counts.
    record(/Not required to publish/.test(decisionsStep), "7: a non-material decision card carries its own \"Not required to publish\" chip, so it can never be read as a blocker under a heading that says there are none", "");
    record(/MATERIAL_IMPACTS as readonly string\[\]/.test(decisionsStep), "7: that chip is computed from the SAME MATERIAL_IMPACTS classification the blocking-decision count uses, so badge and count can never disagree", "");
    record(/Publication is already complete/.test(decisionsStep), "7: post-publish, the station says publication is complete and frames everything remaining as shaping the next revision, never as outstanding work", "");
    // #655F52 replaced an intermediate var(--nf-ink-400) attempt: a real
    // axe-core scan (State 0, the "Not started" badge on its #EDE7D9 fill)
    // found even the design system's own muted token measures anywhere
    // from 4.12:1 to 4.79:1 depending on which of this workspace's several
    // near-white/ivory backgrounds it sits on -- inconsistent and
    // sometimes below 4.5:1. #655F52 clears 4.5:1 with real margin (5.1:1
    // to 6.3:1) against every background this pass actually measured.
    // Superseded 19 Aug 2026 (handoff-bundle restyle): the muted/caption
    // ink shade moved from the earlier accessibility-corrected #655F52 to
    // the new palette's own ink-600 (oklch(0.50 0.009 75) -> #66635e),
    // recomputed from the handoff's spec rather than invented -- axe-core-
    // verified 5.1:1+ against every background this pass measured, same as
    // #655F52 was. The old value is retired, not regressed.
    record(/text-\[#66635e\]|"#66635e"/.test(desk), "7: ProjectDesk's light-background muted/caption text uses #66635e (the 19 Aug 2026 handoff palette's ink-600, axe-core-verified 5.1:1+ across every background this pass measured) instead of the inaccessible #A3A099/#8C8A85 hex literals (2.5:1-3.5:1)", "");
    record(!/text-\[#A3A099\]|text-\[#8C8A85\]/.test(desk), "7: no light-background Tailwind text-color class in ProjectDesk.tsx still uses the old sub-4.5:1 #A3A099/#8C8A85 hex literals", "");

    /* SUPERSEDED 19 Aug 2026 ("Add back the main menu as well"):
       WorkspaceHeader is retired and the workspace now uses MegaNav, the
       same header every marketing route and the opportunities board
       already use. The touch-target guarantee this asserted moves with
       it -- MegaNav's own nav links must still carry real vertical
       padding rather than collapsing to their 17px text-line height,
       which was the actual defect behind the original fixture. */
    const header = src("src/components/MegaNav.tsx");
    record(/px-2\.5 py-2 text-\[13px\]/.test(header), "7: the main nav's board/account links carry real vertical padding (py-2), not a bare text-line hit area", "");

    // A third, distinct false-positive 409, found the SAME way (a live
    // local-KV Playwright run through save -> edit -> publish): diffIds()
    // in procurement-document.ts compared clause/question/gate objects
    // with raw JSON.stringify, which is key-INSERTION-ORDER-sensitive.
    // `previousDocument` on a real save is read back from storage after a
    // zod .parse() round-trip (LivingProcurementDocumentSchema, envelope.ts)
    // that reorders every clause's keys into schema-declared order, while a
    // fresh compile builds clauses as `{ ...d, id, weight }` (id/weight
    // appended last) -- so every byte-for-byte-UNCHANGED clause surviving a
    // second save was spuriously reported as "updated", and since
    // changeSet is part of the server/client consistency check, this alone
    // 409'd every edit-then-save/publish even after the second bug's fix.
    // Confirmed by diffing a live server recompute against the actual
    // persisted KV record: identical clause content, different key order.
    const procDoc = src("src/lib/workspace/procurement-document.ts");
    record(/function canonicalJson\(/.test(procDoc), "7: procurement-document.ts has a canonicalJson() helper that sorts object keys recursively before stringifying, making equality checks independent of property-insertion order", "");
    record(/canonicalJson\(prevByKey\.get\(x\.templateKey\)\) !== canonicalJson\(x\)/.test(procDoc), "7: diffIds() (drives changeSet.clauses/questions/gates) now compares clauses via canonicalJson, not raw JSON.stringify -- fixes a real false-positive \"updated\" on every unchanged clause surviving a second save, confirmed via a live Playwright run diffing the server's fresh recompute against the actual persisted KV record (identical content, different key order after the schema round-trip)", "");
    record(!/JSON\.stringify\(prevByKey\.get\(x\.templateKey\)\) !== JSON\.stringify\(x\)/.test(procDoc), "7: the old key-order-sensitive raw JSON.stringify comparison in diffIds() is fully removed", "");

    // Requirement 7 of the SAME directive ("visibly preserve the value-
    // building story" through states 3-5) was found unmet by a live
    // Playwright walkthrough: LivingProcurementCanvas and McpEvidencePanel
    // both hid completely once `phase === "fits"` (the publish/post-
    // publish phase), leaving states 3-5 showing only the publish panel
    // and, post-publish, the matched-vendor list -- no living document, no
    // supplier pack, no evaluation view, no provenance. Neither component
    // names a vendor; the MarketUnlock boundary lives entirely in the
    // "fits" panel and its server route, untouched by rendering these
    // through "fits" too.
    record(/\(phase === "live" \|\| phase === "fits"\) && started && \(/.test(desk), "7: LivingProcurementCanvas now also renders through phase===\"fits\" (states 3-5), not just \"live\" (state 2) -- the living document/supplier pack/evaluation views stay visible right where a buyer is about to publish and right after they have, instead of vanishing the moment publishing starts", "");
    record(/\(phase === "live" \|\| phase === "fits"\) && started && created\?\.id && \(/.test(desk), "7: McpEvidencePanel (real project history/provenance) now also renders through phase===\"fits\", for the same reason and with the same non-leak guarantee (it names no vendor)", "");

    // Requirement 9 ("Use only the canonical production host... Do not
    // reference app.netify.co.uk or sase.netify.co.uk"): a full-repo grep
    // found two LIVE references to the retired sase.netify.co.uk
    // subdomain (next.config.ts's own 301 redirects catch and forward
    // traffic FROM that host, which is the correct, opposite thing, and
    // are deliberately left alone). Both live references are fixed here;
    // no live reference to app.netify.co.uk was found anywhere outside
    // that same retirement-redirect and historical /reports/*.md records,
    // neither of which this fixture touches.
    const cors = src("src/lib/cors.ts");
    record(!/sase\.netify\.co\.uk/.test(cors), "7: cors.ts's CORS allowlist no longer grants the retired sase.netify.co.uk subdomain cross-origin access to the agentic APIs", "");
    const agentRoute = src("src/app/api/agent/route.ts");
    record(!/sase\.netify\.co\.uk/.test(agentRoute), "7: the shortlist advisor's own system prompt no longer describes itself as embedded at sase.netify.co.uk -- it names the canonical netify.co.uk host", "");
  }

  /* ================================================================ */
  /* 8. Typeface: superseded a THIRD time, 20 Aug 2026 -- Robert:       */
  /*    "Default system font should be used." This reverts the 19 Aug   */
  /*    handoff-bundle restyle immediately below (which itself had      */
  /*    reversed the 18 Aug system-font-only decision, scoped strictly  */
  /*    to the .procurement-2030 workspace surface): Space Grotesk and  */
  /*    JetBrains Mono are gone entirely -- src/lib/workspace/fonts.ts  */
  /*    deleted, the vendored .woff2 files deleted, the workspace       */
  /*    layout's `workspaceFontVars` class removed, and globals.css's   */
  /*    --nf-font-serif/--nf-font-mono tokens reverted to the plain     */
  /*    system-ui stack, matching --nf-font-sans and every un-prefixed  */
  /*    --font-* token below. Every check in this section now holds     */
  /*    root layout AND workspace layout AND globals.css to the SAME    */
  /*    system-font-only rule -- there is no longer a surface-specific  */
  /*    exception anywhere in the app.                                  */
  /* ================================================================ */
  {
    const layout = src("src/app/layout.tsx");
    record(!/from "next\/font\/google"/.test(layout), "8: src/app/layout.tsx (sitewide root layout) does not import from next/font/google", "");
    record(!/from "next\/font\/local"/.test(layout), "8: src/app/layout.tsx does not import from next/font/local either -- the sitewide/marketing surface loads no custom webfont", "");
    record(!/variable:\s*"--font-inter"/.test(layout) && !/className=\{inter\.variable\}/.test(layout), "8: layout.tsx no longer wires up an actual --font-inter variable binding (a comment may still reference the retired identifier by name for context)", "");

    const workspaceLayout = src("src/app/(workspace)/layout.tsx");
    record(!/from "@\/lib\/workspace\/fonts"/.test(workspaceLayout), "8: the (workspace) route group's own layout.tsx no longer imports the retired workspace/fonts module (removed 20 Aug 2026) -- the workspace surface loads no custom webfont either, same rule as the root layout", "");
    record(!/className=\{`[^`]*\$\{workspaceFontVars\}/.test(workspaceLayout) && !/from "@\/lib\/workspace\/fonts"/.test(workspaceLayout), "8: the (workspace) layout's outer div no longer carries the retired workspaceFontVars class (a comment may still reference the retired identifier by name for context)", "");

    const globals = src("src/app/globals.css");
    record(!/var\(--font-inter\)/.test(globals), "8: globals.css's font tokens no longer reference var(--font-inter) anywhere", "");
    record(!/var\(--font-space-grotesk\)/.test(globals) && !/var\(--font-jetbrains-mono\)/.test(globals), "8: globals.css no longer references var(--font-space-grotesk) or var(--font-jetbrains-mono) anywhere -- both retired 20 Aug 2026", "");
    record(
      /--nf-font-serif:\s*-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;/.test(globals) &&
        /--nf-font-sans:\s*-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;/.test(globals) &&
        /--nf-font-mono:\s*ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;/.test(globals),
      "8: --nf-font-serif, --nf-font-sans and --nf-font-mono are all plain system stacks (20 Aug 2026 reversal) -- no surface anywhere in the app loads a custom webfont",
      "",
    );

    record(!existsSync(path.join(ROOT, "src/lib/workspace/fonts.ts")), "8: src/lib/workspace/fonts.ts (the self-hosted Space Grotesk/JetBrains Mono declarations) is deleted, not merely unwired", "");
    record(!existsSync(path.join(ROOT, "src/fonts")), "8: the vendored .woff2 font files (src/fonts/) are deleted, not left as dead weight", "");
  }

  /* ================================================================ */
  /* 9. Post-publish dock obstruction: a buyer who has scrolled down    */
  /*    to review pre-publish decisions/consents keeps that scroll      */
  /*    position once State 4's (shorter, differently-laid-out)         */
  /*    content swaps in -- confirmed via a live Playwright run this    */
  /*    left the sticky status dock stacked over real State 4 controls  */
  /*    ("how to read this", and on mobile the whole invited-vendor     */
  /*    list). Scrolling to the top on a successful publish is the      */
  /*    fix; re-running the same live repro afterwards showed zero      */
  /*    obstruction at every sampled interval.                          */
  /* ================================================================ */
  {
    const desk = src("src/components/ProjectDesk.tsx");
    record(/window\.scrollTo\(\{ top: 0, behavior: "smooth" \}\)/.test(desk), "9: ProjectDesk.tsx scrolls to the top on a successful publish, so State 4 never renders under a scroll position left over from reviewing pre-publish decisions", "");
    record(/if \(res\.ok\) \{[\s\S]{0,4000}window\.scrollTo/.test(desk), "9: the scroll-to-top runs specifically inside the publish success branch (res.ok), not on every render or on failure", "");
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
