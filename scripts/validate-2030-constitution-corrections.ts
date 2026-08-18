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
  /* 2. Mission Control / fixed composer overlap: a JS-measured max-   */
  /*    height (not a static vh guess) must drive the card's clamp,    */
  /*    and the measurement must be taken at the natural (unscrolled,  */
  /*    worst-case) position, never trusted mid-scroll.                */
  /* ================================================================ */
  {
    const desk = src("src/components/ProjectDesk.tsx");
    record(/const \[mcMaxHeightPx, setMcMaxHeightPx\]/.test(desk), "2: ProjectDesk carries a measured mcMaxHeightPx state (not a hardcoded constant alone)", "");
    record(/mcCardRef = useRef<HTMLDivElement/.test(desk) && /composerDockRef = useRef<HTMLDivElement/.test(desk), "2: both the Mission Control card and the fixed composer dock carry real refs for measurement", "");
    record(/if \(window\.scrollY > 4\) return;/.test(desk), "2: the measurement effect refuses to trust a mid-scroll (already-stuck) position, which would under-constrain the card", "");
    record(/new ResizeObserver\(\(\) => measure\(\)\)/.test(desk), "2: a ResizeObserver re-measures on any layout change (hero collapse settling, async content), not just on mount", "");
    record(/ref=\{mcCardRef\}/.test(desk) && /ref=\{composerDockRef\}/.test(desk), "2: both refs are actually attached to their JSX elements", "");
    record(/--mc-max-h/.test(desk), "2: the measured value reaches the card only through the lg:-scoped CSS variable (never applied below lg, matching the mobile collapse's own bounds)", "");
  }

  /* ================================================================ */
  /* 3. Mobile Mission Control dead zone: the 150px dock-clearance      */
  /*    padding must be conditional on the card actually being         */
  /*    expanded, not applied unconditionally to a two-line collapsed  */
  /*    summary.                                                       */
  /* ================================================================ */
  {
    const desk = src("src/components/ProjectDesk.tsx");
    record(
      /\$\{mcExpanded \? "pb-\[150px\]" : "pb-6"\}/.test(desk),
      "3: the mobile aside's bottom clearance is conditional on mcExpanded, not a flat pb-[150px] regardless of collapsed state",
      "",
    );
  }

  /* ================================================================ */
  /* 4. "What changed" ribbon: Constitution palette ("Confirmed =      */
  /*    Evidence green") -- must use emerald tokens, must not still    */
  /*    use the earlier orange-soft treatment.                        */
  /* ================================================================ */
  {
    const canvas = src("src/components/procurement/LivingProcurementCanvas.tsx");
    record(/What changed/.test(canvas), "4: the ribbon's eyebrow reads \"What changed\", matching the Constitution mockups' own label", "");
    record(/nf-emerald-soft-border.*9FCEB4[\s\S]{0,40}nf-emerald-soft.*DCEEE3/.test(canvas), "4: the ribbon box uses the emerald-soft background/border tokens", "");
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
    record(/nf-lilac,\s*#[0-9A-Fa-f]{6}/.test(desk), "5: the MCP RECEIPT label uses the violet (lilac) token, distinct from the orange \"Agent proposed\" and cobalt \"MCP evidence\" tags", "");
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
    record(/text-\[#655F52\]|"#655F52"/.test(desk), "7: ProjectDesk's light-background muted/caption text uses #655F52 (axe-core-verified 5.1:1+ across every background this pass measured) instead of the inaccessible #A3A099/#8C8A85 hex literals (2.5:1-3.5:1) or the marginal --nf-ink-400 token (4.12:1-4.79:1 depending on background)", "");
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
  /* 8. Production build hermeticity: `npm run build` (required        */
  /*    evidence for this pass) failed outright in a network-          */
  /*    restricted build environment because `next/font/google`        */
  /*    fetches the actual Inter font bytes from fonts.googleapis.com  */
  /*    at BUILD time, not just at first `next dev`. This is a build-  */
  /*    tooling fix, not a visual or product change: same Inter        */
  /*    typeface, same variable weight range (100-900), same latin     */
  /*    subset, same `--font-inter` CSS variable contract -- just      */
  /*    sourced from a font file checked into the repo instead of a    */
  /*    live network fetch during the build.                           */
  /* ================================================================ */
  {
    const layout = src("src/app/layout.tsx");
    record(!/from "next\/font\/google"/.test(layout), "8: src/app/layout.tsx no longer imports from next/font/google (which fetches Inter from fonts.googleapis.com at build time)", "");
    record(/next\/font\/local/.test(layout), "8: src/app/layout.tsx now sources Inter via next/font/local", "");
    record(/variable:\s*"--font-inter"/.test(layout), "8: the --font-inter CSS variable contract (referenced by globals.css's --font-display/--font-sans) is unchanged", "");
    record(/weight:\s*"100 900"/.test(layout), "8: the same variable weight range (100-900) that next/font/google previously fetched is preserved", "");
    record(existsSync(path.join(ROOT, "src/fonts/inter-variable-latin.woff2")), "8: the self-hosted Inter variable woff2 (latin subset) is checked into the repo at src/fonts/inter-variable-latin.woff2", "");
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
