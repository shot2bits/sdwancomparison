/**
 * Living Procurement Canvas Phase 2, round 3 (14 Aug 2026): durable
 * resume-after-publish hydration -- build-gate-safe fixtures.
 *
 * Robert's independent read-only audit (run against baseline 4d75761, not
 * the round-2 fix) found item 6: ProjectDesk's `published` client state
 * was only ever set by the live `signAndPublish()` response handler, never
 * reconstructed on resume. A buyer reopening an ALREADY-PUBLISHED project
 * (`?id=` resume flow) saw the pre-publish locked outcome panel again
 * instead of their frozen matches, since `published` reset to `null` on
 * every fresh page load. Not an identity leak -- the fit API's redaction
 * is unconditional regardless -- but a real durability gap in "display the
 * frozen matched and invited suppliers from the published snapshot".
 *
 * Round 4 (14 Aug 2026): Robert's follow-up audit of round 3 found the
 * durability fix itself was incomplete in five distinct ways -- every one
 * a post-publication correctness issue, never a re-opening of the
 * pre-publish disclosure leak (that fix remains sound and untouched here):
 *
 *   1. The resume/report gates tested `status === "published"` alone, which
 *      undercounts every project that has since moved into `qa` or
 *      `evaluation` (STATUS_FOR_PHASE in project-machine.ts maps every
 *      phase from "published" onward -- including the post-evaluation
 *      phases, which have no legacy status of their own -- onto one of
 *      exactly those three legacy statuses). Fixed with a shared
 *      `hasPublished()` predicate.
 *   2. A legacy published record with no snapshot silently fell back to a
 *      freshly recomputed market report, while the UI still claimed
 *      "exactly as published" -- a claim that can be false. The report
 *      route now returns `frozen: boolean` so a caller can word this
 *      honestly.
 *   3. Invited vendors absent from `market_report.matched.names` (that
 *      field is capped and comes from a different ranking) silently
 *      vanished from the resumed UI -- proven live: Fortinet was invited
 *      but not in `matched.names`. Fixed with a stable-union render: a
 *      second "also invited" list for any invited vendor outside the
 *      matched set.
 *   4. "Matched" was never the publish shortlist: `market_report.matched`
 *      comes from `matchSuppliers()`, a different, simpler ranking than
 *      the `buildShortlist()` call that actually selected
 *      `matched_vendor_ids`/`invited_vendor_ids`. The report route (and
 *      the publish route's own immediate response) now serve the REAL
 *      selection, not the market-report proxy.
 *   5. Invited display names were resolved against the CURRENT
 *      `/api/workspace/market` directory on every resume, so a renamed or
 *      removed vendor would render differently than at publication. The
 *      snapshot schema now optionally freezes vendor NAMES
 *      (`matched_vendors`/`invited_vendors`) at publish time; a caller
 *      falls back to resolving IDs against the live directory only for an
 *      older snapshot, and the UI now labels that fallback honestly
 *      (`namesFrozen`) instead of always claiming full fidelity.
 *
 * Three parts, mirroring validate-pre-publish-vendor-disclosure.ts's own
 * split, extended for round 4:
 *
 *   A) Route-level data availability (round 3's original scope): the
 *      owner-gated `GET /api/rfp/[id]` response carries `status` and
 *      `invited_vendors`, and `GET /api/rfp/[id]/report` correctly gates
 *      `market_report` on publish status -- for a DRAFT project (no live
 *      business-email verification needed, so this stays inside the build
 *      gate).
 *
 *   A2) Round 4's new route-level coverage, closing the exact test gap
 *      Robert named ("The new fixture does not exercise a published
 *      project without a snapshot" / "It needs fixtures for: published ->
 *      QA -> reload; published -> evaluation -> reload; a legacy published
 *      record without a snapshot; an invited vendor absent from
 *      market_report.matched.names"). Uses `store.command(["SET", ...])`
 *      to seed a project directly into the fake KV with a post-publication
 *      status (bypassing saveProject()'s engine/phase invariants
 *      deliberately -- this is proving the READ-side `hasPublished()` gate,
 *      not the write-side state machine, and the seeding format matches
 *      setJson()'s own `kv(["SET", key, JSON.stringify(value)])` byte for
 *      byte) and, separately, a real `PublishedSnapshot` whose
 *      `matched_vendor_ids`/`matched_vendors` deliberately diverge from
 *      `market_report.matched.names`, mirroring the live Fortinet
 *      evidence.
 *
 *      The full end-to-end proof -- a REAL publish, then a byte-for-byte
 *      fidelity check that resume-hydration reproduces exactly what that
 *      publish returned -- needs a real publish (verifyBusinessEmail() does
 *      real DNS/HTTPS, the same limitation documented on
 *      verify-phase2-publish-lifecycle-live-demo.ts) and lives in the
 *      companion script scripts/verify-round3-resume-after-publish-live-
 *      demo.ts, run by hand, NOT wired into `npm run validate` for that
 *      reason.
 *
 *   B) UI/component structural proof (TOOLING LIMITATION, reported
 *      honestly, same convention as validate-pre-publish-vendor-
 *      disclosure.ts's own Part B): ProjectDesk.tsx's resume effect and its
 *      "Your matches" render block are read as source text and checked for
 *      the specific wiring round 3 AND round 4 require -- the resume-fetch
 *      type carries `status`/`invited_vendors`, the report/market fetches
 *      are conditioned on `hasPublished(proj.status)` (not the narrower
 *      round-3 equality check), `setPhase("fits")` is called so the
 *      rehydrated panel actually renders, the "reopened" message is gated
 *      on the ACTUAL hydration outcome, the matched-vendor source is
 *      `matched_vendor_ids`/`matched_vendors` (never
 *      `market_report.matched.names`), the invited badge matches by SLUG
 *      (never by name), a stable-union "also invited" block renders any
 *      invited vendor outside the matched set, and the rendered copy is
 *      conditional on `frozen`/`namesFrozen` rather than always claiming
 *      full fidelity.
 *
 * Run standalone: `npx tsx scripts/validate-published-resume-hydration.ts`
 * Wired into `npm run validate` (package.json) alongside every other
 * validate-*.ts / verify-*.ts script.
 */

