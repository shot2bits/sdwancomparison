/**
 * Living Procurement Canvas Phase 2 correction (14 Aug 2026): pre-publish
 * vendor disclosure regression fixtures.
 *
 * Robert's read-only audit of the 4d75761 bundle found: "There is still a
 * major product-rule conflict: ProjectDesk exposes project-specific
 * vendor names and rankings before publication, although the new report
 * route correctly withholds them until publication." His scoped fix
 * instruction explicitly requires "regression fixtures proving the API
 * and UI cannot reveal supplier identities before publication," and that
 * the boundary be enforced "in the API as well as the JSX so it cannot be
 * bypassed."
 *
 * Two halves:
 *
 *   A) API boundary -- run against the REAL GET /api/workspace/fit route
 *      handler (never a hand-reimplemented substitute), proven NON-
 *      VACUOUS by calling the underlying workspaceFit() library function
 *      directly first, for the identical inputs, and confirming it DOES
 *      carry supplier/directory data -- so the route-level assertions
 *      below prove a real redaction happened, not the absence of
 *      anything to redact in the first place.
 *
 *   B) UI/component boundary -- TOOLING LIMITATION, reported honestly
 *      (same convention as every other presentational-component
 *      validation script in this repository, e.g. validate-workspace-
 *      explanations.ts, validate-session-activity.ts): ProjectDesk.tsx is
 *      a large, stateful, hook-heavy client component (useState,
 *      useEffect, useCallback throughout) and cannot safely be invoked as
 *      a plain function the way this repo's stateless presentational
 *      components are (validate-session-activity.ts) -- doing so would
 *      throw immediately, since hooks require a real React dispatcher,
 *      and this repository has no jsdom / @testing-library/react. So the
 *      UI half is proven the way validate-workspace-explanations.ts
 *      proves its glossary invariants: reading the component's own
 *      source text (comments stripped) and asserting, structurally, that
 *      the vendor-identifying code paths Robert's audit found are
 *      genuinely retired, not merely hidden by CSS or a phase check.
 *      This cannot prove browser rendering; no such claim is made. It is
 *      complementary to, not a substitute for, `npx tsc --noEmit` (run
 *      separately as part of this round's own verification): the
 *      FitState type this round narrowed no longer has `suppliers`/
 *      `directory` fields at all, so a code path that tried `fit.suppliers`
 *      today would fail to *compile*, not merely fail this script.
 *
 * Run standalone: `npx tsx scripts/validate-pre-publish-vendor-disclosure.ts`
 * Wired into `npm run validate` (package.json) alongside every other
 * validate-*.ts / verify-*.ts script.
 */

import { readFileSync } from "node:fs";
import { workspaceFit } from "../src/lib/workspace/fit";
import { getAllVendors } from "../src/lib/vendors";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else {
    fail += 1;
    failures.push(msg);
  }
}

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

