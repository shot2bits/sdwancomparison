/**
 * Verification-only script (not part of the app).
 *
 * Robert, 20 Aug 2026, on a live tester pattern ("every tester is saying
 * they have no idea what is going on") and a direct instruction to fix
 * it: "Should the platform not tell the user what section they're
 * working on, provide advice on what to ask, tell the user how complete
 * they are but allow the user to complete. Tell the user that the AI
 * prompt will auto populate all sections... This needs to be better
 * thought out, a 2030 UI please... It's fine to totally change the UI...
 * it's the UI that's a massive mess." Confirmed via direct question:
 * the section outline REPLACES the five-station wizard as primary
 * navigation, and the rework ships as one full pass, not incrementally.
 *
 * THE REBUILD, guarded here:
 *  A. WizardRail.tsx is genuinely retired (deleted, not merely unwired)
 *     and SectionNav.tsx takes its render slot as primary navigation.
 *  B. SectionDetail renders ahead of the full document twin on the
 *     `describe` station -- "what section, why it matters, how complete,
 *     answerable in place" all in one pane, none of it removed elsewhere.
 *  C. Every real outline-row key the compiler can ever produce
 *     (buildSectionOutline, procurement-outline.ts) has a coaching entry
 *     -- a blank pane for a real section is exactly the "no idea what's
 *     going on" defect this exists to close.
 *  D. The multi-section update confirmation is real: diffOutlineSections
 *     behaves correctly on literal fixtures, and ProjectDesk only shows
 *     the banner at >=2 changed sections (a single-section change is
 *     already visible on its own row -- a banner on every click would be
 *     the SAME undifferentiated noise this rebuild removes elsewhere).
 *  E. The priming promise ("one message can fill several sections") is
 *     stated before a buyer has typed anything, honestly (round-6 law:
 *     no fabricated example sentence).
 *  F. The AnswerNext "fills section" footnote is a real jump link, not
 *     inert text, wired to the SAME section state the nav reads.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildSectionOutline, diffOutlineSections, type OutlineRow } from "../src/lib/workspace/procurement-outline";
import { coachingFor } from "../src/lib/workspace/section-coaching";

const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const src = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");
const exists = (...parts: string[]) => existsSync(path.join(ROOT, ...parts));

let failures = 0;
const record = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

const desk = src("src/components/ProjectDesk.tsx");
const nav = src("src/components/procurement/SectionNav.tsx");
const detail = src("src/components/procurement/SectionDetail.tsx");
const answerNext = src("src/components/procurement/AnswerNext.tsx");

/* ================================================================ */
/* A. WizardRail is genuinely retired, SectionNav is the primary nav. */
/* ================================================================ */
record(!exists("src/components/procurement/WizardRail.tsx"), "A: WizardRail.tsx is deleted, not left as unwired dead code");
record(exists("src/components/procurement/SectionNav.tsx"), "A: SectionNav.tsx exists");
record(!/<WizardRail/.test(desk), "A: ProjectDesk.tsx no longer renders <WizardRail");
record(/<SectionNav/.test(desk), "A: ProjectDesk.tsx renders <SectionNav in its place");
record(
  /data-sticky-chrome-end[\s\S]{0,80}<SectionNav/.test(desk),
  "A: SectionNav sits in the SAME sticky chrome slot the retired rail occupied (position/visual weight preserved)",
);
record(/rows=\{sectionOutline\}/.test(desk), "A: SectionNav is given the real sectionOutline, not a second computation");
record(/onSelect=\{\(key\) => \{ setActiveSection\(key\); goToStep\("describe"\); \}\}/.test(desk), "A: selecting a row sets the active section AND returns to the pane it renders in");

/* ================================================================ */
/* B. SectionDetail leads the `describe` station; the document twin   */
/*    (canvasBlock) is un-demoted, not removed.                       */
/* ================================================================ */
const describeBranchStart = desk.indexOf('activeStep === "describe" && (');
const describeBranchEnd = desk.indexOf('activeStep === "decisions" && (', describeBranchStart);
record(describeBranchStart !== -1 && describeBranchEnd > describeBranchStart, "B setup: the `describe` station's JSX branch was located");
const describeBranch = desk.slice(describeBranchStart, describeBranchEnd);
record(/<SectionDetail/.test(describeBranch), "B: SectionDetail renders on the `describe` station");
record(/\{canvasBlock\}/.test(describeBranch), "B: the full document twin (canvasBlock) still renders on the same station, un-removed");
record(
  describeBranch.indexOf("<SectionDetail") < describeBranch.indexOf("{canvasBlock}"),
  "B: SectionDetail leads, ahead of the document twin -- the focused entry point comes first",
);
record(/coaching=\{coachingFor\(activeRow\.key\)\}/.test(describeBranch), "B: SectionDetail is given real per-section coaching copy, not invented inline text");
record(/cards=\{activeSectionCards\}/.test(describeBranch), "B: SectionDetail is given the open questions actually filtered to this section");