import { readFileSync } from "node:fs";
import { withFakeKv, makeRequest, seedVerifiedMarketUnlock } from "./fake-kv-harness";
import type { SecurityRequirementInput } from "../src/lib/security/rulebook";
import type { PublishedSnapshot } from "../src/lib/published-snapshot";

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

const FULL_REQ: SecurityRequirementInput = {
  organisation: { sector: "healthcare" },
  estate: { sites: 20, users: 200, existingSecurity: ["Defender P2"] },
  drivers: ["renewal"],
  constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
};

async function partA() {
  console.log("=== Part A: route-level data contracts this fix's client hydration depends on ===\n");

  await withFakeKv(async () => {
    const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
    const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
    const { GET: reportRoute } = await import("../src/app/api/rfp/[id]/report/route");

    const createRes = await createSecurityProjectRoute(
      makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
        body: { requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_r3v_A", text: "Turn A: initial create.", at: 1000, via: "typed" }] },
      }),
    );
    const created = (await createRes.json()) as { project?: { id?: string; manage_token?: string } };
    expect(createRes.status === 200, "[A] draft create succeeds");
    const id = created.project?.id ?? "";
    const manage = created.project?.manage_token ?? "";

    const projRes = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
    const proj = (await projRes.json()) as Record<string, unknown>;
    expect(projRes.status === 200, "[A] owner GET /api/rfp/[id] succeeds");
    expect("status" in proj, "[A] owner GET /api/rfp/[id] response carries a `status` key -- the field this fix's client type now reads");
    expect(proj.status === "draft" || proj.status === "review", `[A] a fresh, unpublished project reports a pre-publish status (got "${proj.status}")`);
    expect("invited_vendors" in proj, "[A] owner GET /api/rfp/[id] response carries an `invited_vendors` key");
    expect(Array.isArray(proj.invited_vendors) && (proj.invited_vendors as unknown[]).length === 0, "[A] a fresh, unpublished project's invited_vendors is empty");

    // Non-vacuous: the report route's own `market_report` gate on status
    // is what makes the client's `hasPublished(proj.status)` guard
    // meaningful, not redundant -- a draft must carry no `market_report`.
    const reportRes = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${id}/report?manage=${manage}`), { params: Promise.resolve({ id }) });
    const reportBody = (await reportRes.json()) as Record<string, unknown>;
    expect(reportRes.status === 200, "[A] report route succeeds for a draft");
    expect(reportBody.preview === true, "[A] a draft's report route returns preview:true");
    expect(!("market_report" in reportBody), "[A] a draft's report route carries no `market_report` key at all -- the status guard this fix relies on is load-bearing");
  });

  console.log(`Part A: ${pass}/${pass + fail} passed so far.\n`);
}

async function partA2() {
  console.log("=== Part A2 (round 4): qa/evaluation hydration, legacy no-snapshot honesty, and matched-vs-invited divergence ===\n");

  const { hasPublished } = await import("../src/lib/project-machine");

  // --- Direct unit coverage of hasPublished() for all five RfpStatus
  // values -- the exact shared predicate Robert's finding 1 asked for,
  // proven independent of any route. ---
  expect(hasPublished("draft") === false, '[A2] hasPublished("draft") is false');
  expect(hasPublished("review") === false, '[A2] hasPublished("review") is false');
  expect(hasPublished("published") === true, '[A2] hasPublished("published") is true');
  expect(hasPublished("qa") === true, '[A2] hasPublished("qa") is true -- Robert\'s finding 1: a project that moved into QA has unquestionably crossed the publication boundary');
  expect(hasPublished("evaluation") === true, '[A2] hasPublished("evaluation") is true -- Robert\'s finding 1');

  await withFakeKv(async (store) => {
    const { GET: reportRoute } = await import("../src/app/api/rfp/[id]/report/route");
    const { getProject } = await import("../src/lib/rfp-store");
    const { savePublishedSnapshot } = await import("../src/lib/published-snapshot");
    const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
    // Market-unlock correction round (16 Aug 2026): the report route this
    // part exercises now gates `market_report` on the canonical
    // `isMarketUnlocked()` predicate (market-unlock.ts), not on
    // `hasPublished(project.status)` alone -- a qa/evaluation/published
    // status reached by this fixture's own direct `store.command(["SET",
    // ...])` seeding (deliberately bypassing saveProject(), see this
    // function's own header comment) no longer carries a market unlock on
    // its own, since no real board listing ever ran for it. Each scenario
    // below now also commits a real MarketUnlock record immediately after
    // seeding the status, so this fixture keeps proving what it always
    // proved (a post-publish status sees the full report, not the draft
    // preview) against the boundary that actually governs it today. Round 2
    // correction: each seeded unlock must reference a REAL, persisted
    // FrozenRevision and a REAL, public board Opportunity for
    // commitMarketUnlock() to accept it (see market-unlock.ts's integrity
    // check) -- seedVerifiedMarketUnlock() (fake-kv-harness.ts) creates both
    // before committing, so this fixture's seeded unlock is genuine, not a
    // bare KV row.

    const createRes = await createSecurityProjectRoute(
      makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
        body: { requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_r4_A2", text: "Turn A2: initial create.", at: 2000, via: "typed" }] },
      }),
    );
    const created = (await createRes.json()) as { project?: { id?: string; manage_token?: string } };
    const id = created.project?.id ?? "";
    const manage = created.project?.manage_token ?? "";
    const original = await getProject(id);
    expect(original !== null, "[A2] seed project readable via getProject() after creation");
    if (!original) return;

    // Seeded directly via store.command(["SET", ...]) -- bypassing
    // saveProject()'s engine/phase-consistency invariants deliberately:
    // this is proving the READ-side `hasPublished()` gate on the report
    // route, not the write-side state machine (which has its own,
    // separately-tested transition table in project-machine.ts). The
    // seeding format (`JSON.stringify(value)` under key `rfp:${id}`)
    // matches rfp-store.ts's own setJson() exactly, so getProject() reads
    // it back through the identical zod-validated path a real save would.

    /* ---- Scenario 1: status "qa", no published snapshot at all ---- */
    /* (findings 1 + 2 together: a post-publish status the round-3 gate    */
    /* missed, AND a legacy record with nothing frozen to serve.)          */
    store.command(["SET", `rfp:${id}`, JSON.stringify({ ...original, status: "qa" })]);
    await seedVerifiedMarketUnlock({
      project_id: id,
      published_revision_id: "snap_a2_test_qa",
      board_opportunity_id: "opp_a2_test_qa",
      content_hash: "test-hash-qa",
    });
    const qaRes = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${id}/report?manage=${manage}`), { params: Promise.resolve({ id }) });
    const qaBody = (await qaRes.json()) as Record<string, unknown>;
    expect(qaRes.status === 200, "[A2] report route succeeds for a qa-status project");
    expect(qaBody.preview !== true, "[A2] a qa-status project is NOT treated as a draft preview -- finding 1");
    expect("market_report" in qaBody, "[A2] a qa-status project's report route carries market_report -- finding 1");
    expect(qaBody.frozen === false, "[A2] a qa-status project with no snapshot honestly reports frozen:false rather than claiming a frozen match -- finding 2");
    expect(qaBody.matched_vendor_ids === null, "[A2] no snapshot -> matched_vendor_ids is null, not fabricated");
    expect(qaBody.matched_vendors === null, "[A2] no snapshot -> matched_vendors (frozen names) is null");

    /* ---- Scenario 2: status "evaluation", no snapshot ---- */
    /* (finding 1's second missed status; STATUS_FOR_PHASE also collapses  */
    /* awarded/transacting/complete/closed onto "evaluation", so this one  */
    /* scenario stands in for all four post-evaluation phases too.)        */
    store.command(["SET", `rfp:${id}`, JSON.stringify({ ...original, status: "evaluation" })]);
    // Already unlocked by the qa scenario's commit above (same project id);
    // commitMarketUnlock() is idempotent, so re-asserting the SAME triple
    // here is a harmless no-op that also documents this scenario's own
    // requirement explicitly rather than depending silently on execution
    // order between scenarios.
    await seedVerifiedMarketUnlock({
      project_id: id,
      published_revision_id: "snap_a2_test_qa",
      board_opportunity_id: "opp_a2_test_qa",
      content_hash: "test-hash-qa",
    });
    const evalRes = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${id}/report?manage=${manage}`), { params: Promise.resolve({ id }) });
    const evalBody = (await evalRes.json()) as Record<string, unknown>;
    expect(evalRes.status === 200, "[A2] report route succeeds for an evaluation-status project");
    expect(evalBody.preview !== true, "[A2] an evaluation-status project is NOT treated as a draft preview -- finding 1");
    expect("market_report" in evalBody, "[A2] an evaluation-status project's report route carries market_report -- finding 1");
    expect(evalBody.frozen === false, "[A2] an evaluation-status project with no snapshot also honestly reports frozen:false -- finding 2");

    /* ---- Scenario 3: status "published" WITH a real snapshot whose      */
    /* matched_vendor_ids/matched_vendors deliberately include a vendor    */
    /* absent from market_report.matched.names -- proving the report route */
    /* serves the REAL buildShortlist() selection, not the market-report   */
    /* proxy (findings 3/4). Mirrors the live evidence: Fortinet was       */
    /* invited but outside matchSuppliers()'s capped top-8 names.          */
    const marketReport = (qaBody.market_report ?? evalBody.market_report) as {
      matched: { names: string[]; count: number; total_evaluated_market: number };
    };
    const DIVERGENT_SLUG = "divergent-test-vendor";
    const DIVERGENT_NAME = "Divergent Test Vendor (not in matched.names)";
    expect(
      !marketReport.matched.names.includes(DIVERGENT_NAME),
      "[A2] setup sanity: market_report.matched.names genuinely does not include the deliberately-injected divergent vendor name",
    );
    store.command(["SET", `rfp:${id}`, JSON.stringify({ ...original, status: "published" })]);
    const snapshot: PublishedSnapshot = {
      id: "snap_a2_test",
      project_id: id,
      document_version: 1,
      compiler_version: "test",
      methodology_version: "test",
      rulebook_version: null,
      published_at: 1723600000000,
      published_by: "buyer@example.test",
      consent: null,
      content_hash: "test-hash",
      frozen_content: { title: original.title, buyer: original.buyer, rfp_sections: [] },
      public_projection: { opportunity_id: null, url: null },
      private_requirement: { rfp_id: id },
      match_criteria: "test criteria",
      matched_vendor_ids: [DIVERGENT_SLUG, ...marketReport.matched.names.slice(0, 1)],
      invited_vendor_ids: [DIVERGENT_SLUG],
      matched_vendors: [{ slug: DIVERGENT_SLUG, name: DIVERGENT_NAME }],
      invited_vendors: [{ slug: DIVERGENT_SLUG, name: DIVERGENT_NAME, supplier_url: "" }],
      accepted_assumptions: [],
      open_decisions: [],
      market_report: marketReport as never,
    };
    await savePublishedSnapshot(id, snapshot);
    // Bind the MarketUnlock to the REAL snapshot id this scenario just
    // saved, matching the actual invariant (published_revision_id is the
    // PublishedSnapshot id) rather than relying on the qa/evaluation
    // scenarios' earlier, differently-keyed commit above still being
    // present.
    await seedVerifiedMarketUnlock({
      project_id: id,
      published_revision_id: snapshot.id,
      board_opportunity_id: "opp_a2_test_published",
      content_hash: snapshot.content_hash,
      frozen_content: snapshot.frozen_content,
    });

    const pubRes = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${id}/report?manage=${manage}`), { params: Promise.resolve({ id }) });
    const pubBody = (await pubRes.json()) as {
      frozen?: boolean;
      matched_vendor_ids?: string[] | null;
      matched_vendors?: { slug: string; name: string }[] | null;
      market_report?: { matched: { names: string[] } };
    };
    expect(pubRes.status === 200, "[A2] report route succeeds for a published project with a real snapshot");
    expect(pubBody.frozen === true, "[A2] a published project with a real snapshot reports frozen:true");
    expect(
      Array.isArray(pubBody.matched_vendor_ids) && pubBody.matched_vendor_ids.includes(DIVERGENT_SLUG),
      "[A2] matched_vendor_ids includes the deliberately-divergent vendor slug -- the REAL buildShortlist() selection, sourced from the snapshot",
    );
    expect(
      Array.isArray(pubBody.matched_vendors) && pubBody.matched_vendors.some((v) => v.name === DIVERGENT_NAME),
      "[A2] matched_vendors (frozen names) includes the divergent vendor -- findings 3/4: proves the route serves the real shortlist, not market_report.matched",
    );
    expect(
      Array.isArray(pubBody.market_report?.matched.names) && !pubBody.market_report!.matched.names.includes(DIVERGENT_NAME),
      "[A2] non-vacuous: market_report.matched.names genuinely still omits this vendor, proving matched_vendor_ids/matched_vendors is a materially different and more complete source -- exactly Robert's finding 3/4 divergence",
    );
  });

  console.log(`Part A2: ${pass}/${pass + fail} passed cumulative.\n`);
}

function partB() {
  console.log("=== Part B: ProjectDesk.tsx resume-hydration + render structural proof ===\n");

  const deskSrcRaw = readFileSync(new URL("../src/components/ProjectDesk.tsx", import.meta.url), "utf8");
  const desk = codeOnly(deskSrcRaw);

  /* ---- B1: the resume-fetch type carries the fields this fix reads. ---- */
  const resumeTypeMatch = desk.match(/const proj = \(await res\.json\(\)\) as \{([\s\S]*?)\n {10}\};/);
  expect(resumeTypeMatch !== null, "[B1] the resume-fetch response type is found");
  const resumeTypeBody = resumeTypeMatch?.[1] ?? "";
  expect(/status\?:\s*string/.test(resumeTypeBody), "[B1] the resume-fetch type carries `status?: string`");
  expect(/invited_vendors\?:\s*string\[\]/.test(resumeTypeBody), "[B1] the resume-fetch type carries `invited_vendors?: string[]`");

  /* ---- B2 (round 4): the hydration is conditioned on the SHARED         */
  /* hasPublished() predicate, not the narrower round-3 equality check --  */
  /* Robert's finding 1: `status === "published"` alone undercounts qa/    */
  /* evaluation, both of which have unquestionably crossed publication.    */
  expect(/import \{ hasPublished \} from "@\/lib\/project-machine";/.test(desk), "[B2] ProjectDesk imports the shared `hasPublished()` predicate");
  expect(
    /if \(proj\.status && hasPublished\(proj\.status as RfpStatus\)\) \{/.test(desk),
    "[B2] the resume block gates report/market hydration on `hasPublished(proj.status as RfpStatus)`, not a narrow `=== \"published\"` equality -- finding 1",
  );
  expect(
    !/if \(proj\.status === "published"\) \{/.test(desk),
    '[B2] the OLD round-3 gate `if (proj.status === "published")` is fully gone, not merely supplemented',
  );

  /* ---- B3: both the report route and the market route are called,      */
  /* exactly the frozen/general sources -- never `fit`/`rankedFits`.       */
  const hydrationBlockMatch = desk.match(/let rehydratedPublished = false;([\s\S]*?)\n {10}say\(/);
  expect(hydrationBlockMatch !== null, "[B3] the resume-hydration block (between the `rehydratedPublished` flag and the closing `say(`) is found");
  const hydrationSrc = hydrationBlockMatch?.[1] ?? "";
  expect(/\/rfp\/\$\{encodeURIComponent\(resumeId\)\}\/report/.test(hydrationSrc), "[B3] the hydration block fetches this project's own /report route");
  expect(/\/api\/workspace\/market/.test(hydrationSrc), "[B3] the hydration block fetches the general, non-project-specific /api/workspace/market route for display-name fallback");
  expect(!/rankedFits|keptFits|fitSlugs|\bfit\.suppliers\b|\bfit\?\.suppliers\b/.test(hydrationSrc), "[B3] the hydration block reads none of the banned per-vendor fit fields");
  expect(/setPublished\(\{/.test(hydrationSrc), "[B3] the hydration block calls `setPublished(`");

  /* ---- B3b (round 4, findings 2/4/5): the hydration block reads the     */
  /* honest provenance flags and the REAL matched/invited id/name fields,  */
  /* and never sources the matched SET from market_report.matched.names    */
  /* (only its aggregate total_evaluated_market figure, which names no     */
  /* vendor and cannot silently drop one). ---- */
  expect(/reportBody\.frozen === true/.test(hydrationSrc), "[B3b] the hydration block reads `frozen` from the report route -- finding 2");
  expect(
    /namesFrozen = Boolean\(reportBody\.matched_vendors && reportBody\.invited_vendors\)/.test(hydrationSrc),
    "[B3b] the hydration block derives `namesFrozen` from whether the report route returned frozen vendor names -- finding 5",
  );
  expect(/reportBody\.matched_vendor_ids/.test(hydrationSrc), "[B3b] the hydration block reads `matched_vendor_ids` -- the REAL buildShortlist() selection -- finding 4");
  expect(/reportBody\.invited_vendor_ids/.test(hydrationSrc), "[B3b] the hydration block reads `invited_vendor_ids`");
  expect(
    !/matched\.names/.test(hydrationSrc),
    "[B3b] the hydration block never sources the matched-vendor SET from `market_report.matched.names` -- finding 3/4 (only the aggregate total, checked separately, may come from market_report)",
  );
  expect(
    /market_report\?\.matched\?\.total_evaluated_market/.test(hydrationSrc),
    "[B3b] the hydration block still reads market_report only for its aggregate `total_evaluated_market` figure, which names no vendor",
  );

  /* ---- B4: the rehydrated panel must actually RENDER, not just sit in  */
  /* state -- `phase` defaults to "live" and the matches section lives     */
  /* inside `phase === "fits"`, so a successful hydration must also        */
  /* switch phase.                                                         */
  expect(/setPhase\("fits"\);/.test(hydrationSrc), '[B4] the hydration block calls `setPhase("fits")` so the rehydrated matches actually render');

  /* ---- B5: the "reopened" message is gated on the ACTUAL hydration      */
  /* outcome (`rehydratedPublished`), never on `proj.status` alone -- a    */
  /* failed best-effort fetch (network hiccup, a pre-Phase-2 record with   */
  /* no snapshot) must not claim matches are showing when they are not.   */
  const sayMatch = desk.match(/say\(\s*\n\s*rehydratedPublished([\s\S]*?)\);/);
  expect(sayMatch !== null, "[B5] the gated post-resume `say(...)` call is found");
  expect(
    !/say\(\s*\n\s*proj\.status === "published"/.test(desk),
    '[B5] the post-resume message is not gated on the raw `proj.status === "published"` check (which would misreport a failed hydration as a success)',
  );

  /* ---- B6 (round 4): the `published` client state itself carries the   */
  /* new provenance/matched-vendor fields, replacing the old              */
  /* `matched: {count, names, total_evaluated_market}` shape that forced  */
  /* the render to iterate market_report's proxy list. ---- */
  const publishedStateMatch = desk.match(/const \[published, setPublished\] = useState<\{([\s\S]*?)\} \| null>\(null\);/);
  expect(publishedStateMatch !== null, "[B6] the `published` useState type declaration is found");
  const publishedStateBody = publishedStateMatch?.[1] ?? "";
  expect(/matchedVendors:\s*\{\s*slug:\s*string;\s*name:\s*string\s*\}\[\]/.test(publishedStateBody), "[B6] `published` state carries `matchedVendors: {slug,name}[]` -- the real shortlist, not a market_report proxy");
  expect(/totalEvaluatedMarket:\s*number/.test(publishedStateBody), "[B6] `published` state carries `totalEvaluatedMarket: number`");
  expect(/frozen:\s*boolean/.test(publishedStateBody), "[B6] `published` state carries `frozen: boolean` -- finding 2");
  expect(/namesFrozen:\s*boolean/.test(publishedStateBody), "[B6] `published` state carries `namesFrozen: boolean` -- finding 5");
  expect(!/matched:\s*\{\s*count/.test(publishedStateBody), "[B6] the OLD `matched: {count, names, total_evaluated_market}` shape is fully gone from `published` state");

  /* ---- B7 (round 4, findings 3/4): the "Your matches" render block      */
  /* iterates the real matchedVendors set, matches the invited badge by    */
  /* SLUG (never by name -- name equality is exactly how Fortinet's badge  */
  /* silently failed), and renders a stable-union "also invited" section   */
  /* for any invited vendor NOT in the matched set, per Robert's own       */
  /* suggested fix. ---- */
  const renderBlockMatch = desk.match(/Your matches<\/p>([\s\S]*?)\{created\?\.id && \(/);
  expect(renderBlockMatch !== null, '[B7] the "Your matches" render block is found');
  const renderSrc = renderBlockMatch?.[1] ?? "";
  expect(/published\.matchedVendors\.map\(\(v, i\) => \{/.test(renderSrc), "[B7] the render block iterates `published.matchedVendors` -- the real shortlist");
  expect(!/published\.matched\.names\.map/.test(desk), "[B7] the OLD `published.matched.names.map(...)` iteration (which silently dropped invited-but-unmatched vendors) is fully gone");
  expect(
    /published\.invited\.some\(\(iv\) => iv\.slug === v\.slug\)/.test(renderSrc),
    "[B7] the invited badge matches by SLUG (`iv.slug === v.slug`) -- name equality silently failed for Fortinet",
  );
  expect(
    !/published\.invited\.find\(\(v\) => v\.name === name\)/.test(desk),
    "[B7] the OLD name-equality invited-badge check is fully gone",
  );
  expect(
    /const invitedOnly = published\.invited\.filter\(\(v\) => !matchedSlugs\.has\(v\.slug\)\);/.test(renderSrc),
    "[B7] a stable union is computed: invited vendors NOT in the matched set (`invitedOnly`) -- finding 3, Robert's own suggested fix",
  );
  expect(/Also invited \(your own pinned/.test(renderSrc), "[B7] the invited-only union renders as a clearly labelled, separate section -- never silently dropped");

  /* ---- B8 (round 4, findings 2/5): the descriptive copy is conditional  */
  /* on `frozen`/`namesFrozen` rather than always claiming full fidelity.  */
  expect(
    /published\.frozen \? ", from this publish's own frozen match" : ", recomputed today/.test(renderSrc),
    '[B8] the "matched out of evaluated" copy is conditional on `published.frozen` -- a legacy no-snapshot project is never described as frozen -- finding 2',
  );
  expect(
    /published\.frozen && !published\.namesFrozen && " Vendor names below are resolved from the current marketplace directory/.test(renderSrc),
    "[B8] a caveat renders when names were resolved live rather than frozen at publish time -- finding 5",
  );

  console.log(`Part B: ${pass}/${pass + fail} passed cumulative.\n`);
}

async function main() {
  await partA();
  await partA2();
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