async function partA() {
  console.log("=== Part A: GET /api/workspace/fit never returns supplier-identifying data ===\n");

  const { GET: fitRoute } = await import("../src/app/api/workspace/fit/route");
  const vendorNames = getAllVendors().map((v) => v.name);

  const SCENARIOS: { label: string; qs: string }[] = [
    { label: "graded mode, SASE, UK/Ireland, no model", qs: "buying=sase&regions=uk_ireland" },
    { label: "graded mode, SD-WAN, model=managed, cloud+want checks", qs: "buying=sdwan&regions=uk_ireland.europe&model=managed&clouds=aws&wants=ztna.s247" },
    { label: "compiled mode, managed_security, buyer-included vendors", qs: "buying=managed_security&include=cato-networks,palo-alto-networks" },
    { label: "bare default request, no params at all", qs: "" },
  ];

  for (const { label, qs } of SCENARIOS) {
    const url = `https://example.test/api/workspace/fit${qs ? `?${qs}` : ""}`;
    const params = new URLSearchParams(qs);
    const fitOpts = {
      buying: params.get("buying") ?? "",
      regions: (params.get("regions") ?? "").split(".").filter(Boolean),
      model: params.get("model") ?? "any",
      include: (params.get("include") ?? "").split(",").filter(Boolean),
      clouds: (params.get("clouds") ?? "").split(".").filter(Boolean),
      mplsEstate: params.get("mpls") === "1",
      wants: (params.get("wants") ?? "").split(".").filter(Boolean),
    };

    // Non-vacuous sanity check FIRST: the SAME inputs, against the raw
    // library function the route wraps, genuinely carry identifying data
    // -- so the redaction proven below is real, not trivially true.
    const raw = workspaceFit(fitOpts);
    expect(
      raw.directory.length > 0,
      `[A/${label}] sanity: the underlying workspaceFit() directory is non-empty for these inputs (${raw.directory.length} vendors) -- the redaction below is meaningful, not vacuous`,
    );
    if (raw.mode === "graded") {
      expect(raw.suppliers.length > 0, `[A/${label}] sanity: workspaceFit() graded mode returns a non-empty suppliers array (${raw.suppliers.length}) for these inputs`);
      expect(typeof raw.count === "number", `[A/${label}] sanity: workspaceFit() graded mode returns a numeric \`count\` (this project's own match count) for these inputs -- got ${raw.count}`);
    }

    const res = await fitRoute(new Request(url));
    expect(res.status === 200, `[A/${label}] route responds 200`, );
    const body = (await res.json()) as Record<string, unknown>;

    expect(!("suppliers" in body), `[A/${label}] response JSON has no "suppliers" key`);
    expect(!("directory" in body), `[A/${label}] response JSON has no "directory" key`);
    // Robert's rule bans "match counts" as a distinct item from vendor
    // names -- `count` (this project's own matched-vendor COUNT, e.g. "22
    // of 30") must be redacted even though it names no vendor. Caught by
    // this same fixture-writing pass: an earlier version of the API fix
    // stripped `suppliers`/`directory` but left `count` reachable.
    expect(!("count" in body), `[A/${label}] response JSON has no "count" key (a project-specific match count, banned independent of vendor names)`);

    // Belt and braces: no real vendor name string appears ANYWHERE in the
    // serialized response, even inside a field a future edit might add by
    // mistake (a note, a methodology string -- none legitimately need one).
    const rawJson = JSON.stringify(body);
    const leaked = vendorNames.filter((n) => rawJson.includes(n));
    expect(
      leaked.length === 0,
      `[A/${label}] no vendor name string appears anywhere in the response body${leaked.length ? ` (leaked: ${leaked.slice(0, 5).join(", ")})` : ""}`,
    );

    // The safe, non-identifying fields the product rule explicitly allows
    // are still present -- this is a real redaction, not an outage.
    expect(typeof body.ok === "boolean" && body.ok === true, `[A/${label}] response still carries ok:true`);
    expect("mode" in body, `[A/${label}] response still carries mode`);
  }

  console.log(`Part A: ${pass}/${pass + fail} passed so far.\n`);
}

