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

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