/* ================================================================ */
/* C. Every real outline-row key has a coaching entry.                */
/* ================================================================ */
const OUTLINE_INPUT_FIXTURE: Parameters<typeof buildSectionOutline>[0] = {
  orgScaleComplete: false,
  orgScaleDetail: "",
  scopeComplete: false,
  scopeDetail: "",
  estateSignal: false,
  estateDetail: "",
  resilienceResolved: false,
  resilienceDetail: "",
  securityResolved: false,
  securityDetail: "",
  sector: { title: "Manufacturing and OT", pendingSuggestions: 1, acceptedOrDismissed: 0 },
  operatingModelResolved: false,
  operatingModelDetail: "",
  migrationSignal: false,
  migrationDetail: "",
  commercialSignal: false,
  commercialDetail: "",
  successSignal: false,
  successDetail: "",
};
const allRows = buildSectionOutline(OUTLINE_INPUT_FIXTURE);
record(allRows.length === 10, "C setup: the fixture (sector pack active) produces all ten real outline rows", String(allRows.length));
for (const row of allRows) {
  const c = coachingFor(row.key);
  record(c !== null && c.what.length > 0 && c.why.length > 0, `C: "${row.title}" (key ${row.key}) has a real, non-empty coaching entry`, c ? "present" : "MISSING");
}
/* Round-6 law: no fabricated example answer anywhere in coaching copy --
   never a sample sentence, a made-up count or a named product/standard
   presented as if it were the buyer's own words. Checked the same
   structural way THREAD_WELCOME/placeholder copy is checked elsewhere in
   this codebase: absence of the tells an invented example carries. */
const coachingSrc = src("src/lib/workspace/section-coaching.ts");
const coachingBody = coachingSrc.slice(coachingSrc.indexOf("const SECTION_COACHING"));
record(!/e\.g\.,?\s/i.test(coachingBody), "C: coaching copy contains no \"e.g.\" example opener (round-6 law)");
record(!/for example/i.test(coachingBody), "C: coaching copy contains no \"for example\" opener (round-6 law)");
record(!/"[A-Za-z].*\d.*"/.test(coachingBody), "C: coaching copy contains no quoted sample sentence with a number in it");

/* ================================================================ */
/* D. The multi-section update confirmation is real and thresholded.  */
/* ================================================================ */
const rowAt = (key: string, title: string, state: OutlineRow["state"], detailText: string, missing?: string[]): OutlineRow => ({
  key,
  title,
  state,
  detail: detailText,
  missing,
});
const before: OutlineRow[] = [
  rowAt("organisation_scale", "Organisation and scale", "needs_input", "Sector unstated."),
  rowAt("solution_scope", "Solution scope", "needs_input", "Not yet stated."),
  rowAt("current_estate", "Current estate", "confirmed", "MPLS network stated."),
];
const afterOne: OutlineRow[] = [
  rowAt("organisation_scale", "Organisation and scale", "confirmed", "Healthcare, 30 sites."),
  rowAt("solution_scope", "Solution scope", "needs_input", "Not yet stated."),
  rowAt("current_estate", "Current estate", "confirmed", "MPLS network stated."),
];
const afterTwo: OutlineRow[] = [
  rowAt("organisation_scale", "Organisation and scale", "confirmed", "Healthcare, 30 sites."),
  rowAt("solution_scope", "Solution scope", "confirmed", "SASE, single vendor."),
  rowAt("current_estate", "Current estate", "confirmed", "MPLS network stated."),
];
record(diffOutlineSections(before, afterOne).length === 1, "D: a single-section change is diffed as exactly one changed title", JSON.stringify(diffOutlineSections(before, afterOne)));
record(diffOutlineSections(before, afterTwo).length === 2, "D: a two-section change is diffed as exactly two changed titles", JSON.stringify(diffOutlineSections(before, afterTwo)));
record(diffOutlineSections(before, before).length === 0, "D: an unchanged outline diffs to nothing");
record(
  /diffOutlineSections\(prev, sectionOutline\)/.test(desk) && /changedTitles\.length >= 2/.test(desk),
  "D: ProjectDesk only surfaces the banner at >=2 changed sections -- a single-row change stays on its own row, not a banner on every click",
);
record(/setSectionsUpdatedBanner\(`Updated \$\{changedTitles\.length\} sections: \$\{changedTitles\.join\(", "\)\}`\)/.test(desk), "D: the banner names the changed sections explicitly, not just a count");
record(/updatedBanner=\{sectionsUpdatedBanner\}/.test(desk), "D: SectionNav is actually given the live banner state");

/* ================================================================ */
/* E. The priming promise is stated before typing, honestly.          */
/* ================================================================ */
record(/complete several sections at once/.test(desk), "E: the pre-start welcome/coaching copy states the multi-section mechanism");
record(!/SD-WAN and [Cc]ompliance/.test(desk), "E: round-6 law held -- the mechanism is described, not demonstrated with an invented example sentence");

/* ================================================================ */
/* F. The "fills section" footnote is a real jump link.               */
/* ================================================================ */
record(/onJumpToSection\?\s*:\s*\(title: string\) => void/.test(answerNext), "F: AnswerNext accepts an optional onJumpToSection callback");
record(/onClick=\{\(\) => onJumpToSection\(fills\.title\)\}/.test(answerNext), "F: clicking the footnote (when wired) jumps by the card's own real section title, not a guess");
record(/onJumpToSection=\{onJumpToSection\}/.test(desk), "F: ProjectDesk actually wires AnswerNext's footnote to the real section-jump handler");
record(/const found = sectionOutline\.find\(\(r\) => r\.title === title\)/.test(desk), "F: the jump handler resolves the title against the SAME live outline, never a stale copy");

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
if (failures > 0) process.exit(1);

/* Keep TypeScript honest about the imports actually being exercised
   above (nav/detail are read for their own sake, not further pattern-
   matched beyond what's already covered). */
void nav;
void detail;