function partB() {
  console.log("=== Part B: ProjectDesk.tsx / ConstellationScene.tsx structural source proof ===\n");

  const deskSrcRaw = readFileSync(new URL("../src/components/ProjectDesk.tsx", import.meta.url), "utf8");
  const desk = codeOnly(deskSrcRaw);
  const constellationSrcRaw = readFileSync(new URL("../src/components/ConstellationScene.tsx", import.meta.url), "utf8");
  const constellation = codeOnly(constellationSrcRaw);

  /* ---- B1: the FitState type carries no vendor-identifying fields ---- */
  const fitStateMatch = desk.match(/type FitState = \{[\s\S]*?\n\};/);
  expect(fitStateMatch !== null, "[B1] FitState type declaration is found in ProjectDesk.tsx");
  const fitStateBody = fitStateMatch?.[0] ?? "";
  expect(!/\bsuppliers\s*:/.test(fitStateBody), "[B1] FitState has no `suppliers` field");
  expect(!/\bdirectory\s*:/.test(fitStateBody), "[B1] FitState has no `directory` field");

  /* ---- B2: no live code path reads a vendor-identifying signal off     */
  /* `fit` any more -- neither the per-vendor arrays nor the aggregate    */
  /* match COUNT (`fit.count`/`fit.mode`), which the product rule bans    */
  /* pre-publish independent of whether a vendor name is attached.        */
  for (const banned of [".suppliers", ".directory", "fit.count", "fit?.count", "fit.mode", "fit?.mode"]) {
    const occurrences = desk.split(banned).length - 1;
    expect(occurrences === 0, `[B2] ProjectDesk.tsx (code, comments stripped) contains no "${banned}" (found ${occurrences})`);
  }

  /* ---- B3: the retired ranked-panel machinery is genuinely gone, not   */
  /* merely hidden -- these identifiers existed ONLY to serve the old     */
  /* "WHO FITS" panel and its per-vendor rendering.                       */
  for (const retired of ["rankedFits", "keptFits", "partnerDependent", "expandedFit", "setExpandedFit", "GRADE_WORDS", "gradeWord"]) {
    const occurrences = desk.split(retired).length - 1;
    expect(occurrences === 0, `[B3] ProjectDesk.tsx contains no reference to the retired "${retired}" (found ${occurrences})`);
  }

  /* ---- B3b: `fittingCount` -- a project-specific match COUNT, the      */
  /* sibling leak this round's fixture-writing pass caught in the         */
  /* "understanding band" (rendered unconditionally, in every phase) --   */
  /* is also fully retired, not merely removed from the ranked panel.     */
  expect(desk.split("fittingCount").length - 1 === 0, "[B3b] ProjectDesk.tsx contains no reference to the retired \"fittingCount\" (a project-specific match count)");

  /* ---- B4: `pins` -- the persisted buyer-selected-vendor field -- is   */
  /* derived ONLY from `added` (genuine buyer input via a `?vendors=`     */
  /* link), never folding in a Netify-computed match survivor.            */
  const pinsMatch = desk.match(/const pins = ([^;]+);/);
  expect(pinsMatch !== null, "[B4] `pins` computation is found");
  expect(pinsMatch?.[1] === "[...new Set(added)].slice(0, 5)", `[B4] \`pins\` is derived only from \`added\`, never a computed fit survivor -- got: ${pinsMatch?.[1]}`);

  /* ---- B5: the three conversational bypass paths Robert's "cannot be   */
  /* bypassed" instruction implies (voice/text commands reaching the      */
  /* same identifying data through a different surface than the visual   */
  /* panel) now refuse honestly instead of leaking a vendor name,         */
  /* position or evidence grade.                                          */
  const dropPartnerMatch = desk.match(/case "dropPartner": \{([\s\S]*?)\n {6}\}/);
  expect(dropPartnerMatch !== null, "[B5] `dropPartner` command handler is found");
  expect(
    !/rankedFits|\.matched\b|\.evidence\b|\.position\b/.test(dropPartnerMatch?.[1] ?? ""),
    "[B5] `dropPartner` no longer reads any per-vendor match/evidence/position field",
  );

  const whyMatch = desk.match(/case "why": \{([\s\S]*?)\n {6}\}/);
  expect(whyMatch !== null, "[B5] `why` command handler is found");
  expect(
    !/rankedFits|\.matched\b|\.evidence\b|\.position\b/.test(whyMatch?.[1] ?? ""),
    "[B5] `why` no longer reads any per-vendor match/evidence/position field",
  );

  const dropKeepNameMatch = desk.match(/case "dropName":\s*\n\s*case "keepName": \{([\s\S]*?)\n {6}\}/);
  expect(dropKeepNameMatch !== null, "[B5] `dropName`/`keepName` command handler is found");
  expect(
    !/rankedFits/.test(dropKeepNameMatch?.[1] ?? ""),
    "[B5] `dropName`/`keepName` no longer has a vendor-ranking-matching branch",
  );

  /* ---- B6: post-publish rendering is sourced from a publish route's OWN */
  /* response (`published.invited` / `published.matched`), never a fresh  */
  /* client-side recompute. `published` is legitimately set from exactly  */
  /* TWO places -- the live `signAndPublish()` response handler, and the  */
  /* round-3 durable resume-hydration path (Robert's independent audit,   */
  /* item 6: a reopened already-published project used to leave           */
  /* `published` at null, since it was only ever set by the live publish  */
  /* click) -- and both read `data.market_report`/`report.market_report`, */
  /* never `fit`/`rankedFits`. See validate-published-resume-hydration.ts */
  /* for the resume path's own dedicated fixtures.                        */
  const setPublishedCalls = desk.match(/setPublished\(/g) ?? [];
  expect(setPublishedCalls.length === 2, `[B6] \`setPublished(\` is called from exactly two places -- signAndPublish and resume hydration (found ${setPublishedCalls.length})`);
  const signAndPublishMatch = desk.match(/const invited: [\s\S]*?setPublished\(\{[\s\S]*?\}\);/);
  expect(signAndPublishMatch !== null, "[B6] the live publish response handler that sets `published` is found");
  const signAndPublishSrc = signAndPublishMatch?.[0] ?? "";
  expect(/data\.invited/.test(signAndPublishSrc), "[B6] `invited` is read from the publish route's own `data.invited`");
  expect(/data\.market_report\?\.matched/.test(signAndPublishSrc), "[B6] `matched` is read from the publish route's own `data.market_report.matched`");
  expect(!/rankedFits|keptFits|fitSlugs/.test(signAndPublishSrc), "[B6] the live publish response handler does not fold in any locally-computed fit/rank data");

  /* ---- B7: the locked outcome panel (`phase === "fits"`), including    */
  /* its post-publish "Your matches" section, contains none of the        */
  /* per-vendor evidence fields FitSupplier used to carry (matched checks,*/
  /* evidence coverage, marketplace links). NOTE: `.matched` is checked   */
  /* against `published.matched` specifically excluded below -- that is  */
  /* the SAFE, frozen, aggregate `{count, names, total_evaluated_market}` */
  /* object Part B6 proves comes only from the publish route's own JSON, */
  /* not the FitSupplier per-vendor evidence array this check targets.   */
  const panelMatch = desk.match(/\{phase === "fits" && \(([\s\S]*?)\n {6}\)\}/);
  expect(panelMatch !== null, "[B7] the `phase === \"fits\"` panel JSX block is found");
  const panelSrc = panelMatch?.[1] ?? "";
  const panelSrcExcludingSafePublished = panelSrc.replace(/published\.matched/g, "");
  for (const banned of ["rankedFits", "keptFits", "fittingCount", ".matched", ".evidence", ".position", "marketplace_url", "supplier_url"]) {
    expect(!panelSrcExcludingSafePublished.includes(banned), `[B7] the locked outcome panel does not reference "${banned}" (outside the safe, frozen \`published.matched\` object)`);
  }

  /* ---- B8: ConstellationScene.tsx's evidence-line source no longer     */
  /* reads a live `fit.suppliers` even in its already-gated (post-publish */
  /* only) state -- the companion fix for "not a freshly recalculated     */
  /* workspace fit."                                                      */
  for (const banned of ["fit?.suppliers", "fit.suppliers", "fit?.directory", "fit.directory"]) {
    expect(!constellation.includes(banned), `[B8] ConstellationScene.tsx contains no "${banned}"`);
  }
  expect(constellation.includes("if (!published) return null;"), "[B8] ConstellationScene.tsx still self-gates to post-publish only (R1b)");

  console.log(`Part B: ${pass}/${pass + fail} passed cumulative.\n`);
}

async function main() {
  await partA();
  partB();

  console.log(`\n${fail === 0 ? "ALL PASS" : `${fail} FAILURE(S)`}  (${pass}/${pass + fail})`);
  if (fail > 0) {
    for (const f of failures) console.log(`FAIL  ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
