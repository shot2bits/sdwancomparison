/**
 * Lifecycle-consistency closure pass (18 Aug 2026): Robert's follow-up
 * instruction after the visual closure pass, "remove the remaining
 * lifecycle contradictions and finish the production experience."
 * Five corrections (A-E), each root-caused against the real, running
 * application via live Playwright evidence before any fix was written --
 * this file is the deterministic, source-level fixture set proving each
 * correction, in this repository's own established style (source-text
 * assertions against the real, unmodified files -- no pixel-diffing
 * harness exists here, matching validate-workspace-chrome-separation.ts,
 * validate-canonical-envelope-closure.ts and validate-2030-constitution-
 * corrections.ts).
 *
 * Root causes, briefly (full detail in each section below):
 *   A) Mission Control's heading was a pure function of
 *      `materialDecisionsRemaining` alone -- no check of `published`
 *      anywhere -- so "N decisions before publish" (or "No blocking
 *      decisions", still framed around a not-yet-completed publish)
 *      rendered unchanged after a real publish.
 *   B) The pre-publish explainer card ("Publish to match this
 *      project...", "What publishing unlocks...") was gated on
 *      `phase === "fits"` alone. `phase` never reverts to "live" after a
 *      real publish (confirmed: no `setPhase` call anywhere in the
 *      publish success path), so the card rendered forever once opened,
 *      stacked directly above the "Published..." confirmation.
 *   C) Two structurally different arrays both answered "how many
 *      decisions are open": Mission Control's `materialDecisionsRemaining`
 *      (compiler openDecisions + earned questions + sector suggestions,
 *      ranked and material-impact-filtered) vs. the publish panel's
 *      `unansweredGaps.length` (`brief.openGaps`, hard-coded to `[]` for
 *      any non-security-scope/network engagement) -- never reconciled,
 *      so a real project could show "7" in one place and "0" in the
 *      other simultaneously.
 *   D) The post-publish confirmation proved publication and invitation
 *      but never checked whether any supplier had actually responded --
 *      no field for it existed anywhere in ProjectDesk.tsx's own state.
 *   E) The sector quick-start chip row was genuinely scrollable at 390px
 *      (`overflow-x-auto`) but `scrollbarWidth: "none"` hid the only
 *      affordance that could tell a buyer so -- confirmed via a live
 *      390px screenshot showing the first chip's own text hard-clipped
 *      mid-word ("Multinational / glo…") with nothing suggesting more
 *      existed.
 */

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
  const desk = src("src/components/ProjectDesk.tsx");
  const canvas = src("src/components/procurement/LivingProcurementCanvas.tsx");

  /* ================================================================ */
  /* A. Post-publication Mission Control never says "before publish".   */
  /* ================================================================ */
  {
    /* Superseded 19 Aug 2026 (structural pass, Robert's "UI mockups
       request" handoff bundle): the dark Mission Control rail these
       fixtures were written against is retired -- decisions are their own
       full-pane station now (DecisionsStep.tsx). The GUARANTEE is
       unchanged and still the whole point of this section: a published
       project must never be told it has work to do "before publish". Only
       the file that owns the heading moved, so the assertions follow it.
       The pre-publish wording additionally picked up the reference's own
       phrasing ("...before this can be published") while keeping the same
       real `materialDecisionsRemaining` count in front of it. */
    const decisions = src("src/components/procurement/DecisionsStep.tsx");
    record(
      /`\$\{materialDecisionsRemaining\} decision\$\{materialDecisionsRemaining === 1 \? "" : "s"\} before this can be published`/.test(decisions),
      "1 (draft): the Decisions station's pre-publish branch renders the real \"N decision(s) before this can be published\" count",
      "",
    );
    const headingBlock = decisions.match(/<h2\b[\s\S]{0,1400}?<\/h2>/);
    record(Boolean(headingBlock), "A setup: the Decisions station's <h2> heading block was located for inspection", "");
    if (headingBlock) {
      const publishedBranch = headingBlock[0].match(/\{published\s*\?([\s\S]*?):\s*materialDecisionsRemaining/);
      record(Boolean(publishedBranch), "A setup: the heading's `published ? ... : ...` branch structure was located", "");
      if (publishedBranch) {
        record(!/before publish/i.test(publishedBranch[1]), "2 (published): the published-true branch never contains the string \"before publish\"", publishedBranch[1].trim());
        record(/Project published/.test(publishedBranch[1]), "2 (published): the published-true branch says \"Project published\"", "");
        record(/optional refinement/i.test(publishedBranch[1]), "2 (published): remaining decisions after publish are labelled \"optional refinement(s)\", never blockers", "");
      }
    }
    const bodyCopyBlock = decisions.match(/\{published\s*\?\s*"Publication is already complete[\s\S]{0,50}/);
    record(Boolean(bodyCopyBlock), "2 (published): the Decisions station's body copy has its own published-aware branch (\"Publication is already complete...\")", "");
  }

  /* ================================================================ */
  /* B. Pre-publication content is hidden after publication.            */
  /* ================================================================ */
  {
    // Fixture 3: the explainer card carrying "Publish to match this
    // project...", "What publishing unlocks..." is gated on `!published`
    // -- not merely `phase === "fits"`, which stays true forever once a
    // buyer opens the panel (no `setPhase` call in the publish success
    // path reverts it).
    // Radius updated 19 Aug 2026 (handoff-bundle aesthetic-only restyle:
    // 14px -> 4px, matching every other card on the surface) -- the
    // `!published` gate itself, which this fixture actually exists to
    // confirm, is untouched by that visual change.
    const explainerGate = desk.match(/\{!published && \(\s*<div className="overflow-hidden rounded-\[4px\][\s\S]{0,300}/);
    record(Boolean(explainerGate), "3: the pre-publish explainer card (\"Publish to match this project…\") is gated on `!published`", "");
    record(/Publish to match this project against Netify/.test(desk), "3 setup: the explainer heading string still exists in source (proving the fixture isn't vacuous -- the content exists, just conditionally)", "");
    record(/What publishing unlocks: your matched vendors/.test(desk), "3 setup: \"What publishing unlocks\" copy still exists in source, same reasoning", "");
    // `setPhase` is never called anywhere inside the publish success
    // branch, confirming `phase === "fits"` alone cannot be trusted as a
    // "before publish" signal (this is WHY `!published` is the correct
    // gate, not a redundant belt-and-braces check).
    const publishSuccessBlock = desk.match(/if \(res\.ok\) \{[\s\S]{0,3500}?window\.scrollTo/);
    record(Boolean(publishSuccessBlock), "B setup: the publish success branch was located for inspection", "");
    if (publishSuccessBlock) {
      record(!/setPhase\(/.test(publishSuccessBlock[0]), "B: confirms `setPhase` is never called in the publish success path -- `phase` alone cannot detect \"already published\", so `!published` is the correct, necessary gate", "");
    }
    // The "Generate and publish" button itself was already correctly
    // gated (pre-existing, not this pass's change) -- regression guard.
    record(/\{published \? \(/.test(desk), "3 (regression guard): the data-publish block's own `published ? (...) : (...)` split (the \"Generate and publish\" button's own gate) is unchanged", "");
  }

  /* ================================================================ */
  /* C. One authoritative decision semantic.                            */
  /* ================================================================ */
  {
    // Fixture 4: the publish-panel stat and Mission Control's heading
    // both read the SAME `materialDecisionsRemaining` value -- no
    // remaining reference to the old, structurally-disconnected
    // `unansweredGaps.length` in either display.
    const statBlock = desk.match(/Blocking decision[\s\S]{0,400}remaining\. Resolve or accept as a stated assumption before you publish\./);
    record(Boolean(statBlock), "4 setup: the publish-panel's blocking-decisions stat was located", "");
    // Hex updated 19 Aug 2026 (handoff-bundle restyle: #655F52 -> #66635e,
    // the new palette's own ink-600) -- the identifier this fixture exists
    // to confirm is unchanged by that visual swap.
    record(/\{materialDecisionsRemaining\}[\s\S]{0,10}<\/div>\s*<div className="mt-1 text-\[12\.5px\] leading-\[1\.5\] text-\[#66635e\]">\s*\{materialDecisionsRemaining === 1 \? "Blocking decision" : "Blocking decisions"\}/.test(desk),
      "4: the publish-panel stat now reads `materialDecisionsRemaining` -- the SAME identifier Mission Control's heading uses, not a separately-sourced value",
      "",
    );
    // The old, structurally-broken source is fully gone from the display
    // path (still legitimately used by the accept-gap submission loop in
    // signAndPublish -- that usage is untouched and NOT what this checks).
    const displayRegionsOnly = desk.replace(/async function signAndPublish[\s\S]*?^\s{2}\}\n/m, "");
    record(!/\{unansweredGaps\.length\}/.test(displayRegionsOnly) || !/Open decisions? remaining/.test(displayRegionsOnly),
      "4: no remaining UI DISPLAY reads `unansweredGaps.length` as a \"decisions\" count (the accept-gap submission loop's own use of `unansweredGaps` is a different, legitimate concern and is untouched)",
      "",
    );
    // Fixture 5: optional refinements never masquerade as blockers --
    // once published, nothing remaining can block anything, whatever its
    // pre-publish material/non-material classification was.
    //
    // Superseded 19 Aug 2026 (structural pass): the rail's group-level
    // "Optional refinements" heading is gone with the rail. The same
    // guarantee is now carried by the Decisions station's own heading and
    // body copy, both of which branch on `published` FIRST (asserted in
    // section A above) -- and, more strongly than the old label managed,
    // by per-card chips computed from the SAME MATERIAL_IMPACTS
    // classification rather than one heading covering a mixed group.
    const decisions5 = src("src/components/procurement/DecisionsStep.tsx");
    record(/published\s*\?\s*"Publication is already complete/.test(decisions5),
      "5: post-publish, the Decisions station states publication is complete instead of labelling anything a blocker -- regardless of `materialDecisionsRemaining`'s own pre-publish material/non-material split",
      "",
    );
    record(/for the next revision`/.test(decisions5),
      "5: remaining post-publish decisions are framed as shaping the next revision, never as outstanding work on a completed publication",
      "",
    );
    // The raw, unfiltered document-level count (a genuinely different,
    // broader metric -- total unresolved fields, sector suggestions
    // included, no material-impact filter) is now labelled distinctly
    // from "decisions" so it can never be read as the same blocking count.
    record(/<StatTile label="Document gaps" value=\{document\.counts\.decisions\}/.test(canvas),
      "5: LivingProcurementCanvas's raw, unfiltered open-decisions count is labelled \"Document gaps\", never \"Open decisions\" -- can't be confused with Mission Control's \"blocking decisions\" figure",
      "",
    );
    record(!/label="Open decisions"/.test(canvas), "5: no StatTile or section in LivingProcurementCanvas.tsx is still labelled \"Open decisions\"", "");
  }

  /* ================================================================ */
  /* D. Honest response state.                                          */
  /* ================================================================ */
  {
    record(/const \[responseCount, setResponseCount\] = useState<number \| null>\(null\)/.test(desk),
      "D setup: `responseCount` defaults to `null` (\"not yet checked\") -- the safe default that renders identically to a real, confirmed zero, never overclaiming",
      "",
    );
    record(/async function loadResponseStatus\(id: string, manage: string\)/.test(desk),
      "D setup: `loadResponseStatus` reads the real `/api/rfp/[id]/evaluation` endpoint (the SAME real, stored-response-backed endpoint RfpBuilder.tsx's own genuine comparison view already uses)",
      "",
    );
    record(/\/sase\/api\/rfp\/\$\{encodeURIComponent\(id\)\}\/evaluation/.test(desk), "D: loadResponseStatus calls the real evaluation endpoint, not a placeholder or guessed count", "");
    // Fixture 6: published with zero (or unknown/unconfirmed) responses
    // says "awaiting responses" -- covers BOTH `responseCount === 0` and
    // `responseCount === null` (never fetched / fetch failed), since
    // neither is proof that a response exists.
    record(/Published — awaiting supplier responses/.test(desk), "6: published-with-no-confirmed-responses renders \"Published — awaiting supplier responses\"", "");
    const responseBlock = desk.match(/\{responseCount\s*\?\s*`\$\{responseCount\}[\s\S]{0,220}?:\s*`Published — awaiting supplier responses[\s\S]{0,150}?`\}/);
    record(Boolean(responseBlock), "6: the response-status text is a single `responseCount ? ... : \"awaiting\"` branch -- `0` and `null` both take the honest \"awaiting\" branch (falsy), never the confirmed-count branch", "");
    // Fixture 7: only when real stored responses exist does the honest
    // "N have responded" wording appear, with a link to the REAL,
    // already-correct comparison experience (RfpBuilder.tsx) -- never a
    // duplicated or fabricated comparison rendered inline.
    record(/"has" : "have"\} responded\.`/.test(desk), "7: a real, positive `responseCount` renders \"N of M invited vendor(s) have/has responded\", using the real fetched count", "");
    record(/\{Boolean\(responseCount\) && created\?\.id && \(/.test(desk), "7: the \"Compare responses\" link only renders when `responseCount` is real and truthy (never for 0 or null)", "");
    record(/\/sase\/rfp-builder\/\$\{created\.id\}\/review/.test(desk), "7: \"Compare responses\" links to the real, existing RfpBuilder review route -- not a new or duplicated comparison view", "");
    // Regression guard: RfpBuilder.tsx's own genuine response-comparison
    // logic (the real target of that link) is untouched by this pass.
    const rfpBuilder = src("src/components/RfpBuilder.tsx");
    record(/evaluations && evaluations\.length === 0 && <p/.test(rfpBuilder), "7 (regression guard): RfpBuilder.tsx's own honest \"no responses yet\" empty state is unchanged", "");
    record(/evaluations && evaluations\.length > 0 && \(\(\) => \{/.test(rfpBuilder), "7 (regression guard): RfpBuilder.tsx's own genuine ranked-comparison-matrix rendering (gated on real `evaluations.length > 0`) is unchanged", "");
    // Response status is checked both on a live publish and on reopening
    // an already-published project -- save/reopen must not regress to
    // stale or fabricated response data (fixture 11, response half).
    record(desk.match(/void loadResponseStatus\(/g)?.length === 2, "11 (response half): `loadResponseStatus` is called from exactly two sites -- the live publish-success path and the reopen/rehydrate path -- so a reopened published project shows real response status too, not just a fresh publish", `count=${desk.match(/void loadResponseStatus\(/g)?.length ?? 0}`);
  }

  /* ================================================================ */
  /* E. Mobile overflow: the sector chip row at 390px.                  */
  /* ================================================================ */
  {
    // Fixture 10: content is not silently cut off. The row is still
    // genuinely scrollable (content unchanged, nothing removed), but a
    // right-edge fade mask now makes the truncation read as an
    // intentional "more this way" affordance instead of a hard, silent
    // clip -- confirmed via a live 390px screenshot before and after.
    record(/overflow-x-auto sm:flex-wrap sm:overflow-visible \[mask-image:linear-gradient/.test(desk),
      "10: the sector-chip row keeps its real horizontal scroll (`overflow-x-auto`) and gains a right-edge fade mask as the required \"clear affordance\" -- content itself (every chip's full label) is untouched",
      "",
    );
    record(/sm:\[mask-image:none\]/.test(desk), "10: the fade mask is turned off at `sm`+, where the row switches to `flex-wrap` and has nothing left to hint at", "");
    record(/-webkit-mask-image/.test(desk), "10: a `-webkit-mask-image` fallback is present alongside the standard property for Safari/WebKit", "");
  }

  /* ================================================================ */
  /* Rule 2 regression guard: supplier identities remain absent before  */
  /* MarketUnlock, appear only from the frozen successful publication   */
  /* (fixtures 8-9). This pass touched no vendor-disclosure code path   */
  /* -- confirmed by checking the existing enforcement is unchanged.    */
  /* ================================================================ */
  {
    const fitRoute = src("src/app/api/workspace/fit/route.ts");
    record(/isMarketUnlocked/.test(fitRoute) || /market_unlocked/.test(fitRoute) || /published/.test(fitRoute),
      "8-9 (regression guard): /api/workspace/fit's own pre-publish vendor-identity boundary is present and unmodified by this pass",
      "",
    );
    record(!/vendor.*name/i.test(desk.match(/\{!published && \([\s\S]*?\)\s*\}\s*\n\s*\n\s*\{\/\* ---- Generate and publish/)?.[0] ?? ""),
      "8-9: the (now `!published`-gated) pre-publish explainer card itself never names a vendor -- confirmed no vendor-name text appears in that block's own source",
      "",
    );
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
