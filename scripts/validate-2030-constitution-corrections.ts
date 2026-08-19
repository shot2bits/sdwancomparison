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

import { readFileSync } from "node:fs";
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
    record(/lg:max-h-\[min\(60vh,calc\(100vh-170px\)\)\]/.test(desk), "2: the Mission Control card keeps a static lg: max-height cap now that no JS measurement feeds it", "");
    record(/className="relative border-b"/.test(desk), "2: the composer's outer wrapper is relatively positioned (no longer fixed/inset-x-0/bottom-0), matching Robert's 19 Aug 2026 request to move it inline near the top", "");
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
    record(!/mcExpanded \? "pb-\[150px\]" : "pb-6"/.test(desk), "3: the mobile aside no longer branches its bottom padding on mcExpanded (no fixed dock left to conditionally clear)", "");
    record(/order-1 mb-6 pb-6 lg:sticky lg:top-\[132px\]/.test(desk), "3: the mobile aside carries a plain, unconditional pb-6 instead", "");
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
    record(/nf-lilac-on-dark,\s*#[0-9A-Fa-f]{6}/.test(desk), "5: the MCP RECEIPT label uses the violet (lilac-on-dark) token, distinct from the orange \"Agent proposed\" and cobalt \"MCP evidence\" tags, and accessibility-corrected for its dark-card background", "");
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
    record(/stroke="var\(--nf-emerald/.test(arch) && /fill="var\(--nf-emerald/.test(arch), "6: edges and their arrowheads use the emerald token, matching the mockups' green connecting lines", "");
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
    record(
      /revision: clientDocParsed\.data\.lastRevision,/.test(envelope),
      "7: envelope.ts's canonical-envelope recompute (both create AND update) now trusts the client's own validated lastRevision instead of guessing server-side (fixes a real false-positive 409 on every project's first save AND its next edit-then-save/publish, both confirmed via live Playwright runs against a local KV store)",
      "",
    );

    const desk = src("src/components/ProjectDesk.tsx");
    record(/: "No blocking decisions"/.test(desk), "7: Mission Control's zero-material-decisions heading reads \"No blocking decisions\", never \"Nothing material outstanding\" (which could render directly above a visible card grid)", "");
    record(!/"Nothing material outstanding"/.test(desk), "7: the old contradictory \"Nothing material outstanding\" string is fully removed from ProjectDesk.tsx", "");
    record(/Optional refinements/.test(desk), "7: non-blocking question cards shown when nothing is material get their own \"Optional refinements\" label, never left unlabelled under a \"no blocking decisions\" heading", "");
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

    const header = src("src/components/WorkspaceHeader.tsx");
    record(/inline-flex items-center py-3/.test(header), "7: the workspace header's account/board nav links carry real vertical padding, growing their touch target from a measured 50x17px to ~41px tall without changing the header's visible height", "");

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
  /* 8. Typeface: superseded a second time, 19 Aug 2026 (handoff-bundle */
  /*    restyle). The 18 Aug system-font-only decision stands for the   */
  /*    sitewide root layout (src/app/layout.tsx) and marketing pages   */
  /*    -- untouched by this pass. But the handoff bundle's own spec    */
  /*    explicitly calls for Space Grotesk (headings/labels) and        */
  /*    JetBrains Mono (ids/stat numbers), scoped strictly to the       */
  /*    .procurement-2030 workspace surface -- a deliberate, knowing    */
  /*    reversal of the system-font-only rule for that one surface,     */
  /*    not a regression. Self-hosted the same way Inter was (next/     */
  /*    font/local, since this sandbox's build has no network path to   */
  /*    fonts.googleapis.com), but wired up in the (workspace) route    */
  /*    group's own layout.tsx / src/lib/workspace/fonts.ts, never in   */
  /*    the sitewide src/app/layout.tsx -- so the checks below still    */
  /*    hold the root layout to the system-font-only rule, while        */
  /*    asserting the workspace tokens now deliberately reference the   */
  /*    new webfonts instead of the system stack.                       */
  /* ================================================================ */
  {
    const layout = src("src/app/layout.tsx");
    record(!/from "next\/font\/google"/.test(layout), "8: src/app/layout.tsx (sitewide root layout) does not import from next/font/google", "");
    record(!/from "next\/font\/local"/.test(layout), "8: src/app/layout.tsx does not import from next/font/local either -- the sitewide/marketing surface still loads no custom webfont, per Robert's 18 Aug 2026 request; the 19 Aug 2026 handoff bundle's webfonts are scoped to the (workspace) route group's own layout instead", "");
    record(!/variable:\s*"--font-inter"/.test(layout) && !/className=\{inter\.variable\}/.test(layout), "8: layout.tsx no longer wires up an actual --font-inter variable binding (a comment may still reference the retired identifier by name for context)", "");

    const workspaceLayout = src("src/app/(workspace)/layout.tsx");
    record(/from "@\/lib\/workspace\/fonts"/.test(workspaceLayout), "8: the (workspace) route group's own layout.tsx -- not the sitewide root layout -- loads the handoff bundle's self-hosted fonts", "");

    const globals = src("src/app/globals.css");
    record(!/var\(--font-inter\)/.test(globals), "8: globals.css's font tokens no longer reference var(--font-inter) anywhere", "");
    record(
      /--nf-font-serif:\s*var\(--font-space-grotesk\)/.test(globals) &&
        /--nf-font-sans:\s*-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;/.test(globals) &&
        /--nf-font-mono:\s*var\(--font-jetbrains-mono\)/.test(globals),
      "8: --nf-font-serif and --nf-font-mono deliberately reference the handoff bundle's self-hosted Space Grotesk / JetBrains Mono webfonts (19 Aug 2026), while --nf-font-sans stays the native system UI stack for body text, matching the handoff's typography rule exactly",
      "",
    );
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
