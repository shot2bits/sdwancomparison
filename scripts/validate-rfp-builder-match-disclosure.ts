/**
 * Living Procurement Canvas Phase 2 hotfix (14 Aug 2026): RFP Builder
 * pre-publish vendor disclosure, via the normal Project Overview -> "Review
 * and edit" route.
 *
 * A live smoke-test pass against production found `RfpBuilder.tsx` --
 * reached from the Project Overview page's "Review and edit" link
 * (src/app/project/[id]/page.tsx:286, `<Link href={`/rfp-builder/${id}...`}>`)
 * -- disclosing real, project-specific matched vendor names and a narrowed
 * match count BEFORE publication ("Aryaka, AT&T Business, BT Business / BT
 * Global and 18 more fit what you described."). This is the exact
 * disclosure class the whole Phase 2 engagement exists to close
 * (validate-pre-publish-vendor-disclosure.ts, validate-published-resume-
 * hydration.ts), reached through a code path -- RfpBuilder.tsx, a separate,
 * older UI from ProjectDesk.tsx -- that rounds 1-4 never touched.
 *
 * Root cause: `GET /api/rfp/match` has no project id or status parameter at
 * all -- it cannot distinguish a pre-publish caller from a post-publish
 * one -- yet it used to spread `matchSuppliers()`'s full result (`count`,
 * `names`, `slugs`, all narrowed by the buyer's scope/region/model) into
 * its public, unauthenticated JSON response. RfpBuilder.tsx fetched it
 * directly and rendered `names`/`count` with no publish-status gate.
 *
 * The fix has two halves, matching Robert's instruction exactly:
 *
 *   A) API boundary (`src/app/api/rfp/match/route.ts`) -- proven against
 *      the REAL route handler, non-vacuous by calling the underlying
 *      `matchSuppliers()` library function directly first for the
 *      identical inputs and confirming it DOES carry narrowed `count`/
 *      `names`/`slugs` -- so the redaction proven below is real, not the
 *      absence of anything to redact.
 *
 *   B) UI boundary (`src/components/RfpBuilder.tsx`) -- TOOLING LIMITATION,
 *      same convention as validate-pre-publish-vendor-disclosure.ts's own
 *      Part B (RfpBuilder.tsx is a large, stateful, hook-heavy client
 *      component; no jsdom / @testing-library/react in this repo): proven
 *      structurally, by reading the component's own source text (comments
 *      stripped) and asserting the vendor-identifying code paths are
 *      genuinely retired. Complementary to `npx tsc --noEmit` (run
 *      separately): `matchInfo`'s type no longer carries `count`/`names`
 *      at all, so a code path that tried `matchInfo.names` today would
 *      fail to *compile*, not merely fail this script.
 *
 * Also checked: the `marketReport` pre/post-publish JSX gate, which used
 * `project.status !== "published"` / `=== "published"` (narrow equality --
 * the exact Round-4-finding-1 bug pattern) instead of the shared
 * `hasPublished()` predicate. Not itself an active leak (the upstream
 * `/report` route already gates correctly, round 4), but it mislabelled a
 * qa/evaluation-status project as still "previewing" and could show
 * `marketReport.matched.names` under the wrong panel -- fixed alongside the
 * confirmed leak since it is the same "post-publication vendor results"
 * surface Robert's instruction names.
 *
 * Run standalone: `npx tsx scripts/validate-rfp-builder-match-disclosure.ts`
 * Wired into `npm run validate` (package.json).
 */

import { readFileSync } from "node:fs";
import { matchSuppliers } from "../src/lib/supplier-match";
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
  console.log("=== Part A: GET /api/rfp/match never returns project-specific vendor data ===\n");

  const { GET: matchRoute } = await import("../src/app/api/rfp/match/route");
  const vendorNames = getAllVendors().map((v) => v.name);

  const SCENARIOS: { label: string; qs: string }[] = [
    { label: "sdwan, uk_ireland+europe, managed", qs: "scope=sdwan&regions=uk_ireland.europe&model=managed" },
    { label: "sase, no regions, diy", qs: "scope=sase&regions=&model=diy" },
    { label: "sse, north_america, any model", qs: "scope=sse&regions=north_america&model=any" },
    { label: "bare default request, no params at all", qs: "" },
  ];

  for (const { label, qs } of SCENARIOS) {
    const url = `https://example.test/api/rfp/match${qs ? `?${qs}` : ""}`;
    const params = new URLSearchParams(qs);
    const opts = {
      scope: params.get("scope") ?? "any",
      regions: (params.get("regions") ?? "").split(".").filter(Boolean),
      model: params.get("model") ?? "any",
    };

    // Non-vacuous sanity check FIRST: the SAME inputs, against the raw
    // library function the route wraps, genuinely carry narrowed,
    // identifying data -- so the redaction proven below is real.
    const raw = matchSuppliers(opts);
    expect(raw.total > 0, `[A/${label}] sanity: matchSuppliers() total (whole market) is non-zero (${raw.total})`);
    expect(typeof raw.count === "number", `[A/${label}] sanity: matchSuppliers() returns a numeric, project-specific \`count\` -- got ${raw.count}`);
    expect(raw.names.length > 0 || raw.count === 0, `[A/${label}] sanity: matchSuppliers() returns real vendor \`names\` when there is a match (${raw.names.length})`);

    const res = await matchRoute(new Request(url));
    expect(res.status === 200, `[A/${label}] route responds 200`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(!("count" in body), `[A/${label}] response JSON has no "count" key (a narrowed, project-specific match count)`);
    expect(!("names" in body), `[A/${label}] response JSON has no "names" key (project-specific matched vendor names)`);
    expect(!("slugs" in body), `[A/${label}] response JSON has no "slugs" key (project-specific matched vendor slugs)`);

    // Belt and braces: no real vendor name string appears ANYWHERE in the
    // serialized response, even inside a field a future edit might add.
    const rawJson = JSON.stringify(body);
    const leaked = vendorNames.filter((n) => rawJson.includes(n));
    expect(
      leaked.length === 0,
      `[A/${label}] no vendor name string appears anywhere in the response body${leaked.length ? ` (leaked: ${leaked.slice(0, 5).join(", ")})` : ""}`,
    );

    // The safe, aggregate-only fields the product rule explicitly allows
    // are still present -- this is a real redaction, not an outage. `total`
    // must still equal the whole evaluated market, filter-independent.
    expect(typeof body.ok === "boolean" && body.ok === true, `[A/${label}] response still carries ok:true`);
    expect(body.total === raw.total, `[A/${label}] response \`total\` equals the whole evaluated-market size (${raw.total}), unnarrowed by this project's filters`);
    expect(typeof body.methodology === "string" && (body.methodology as string).length > 0, `[A/${label}] response still carries a \`methodology\` string`);
  }

  console.log(`Part A: ${pass}/${pass + fail} passed so far.\n`);
}

function partB() {
  console.log("=== Part B: RfpBuilder.tsx structural source proof (Project Overview -> Review and edit route) ===\n");

  const srcRaw = readFileSync(new URL("../src/components/RfpBuilder.tsx", import.meta.url), "utf8");
  const src = codeOnly(srcRaw);

  /* ---- B0: the Project Overview page's "Review and edit" link genuinely */
  /* routes to this component's page -- the fixture is proving the route   */
  /* Robert named, not an unrelated one.                                   */
  const overviewRaw = readFileSync(new URL("../src/app/project/[id]/page.tsx", import.meta.url), "utf8");
  expect(
    /Review and edit<\/Link>/.test(overviewRaw) && /href=\{`\/rfp-builder\/\$\{id\}/.test(overviewRaw),
    "[B0] Project Overview's \"Review and edit\" link routes to /rfp-builder/[id] (RfpBuilder.tsx)",
  );

  /* ---- B1: `matchInfo`'s own type carries no project-specific field --  */
  /* only the aggregate-safe `total`. A code path that tried               */
  /* `matchInfo.names` or `matchInfo.count` today fails to *compile*.      */
  const matchInfoTypeMatch = src.match(/const \[matchInfo, setMatchInfo\] = useState<(\{[^>]*?\}) \| null>\(null\);/);
  expect(matchInfoTypeMatch !== null, "[B1] the `matchInfo` state declaration is found");
  const matchInfoType = matchInfoTypeMatch?.[1] ?? "";
  expect(!/\bcount\s*:/.test(matchInfoType), "[B1] `matchInfo`'s type has no `count` field");
  expect(!/\bnames\s*:/.test(matchInfoType), "[B1] `matchInfo`'s type has no `names` field");
  expect(/\btotal\s*:\s*number/.test(matchInfoType), "[B1] `matchInfo`'s type still carries the aggregate-safe `total` field");

  /* ---- B2: no live code path reads `matchInfo.count` or `matchInfo.names` */
  /* -- the exact fields the live leak rendered ("...and 18 more fit what   */
  /* you described"). `matchInfo.total` (the aggregate market size) is the  */
  /* only field a caller may still read, checked separately in B3.          */
  for (const banned of ["matchInfo.count", "matchInfo?.count", "matchInfo.names", "matchInfo?.names"]) {
    const occurrences = src.split(banned).length - 1;
    expect(occurrences === 0, `[B2] RfpBuilder.tsx (code, comments stripped) contains no "${banned}" (found ${occurrences})`);
  }

  /* ---- B3: `matchInfo.total` is still read at least once, so the whole   */
  /* evaluated-market-size copy ("the marketplace's N verified vendors")    */
  /* survives -- this is a redaction of project-specific data, not an       */
  /* outage of the aggregate, always-safe figure.                          */
  expect(src.includes("matchInfo.total") || src.includes("matchInfo?.total"), "[B3] RfpBuilder.tsx still reads `matchInfo.total` (the aggregate-safe whole-market size) somewhere");

  /* ---- B4: the fetch effect that populates `matchInfo` type-guards on    */
  /* `total`, never `count` -- proving the client can no longer even        */
  /* accidentally set project-specific data into state, since the API no   */
  /* longer sends it.                                                      */
  const fetchEffectMatch = src.match(/fetch\(`\/sase\/api\/rfp\/match\?[\s\S]*?\.catch\(\(\) => \{[\s\S]*?\}\);/);
  expect(fetchEffectMatch !== null, "[B4] the `/api/rfp/match` fetch effect is found");
  const fetchEffectSrc = fetchEffectMatch?.[0] ?? "";
  expect(/typeof d\.total === "number"/.test(fetchEffectSrc), "[B4] the fetch effect type-guards on `d.total`, not `d.count`");
  expect(!/d\.count|d\.names/.test(fetchEffectSrc), "[B4] the fetch effect reads neither `d.count` nor `d.names` from the response");

  /* ---- B5: the "N matched vendors" and vendor-names-list copy Robert's  */
  /* instruction names explicitly (match count, ranking, shortlist, "N     */
  /* matched vendors" copy) is retired from the pre-publish panel -- the   */
  /* live-observed leak block ("Aryaka, AT&T Business, BT Business / BT    */
  /* Global and 18 more fit what you described.") no longer exists at all. */
  for (const retired of ['matched vendor${matchInfo', "matchInfo.names.slice", "and ${matchInfo.count - 3} more fit what you described"]) {
    expect(!src.includes(retired), `[B5] RfpBuilder.tsx no longer contains the retired pre-publish leak fragment "${retired}"`);
  }

  /* ---- B6: the pre-publish "Submit" heading, CTA button and sticky bar   */
  /* all quote generic, vendor-count-free copy -- proven structurally by    */
  /* the absence of any `matchInfo` reference inside their literal button   */
  /* text, not merely by eyeballing the diff.                               */
  expect(src.includes('Submit this RFP to your matched vendors'), "[B6] the pre-publish heading reads generic \"Submit this RFP to your matched vendors\", no count");
  expect(src.includes('{publishing ? "Submitting..." : "Submit to your matched vendors"}'), "[B6] the pre-publish CTA button reads generic \"Submit to your matched vendors\", no count");
  expect(src.includes("submit to your matched vendors. Competing bids, no sales calls."), "[B6] the sticky publish bar reads generic copy, no count");

  /* ---- B7: post-publication vendor results (the "Market Report" panel's */
  /* pre/post gate) use the shared `hasPublished()` predicate, not the     */
  /* narrow `status !== "published"` / `=== "published"` equality that     */
  /* Round 4 already fixed elsewhere in this codebase for the same reason  */
  /* -- a qa/evaluation-status project (genuinely published) must see the  */
  /* real post-publish panel, never the pre-publish "preview" one.         */
  expect(src.includes('import { hasPublished } from "@/lib/project-machine";'), "[B7] RfpBuilder.tsx imports the shared `hasPublished()` predicate");
  const marketReportGateMatch = src.match(/\{marketReport && (!?hasPublished\(project\.status\)) && \(/g) ?? [];
  expect(marketReportGateMatch.length === 2, `[B7] both Market Report panel gates use \`hasPublished(project.status)\` (found ${marketReportGateMatch.length} of 2)`);
  expect(!/marketReport && project\.status/.test(src), "[B7] no Market Report panel gate still uses the narrow `project.status` equality");

  /* ---- B8 (row-8 hotfix, 16 Aug 2026): the ORIGINAL B8 here asserted only */
  /* that the vendors/connections panel reads the owner-gated `/connect`    */
  /* route -- it never checked whether that route (or the panel itself)     */
  /* actually withheld anything before publication. It PASSED on a          */
  /* codebase where `/api/rfp/[id]/connect` had no publish-state check at   */
  /* all, and where the panel rendered real invited-vendor names on a       */
  /* draft project. Owner-gating and publish-state-gating are different     */
  /* questions; this fixture answered only the first and certified the      */
  /* second as if it had been asked. Replaced by the structural checks      */
  /* below (still owner-gating, now ALSO publish-state) plus partC(), which */
  /* proves the actual disclosure question -- names, slugs, rankings,       */
  /* evidence, counts, links, supplier actions unavailable pre-publish,     */
  /* available post-publish -- against the real route handlers and a real  */
  /* rendered page, not source text. */
  expect(src.includes("fetch(`/sase/api/rfp/${project.id}/connect`"), "[B8] the vendors/connections panel reads the owner-gated `/api/rfp/[id]/connect` route");
  expect(src.includes("data.invited?.length"), "[B8] the publish confirmation message quotes the publish route's own `data.invited`, not `/api/rfp/match`");
  expect(src.includes('import { hasPublished } from "@/lib/project-machine";'), "[B8] RfpBuilder.tsx still imports `hasPublished()` (used for lifecycle-only, non-disclosure purposes -- see B9)");

  console.log(`Part B: ${pass}/${pass + fail} passed cumulative.\n`);
}

/**
 * Part B9 (market-unlock correction round, 16 Aug 2026): Robert's ruling on
 * the row-8 checkpoint evidence -- `hasPublished(project.status)` is NOT
 * the canonical market-facing disclosure boundary; a project can satisfy it
 * while its Opportunities Board listing (and therefore its market unlock)
 * has failed, and B8's own structural checks (which asserted the panel's
 * `published` flag delegated to `hasPublished()`) certified exactly that
 * insufficient gate as correct. These checks assert the REPLACEMENT: the
 * canonical `marketUnlocked` client state (sourced from market-unlock.ts
 * via every project read/publish/list-on-board response), and the
 * matching server-side `isMarketUnlocked()` gate on every route this round
 * names. Structural checks here; partD() below proves the same claims
 * against the real route handlers and a real publish sequence.
 */
function partB9() {
  console.log("=== Part B9 (market-unlock correction round): the canonical market-unlock predicate replaces hasPublished() at every disclosure gate ===\n");
  const src = readFileSync(new URL("../src/components/RfpBuilder.tsx", import.meta.url), "utf8");

  expect(/const \[marketUnlocked, setMarketUnlocked\] = useState\(false\);/.test(src), "[B9] RfpBuilder.tsx holds the canonical market-unlock state, defaulting LOCKED");
  expect(/const published = marketUnlocked;/.test(src), "[B9] the panel's own `published` flag now delegates to the canonical `marketUnlocked` state, not `hasPublished(project.status)`");
  expect(/\{published && \(\s*\n\s*<button onClick=\{suggestSuppliers\}/.test(src), "[B9] the \"Suggest best-fit vendors\" button (the trigger for the project-specific vendor match call) is gated on `published` (now == marketUnlocked)");
  expect(/if \(!project \|\| !marketUnlocked\) return;/.test(src), "[B9] suggestSuppliers() itself guards on the canonical `marketUnlocked` state, independent of the button's visibility");
  expect(/\{published && suggestions && suggestions\.length > 0 && \(/.test(src), "[B9] the suggested-vendors block is gated on `published` (now == marketUnlocked)");
  expect(/\{published && \(\s*\n\s*<div className="space-y-3">\s*\n\s*\{connections\.map/.test(src), "[B9] the real connections list (named vendors, messages, actions) is gated on `published` (now == marketUnlocked)");
  expect(/if \(typeof p\.market_unlocked === "boolean"\) setMarketUnlocked\(p\.market_unlocked\);/.test(src), "[B9] applyProject() threads the canonical, server-derived market_unlocked field into client state on every project read");

  const connectSrc = readFileSync(new URL("../src/app/api/rfp/[id]/connect/route.ts", import.meta.url), "utf8");
  expect(/if \(!\(await isMarketUnlocked\(id\)\)\) \{\s*\n\s*return Response\.json\(\s*\n\s*\{ error: "This RFP's market has not unlocked yet/.test(connectSrc), "[B9] the connect route's POST handler refuses to persist a connection unless the canonical market-unlock predicate is true");
  expect(/const access = await requireRfpOwner\(req, project, body as Record<string, unknown>\);\s*\n\s*if \(!access\.ok\) return ownerRequired\("Inviting or messaging vendors", cors\);\s*\n[\s\S]{0,900}if \(!\(await isMarketUnlocked\(id\)\)\)/.test(connectSrc), "[B9] ownership is authenticated BEFORE the market-unlock check (Robert's ordering ruling: an unauthorised caller must not distinguish lifecycle state via 404/409)");

  const projectRouteSrc = readFileSync(new URL("../src/app/api/rfp/[id]/route.ts", import.meta.url), "utf8");
  expect(/if \(!\(await isMarketUnlocked\(id\)\)\) \{\s*\n\s*return Response\.json\(\{ error: "RFP not found\."/.test(projectRouteSrc), "[B9] the share-token project read refuses to serve supplierView() unless the canonical market-unlock predicate is true");

  const reportSrc = readFileSync(new URL("../src/app/api/rfp/[id]/report/route.ts", import.meta.url), "utf8");
  expect(/if \(!\(await isMarketUnlocked\(id\)\)\) \{/.test(reportSrc), "[B9] the market-report (project-specific matching output) route is gated on the canonical market-unlock predicate");

  const downloadSrc = readFileSync(new URL("../src/app/rfp-builder/[id]/preview/download/route.ts", import.meta.url), "utf8");
  expect(/if \(!\(await isMarketUnlocked\(id\)\)\) \{/.test(downloadSrc), "[B9] the Word/PDF/JSON export route is gated on the canonical market-unlock predicate");

  for (const file of ["nda", "thread", "evidence-draft", "respond"]) {
    const s = readFileSync(new URL(`../src/app/api/rfp/[id]/${file}/route.ts`, import.meta.url), "utf8");
    expect(/isMarketUnlocked\(id\)/.test(s), `[B9] the adjacent supplier-capability route ${file}/route.ts applies the canonical market-unlock gate`);
  }

  const publishLibSrc = readFileSync(new URL("../src/lib/rfp-publish.ts", import.meta.url), "utf8");
  expect(/const publishedRevisionId = newId\("snap"\);/.test(publishLibSrc), "[B9] executePublish() freezes a canonical revision id BEFORE the board/invite sequence");
  expect(/await commitMarketUnlock\(\{/.test(publishLibSrc), "[B9] executePublish() commits the MarketUnlock record only after the board opportunity is created");
  expect(/if \(!board\.opportunity_id\) \{[\s\S]{0,600}return \{ published, invited: \[\], criteria: "", board, market_report: lockedReport, matched_vendors: \[\] \};/.test(publishLibSrc), "[B9] a board-listing failure returns a genuinely locked result -- no invited vendors, no matched vendors");
  expect(/const gate = publishDecisionGate\(signoffs, working\.consents\);\s*\n\s*if \(gate\.blocked\) throw new DeclinedApprovalError\(gate\.confirmationText\);\s*\n\s*\n\s*\/\/ FREEZE THE CANONICAL REVISION/.test(publishLibSrc), "[B9] the D5 declined-approval gate runs BEFORE any board/invite side effect (moved up from after the invite loop)");
  expect(/for \(const v of inviteSlugs\.map\(\(slug\) => \(\{ slug \}\)\)\) \{\s*\n\s*const r = await inviteSupplier\(/.test(publishLibSrc.slice(publishLibSrc.indexOf("ONLY NOW: calculate matching"))), "[B9] the invite loop runs strictly after the market-unlock commit (positionally, in the ONLY-NOW block)");

  console.log(`Part B: ${pass}/${pass + fail} passed cumulative.\n`);
}

/**
 * Part C (row-8 hotfix, 16 Aug 2026): production-path proof for the
 * pre-publication supplier-identity/matching disclosure Robert's brief
 * calls a release-blocking invariant. Runs the REAL route handlers --
 * `POST /api/rfp` (create), `POST /api/rfp/[id]/connect`, `GET
 * /api/rfp/[id]` -- against a real Upstash-REST-compatible backend
 * (fake-kv-server.mjs: same in-memory command vocabulary, same protocol;
 * only the network hop to a real Upstash instance is swapped out, exactly
 * as Engagement A's browser fixture established for this sandbox). This is
 * not a mock of the application: it is the production rfp-store.ts,
 * rfp-connect.ts and project-machine.ts logic, invoked exactly as the
 * deployed route handlers invoke it.
 *
 * Every access mode Robert's instruction named is tested separately:
 * owner (manage_token), anonymous (no credential at all), and share-token
 * (the supplier response-link credential) -- both pre- and post-publication,
 * so this proves both halves: nothing leaks before publish, and the
 * intended reveal genuinely happens after it.
 */
async function partC() {
  console.log("=== Part C: production-path proof, connect + share-token reads, owner/anonymous/share-token, pre/post publish ===\n");

  const { startFakeKv } = await import("./lib/fake-kv-server.mjs");
  const kvServer = await startFakeKv();
  process.env.KV_REST_API_URL = kvServer.url;
  process.env.KV_REST_API_TOKEN = kvServer.token;

  try {
    const { POST: createRoute } = await import("../src/app/api/rfp/route");
    const { POST: connectRoute, GET: listConnectionsRoute } = await import("../src/app/api/rfp/[id]/connect/route");
    const { GET: projectReadRoute } = await import("../src/app/api/rfp/[id]/route");
    const { POST: respondRoute } = await import("../src/app/api/rfp/[id]/respond/route");

    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

    const createRes = await createRoute(
      new Request("https://example.test/api/rfp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "B8 production-path fixture RFP", buyer: { sector: "manufacturing", organisation_size: "201-1000", operating_model: "hybrid", regions: ["uk"] } }),
      }),
    );
    expect(createRes.status === 200, "[C0] draft creation succeeds");
    const project = (await createRes.json()) as { id: string; status: string; share_token: string; manage_token: string };
    expect(project.status === "draft", "[C0] the created project starts in \"draft\" status");

    // ---- Anonymous access: no credential at all. Must be refused
    // regardless of publish state -- the bare id alone (present in every
    // URL, log line and referrer header) must never be sufficient.
    const anonPreRes = await projectReadRoute(new Request(`https://example.test/api/rfp/${project.id}`), ctx(project.id));
    expect(anonPreRes.status === 401, `[C1/anonymous] pre-publish anonymous read is refused (401), got ${anonPreRes.status}`);

    // ---- Share-token access, pre-publish: this is the exact disclosure
    // R0 found -- the "Response link" is copyable from the moment a draft
    // is created (share_token is minted at creation, not at publish), so
    // this credential is real and reachable before publication.
    const sharePreRes = await projectReadRoute(new Request(`https://example.test/api/rfp/${project.id}?token=${project.share_token}`), ctx(project.id));
    expect(sharePreRes.status === 404, `[C1/share-token] pre-publish share-token read is refused as "not found" (not a distinguishable "not published yet"), got ${sharePreRes.status}`);

    // ---- Owner access, pre-publish, via connect (invite): the actual
    // supplier-contact write. Must be refused, and -- separately, non-
    // vacuously -- must not have persisted a SupplierConnection.
    const invitePreRes = await connectRoute(
      new Request(`https://example.test/api/rfp/${project.id}/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor_slug: "cato-networks", intro: "fixture invite", manage_token: project.manage_token }),
      }),
      ctx(project.id),
    );
    expect(invitePreRes.status === 409, `[C1/owner] pre-publish invite is refused (409 market_locked), got ${invitePreRes.status}`);
    const invitePreBody = (await invitePreRes.json()) as { vendor_slug?: string; code?: string };
    // Market-unlock correction round (16 Aug 2026): the connect route used
    // to carry a status-derived "not_published" code distinct from the
    // published-but-locked case's own code; it now uses ONE canonical
    // "market_locked" code for BOTH a plain draft and a published-but-
    // never-board-listed project, since `isMarketUnlocked()` is false in
    // either case and this route asks exactly one question. Compare
    // against [C2/owner] below, which hits the identical code from the
    // published-but-locked state.
    expect(invitePreBody.code === "market_locked", "[C1/owner] the refusal names the canonical reason (\"market_locked\"), not a generic error");
    expect(!invitePreBody.vendor_slug, "[C1/owner] the refusal response carries no SupplierConnection shape (nothing was constructed to return)");

    const listPreRes = await listConnectionsRoute(new Request(`https://example.test/api/rfp/${project.id}/connect`, { headers: { "x-manage-token": project.manage_token } }), ctx(project.id));
    const listPreBody = (await listPreRes.json()) as { connections?: unknown[] };
    expect((listPreBody.connections?.length ?? -1) === 0, `[C1/owner] independently listing connections after the refused invite shows zero persisted (non-vacuous: proves the 409 above was not just a misleading response over a real write), found ${listPreBody.connections?.length}`);

    // ---- Market-unlock correction round (16 Aug 2026): flip the same
    // project to a genuinely post-publish INTERNAL status via the same
    // store the route handlers use (saveProject), exactly as before -- but
    // WITHOUT ever calling listRfpOnBoard()/commitMarketUnlock(). This is
    // Robert's exact item-1 reproduction, against real route handlers:
    // "project.status satisfies hasPublished(); the opportunity is not
    // listed on the board; named suppliers are nevertheless visible or
    // contactable" was the pre-correction defect this section used to
    // certify as FIXED (it asserted 200/200/200 below). It is not: the
    // canonical MarketUnlock record is the only thing any governed route
    // now consults, and none exists for this project, so every one of
    // those reads/writes must stay refused despite `hasPublished()` reading
    // true. Part D (below) proves the positive counterpart: the SAME
    // routes correctly open once a real board listing + MarketUnlock
    // commit have happened.
    const { getProject, saveProject } = await import("../src/lib/rfp-store");
    const { isMarketUnlocked, getMarketUnlock } = await import("../src/lib/market-unlock");
    const stored = await getProject(project.id);
    if (!stored) throw new Error("fixture project vanished between create and publish-flip");
    await saveProject({ ...stored, status: "published" });

    expect(!(await isMarketUnlocked(project.id)), "[C2/reproduction] hasPublished()-true-but-never-board-listed: isMarketUnlocked() correctly reads false");
    expect((await getMarketUnlock(project.id)) === null, "[C2/reproduction] no MarketUnlock record exists for this project (nothing to spuriously read)");

    const anonPostRes = await projectReadRoute(new Request(`https://example.test/api/rfp/${project.id}`), ctx(project.id));
    expect(anonPostRes.status === 401, `[C2/anonymous] post-status-flip anonymous read is STILL refused (401) -- publication never lowers the owner/share-token bar, got ${anonPostRes.status}`);

    // THE flip from this file's pre-correction version: a share-token read
    // against a project whose status says "published" but whose market
    // never unlocked must be refused, indistinguishably from "not found" --
    // not served, as the pre-correction code (and this fixture's own old
    // assertion) treated as correct.
    const sharePostRes = await projectReadRoute(new Request(`https://example.test/api/rfp/${project.id}?token=${project.share_token}`), ctx(project.id));
    expect(sharePostRes.status === 404, `[C2/share-token] the exact mismatch Robert flagged: hasPublished() true, market never unlocked -- share-token read is now correctly refused (404), got ${sharePostRes.status}`);
    const sharePostBody = (await sharePostRes.json()) as { error?: string };
    expect(sharePostBody.error === "RFP not found.", "[C2/share-token] refused with the SAME \"not found\" wording a nonexistent id gets -- no distinguishable \"not unlocked yet\" oracle");

    const invitePostRes = await connectRoute(
      new Request(`https://example.test/api/rfp/${project.id}/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor_slug: "fortinet", intro: "fixture invite, status-flip only", manage_token: project.manage_token }),
      }),
      ctx(project.id),
    );
    expect(invitePostRes.status === 409, `[C2/owner] inviting a named vendor is STILL refused (409) despite hasPublished() reading true -- got ${invitePostRes.status}`);
    const invitePostBody = (await invitePostRes.json()) as { vendor_slug?: string; code?: string };
    expect(invitePostBody.code === "market_locked", "[C2/owner] the refusal names the canonical reason (\"market_locked\") -- the SAME code [C1/owner] got from a plain draft, since both states share the one thing that actually matters: no MarketUnlock record exists");
    expect(!invitePostBody.vendor_slug, "[C2/owner] the refusal carries no SupplierConnection shape -- nothing was constructed to return");

    const listPostRes = await listConnectionsRoute(new Request(`https://example.test/api/rfp/${project.id}/connect`, { headers: { "x-manage-token": project.manage_token } }), ctx(project.id));
    const listPostBody = (await listPostRes.json()) as { connections?: unknown[] };
    expect((listPostBody.connections?.length ?? -1) === 0, `[C2/owner] independently listing connections after the refused invite shows zero persisted -- the status flip alone invited nobody, found ${listPostBody.connections?.length}`);

    // GET /api/rfp/[id] as owner: the sibling market_unlocked/market_unlock
    // keys read false/null too, so the builder's own read of its market
    // state agrees with every gated route, not just the share-token path.
    const ownerReadRes = await projectReadRoute(new Request(`https://example.test/api/rfp/${project.id}`, { headers: { "x-manage-token": project.manage_token } }), ctx(project.id));
    const ownerReadBody = (await ownerReadRes.json()) as { market_unlocked?: boolean; market_unlock?: unknown };
    expect(ownerReadBody.market_unlocked === false, "[C2/owner] the owner's own project read reports market_unlocked:false in this exact mismatch state");
    expect(ownerReadBody.market_unlock === null, "[C2/owner] the owner's own project read reports market_unlock:null in this exact mismatch state");

    // The respond route: a DIFFERENT pre-existing check (status must be
    // published/qa) would itself now pass in this state, so this is the
    // one place in this fixture where only the NEW market-unlock check is
    // what stops a supplier submission -- proving it is additive, not
    // redundant with the status check it sits beside.
    const respondPostRes = await respondRoute(
      new Request(`https://example.test/api/rfp/${project.id}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      ctx(project.id),
    );
    expect(respondPostRes.status === 404, `[C2/respond] a supplier response is refused (404) even though project.status now passes the route's OWN "published or qa" check -- only the new market-unlock gate stops it, got ${respondPostRes.status}`);

    console.log(`Part C: ${pass}/${pass + fail} passed cumulative.\n`);

    // Part D runs INSIDE this same try block, reusing this exact kvServer --
    // see partD()'s own header comment for why a second fake-kv instance
    // would be silently ignored by the already-imported route handlers.
    await partD(kvServer);
  } finally {
    await kvServer.stop();
  }
}

/**
 * Part D (market-unlock correction round, 16 Aug 2026): the positive
 * counterpart to Part C's reproduction -- proves that a REAL board listing
 * (the real `listRfpOnBoard()`) plus a REAL `commitMarketUnlock()` commit
 * (the two steps Part C's project deliberately never got) correctly and
 * consistently unlock every governed route, that `list_on_board: false`
 * still unlocks via an unlisted-but-real Opportunity (never a second,
 * ungated path), and that the failure modes Robert's item 7 names --
 * board quality-gate failure, board storage failure -- leave the market
 * genuinely locked with no partial side effects, safely retryable.
 *
 * A REAL end-to-end publish through `executePublish()`/`POST /api/rfp/
 * [id]/publish` is deliberately NOT attempted here, for the same reason
 * validate-living-canvas-phase2-lifecycle.ts's own header comment gives:
 * `executePublish()` always calls `verifyBusinessEmail()`, which does real
 * DNS and HTTPS against the publishing email's domain -- not something a
 * wired `npm run validate` script can depend on. This proves the market-
 * unlock LAYER itself (`listRfpOnBoard()` + `market-unlock.ts`, called
 * exactly as `executePublish()` calls them) against real route handlers
 * and a real fake-kv backend, which is the boundary this correction round
 * actually introduces; `executePublish()`'s own internal ORDERING
 * (freeze-then-gate-then-board-then-unlock-then-invite) is proven
 * structurally in Part B9 against the real source, since it cannot run
 * here for the same DNS reason.
 *
 * Reuses the SAME fake-kv server / KV_REST_API_URL Part C started: the
 * app's KV client caches those env vars at module-import time (the first
 * import anywhere in this process), so a second, differently-addressed
 * fake-kv instance would be silently ignored by every route handler
 * already imported above. `kvServer.outage()`/`restore()` (added to
 * fake-kv-server.mjs for this round) reopen the SAME port for exactly
 * this reason.
 */
async function partD(kvServer: { outage: () => Promise<void>; restore: () => Promise<void> }) {
  console.log("=== Part D: real board listing + MarketUnlock commit correctly unlock every governed route; failure modes leave it genuinely locked ===\n");

  const { POST: createRoute } = await import("../src/app/api/rfp/route");
  const { POST: connectRoute, GET: listConnectionsRoute } = await import("../src/app/api/rfp/[id]/connect/route");
  const { GET: projectReadRoute } = await import("../src/app/api/rfp/[id]/route");
  const { GET: reportRoute } = await import("../src/app/api/rfp/[id]/report/route");
  const { GET: downloadRoute } = await import("../src/app/rfp-builder/[id]/preview/download/route");
  const { GET: ndaRoute } = await import("../src/app/api/rfp/[id]/nda/route");
  const { listRfpOnBoard, BoardQualityGateError } = await import("../src/lib/rfp-publish");
  const { commitMarketUnlock, getMarketUnlock, isMarketUnlocked } = await import("../src/lib/market-unlock");
  const { getProject, saveProject, getOpportunity, listPublicOpportunities, kvGetJson, newId, createSession } = await import("../src/lib/rfp-store");
  const { rfpContentSnapshot, contentHash } = await import("../src/lib/published-snapshot");

  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const OWNER_EMAIL = "buyer-fixture@example-corp.test";

  async function createDraft(title: string): Promise<{ id: string; share_token: string; manage_token: string }> {
    const res = await createRoute(
      new Request("https://example.test/api/rfp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, buyer: { sector: "manufacturing", organisation_size: "201-1000", operating_model: "hybrid", regions: ["uk"] } }),
      }),
    );
    return (await res.json()) as { id: string; share_token: string; manage_token: string };
  }

  /** Bind a real, just-created Opportunity into a real MarketUnlock, the
   *  exact two calls executePublish() itself makes once the board step
   *  succeeds -- never a hand-rolled substitute record. */
  async function unlock(projectId: string, opportunityId: string, visibility: "public" | "unlisted") {
    const p = await getProject(projectId);
    if (!p) throw new Error(`fixture project ${projectId} vanished`);
    const snapshot = rfpContentSnapshot(p);
    const revisionId = newId("snap");
    return commitMarketUnlock({
      project_id: projectId,
      published_revision_id: revisionId,
      board_opportunity_id: opportunityId,
      board_visibility: visibility,
      matching_basis_hash: contentHash(snapshot),
      invitation_snapshot_id: revisionId,
    });
  }

  // ---- D1: successful, default (public) board publication unlocks every
  // governed route, and only every governed route -- the owner/share-token
  // bar itself is untouched by unlocking.
  const p1 = await createDraft("Part D board publication fixture RFP");
  const listed1 = await listRfpOnBoard((await getProject(p1.id))!, OWNER_EMAIL);
  expect(typeof listed1.opportunity_id === "string" && listed1.opportunity_id.length > 0, "[D1] listRfpOnBoard() (the real function) creates a real Opportunity and returns its id");
  expect(!(await isMarketUnlocked(p1.id)), "[D1] a board listing ALONE, with no MarketUnlock commit yet, does not itself unlock the market -- board creation and unlock commit are two distinct steps");
  const unlock1 = await unlock(p1.id, listed1.opportunity_id, "public");
  expect(unlock1.board_opportunity_id === listed1.opportunity_id, "[D1] the committed MarketUnlock binds the exact Opportunity just created");
  expect(await isMarketUnlocked(p1.id), "[D1] isMarketUnlocked() now reads true");

  const ownerRead1 = await projectReadRoute(new Request(`https://example.test/api/rfp/${p1.id}`, { headers: { "x-manage-token": p1.manage_token } }), ctx(p1.id));
  const ownerRead1Body = (await ownerRead1.json()) as { market_unlocked?: boolean; market_unlock?: { board_opportunity_id?: string } };
  expect(ownerRead1Body.market_unlocked === true, "[D1/owner] the owner's own project read now reports market_unlocked:true");
  expect(ownerRead1Body.market_unlock?.board_opportunity_id === listed1.opportunity_id, "[D1/owner] and the exact bound Opportunity id");

  const anonRead1 = await projectReadRoute(new Request(`https://example.test/api/rfp/${p1.id}`), ctx(p1.id));
  expect(anonRead1.status === 401, "[D1/anonymous] unlocking the market never lowers the owner/share-token bar -- anonymous read still refused");

  const shareRead1 = await projectReadRoute(new Request(`https://example.test/api/rfp/${p1.id}?token=${p1.share_token}`), ctx(p1.id));
  expect(shareRead1.status === 200, `[D1/share-token] the intended reveal genuinely happens once the market is unlocked, got ${shareRead1.status}`);
  const shareRead1Body = (await shareRead1.json()) as { viewer?: string; rfp_sections?: unknown[] };
  expect(shareRead1Body.viewer === "supplier" && Array.isArray(shareRead1Body.rfp_sections), "[D1/share-token] carries the real supplier projection with real rfp_sections");

  const invite1 = await connectRoute(
    new Request(`https://example.test/api/rfp/${p1.id}/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vendor_slug: "fortinet", intro: "Part D fixture invite", manage_token: p1.manage_token }),
    }),
    ctx(p1.id),
  );
  expect(invite1.status === 200, `[D1/owner] inviting a named vendor now succeeds once the market has genuinely unlocked, got ${invite1.status}`);
  const invite1Body = (await invite1.json()) as { vendor_slug?: string; vendor_name?: string };
  expect(invite1Body.vendor_slug === "fortinet" && typeof invite1Body.vendor_name === "string" && invite1Body.vendor_name.length > 0, "[D1/owner] returns a real, named SupplierConnection");

  const list1 = await listConnectionsRoute(new Request(`https://example.test/api/rfp/${p1.id}/connect`, { headers: { "x-manage-token": p1.manage_token } }), ctx(p1.id));
  const list1Body = (await list1.json()) as { connections?: { vendor_slug: string }[] };
  expect((list1Body.connections?.length ?? 0) === 1 && list1Body.connections?.[0]?.vendor_slug === "fortinet", "[D1/owner] the invitation is genuinely persisted and independently readable back");

  const report1 = await reportRoute(new Request(`https://example.test/api/rfp/${p1.id}/report`, { headers: { "x-manage-token": p1.manage_token } }), ctx(p1.id));
  const report1Body = (await report1.json()) as { ok?: boolean; preview?: boolean; market_report?: unknown };
  expect(report1Body.ok === true && !report1Body.preview && report1Body.market_report !== undefined, "[D1/owner] the market report route now returns the full (non-preview) shape, not the locked readiness-only projection");

  const publicOpps1 = await listPublicOpportunities();
  expect(publicOpps1.some((o) => o.id === listed1.opportunity_id), "[D1] the public visibility Opportunity genuinely appears on the public board feed");

  // ---- D2: explicit list_on_board:false still creates a real (unlisted)
  // Opportunity and still unlocks -- board publication is a prerequisite
  // in EITHER case, per Robert's ruling; only public crawlability differs.
  const p2 = await createDraft("Part D unlisted board fixture RFP");
  const listed2 = await listRfpOnBoard((await getProject(p2.id))!, OWNER_EMAIL, { visibility: "unlisted" });
  await unlock(p2.id, listed2.opportunity_id, "unlisted");
  expect(await isMarketUnlocked(p2.id), "[D2] an unlisted board publication unlocks the market exactly like a public one");
  const opp2 = await getOpportunity(listed2.opportunity_id);
  expect(opp2?.visibility === "unlisted", "[D2] the created Opportunity's own visibility field is genuinely \"unlisted\"");
  const shareRead2 = await projectReadRoute(new Request(`https://example.test/api/rfp/${p2.id}?token=${p2.share_token}`), ctx(p2.id));
  expect(shareRead2.status === 200, "[D2/share-token] the supplier-facing reveal still happens for an unlisted listing -- \"matched suppliers only\" is a public-board-visibility choice, not a lesser unlock");
  const publicOpps2 = await listPublicOpportunities();
  expect(!publicOpps2.some((o) => o.id === listed2.opportunity_id), "[D2] the unlisted Opportunity does NOT appear on the public board feed, matching the buyer's \"matched suppliers only\" choice");

  // ---- D3: board quality-gate failure -- no Opportunity, no MarketUnlock,
  // no partial side effects, and the failure is the SAME real quality gate
  // executePublish() itself would hit.
  const p3 = await createDraft("Test placeholder RFP for the quality gate fixture");
  let gateThrew = false;
  try {
    await listRfpOnBoard((await getProject(p3.id))!, OWNER_EMAIL);
  } catch (e) {
    gateThrew = e instanceof BoardQualityGateError;
  }
  expect(gateThrew, "[D3] a title tripping the public quality gate (\"test\"/placeholder wording) makes the REAL listRfpOnBoard() throw BoardQualityGateError");
  const boardOppKey3 = await kvGetJson<string>(`rfp:${p3.id}:board_opp`);
  expect(boardOppKey3 === null, "[D3] no Opportunity id was ever recorded for this project -- the failed attempt left nothing behind to retry against inconsistently");
  expect(!(await isMarketUnlocked(p3.id)), "[D3] the market never unlocked for this project");
  expect((await getMarketUnlock(p3.id)) === null, "[D3] no MarketUnlock record exists -- no partial side effect from the failed board attempt");
  const shareRead3 = await projectReadRoute(new Request(`https://example.test/api/rfp/${p3.id}?token=${(await getProject(p3.id))!.share_token}`), ctx(p3.id));
  expect(shareRead3.status === 404, "[D3] a supplier-facing read still correctly refuses after a quality-gate failure");

  // ---- D4: board storage failure (a real, transport-level outage of the
  // fake-kv backend the app talks to, via the outage()/restore() harness
  // added for this round) -- and a subsequent retry against the CURRENT
  // project content succeeds cleanly once storage recovers.
  const p4 = await createDraft("Part D storage-outage fixture RFP");
  await kvServer.outage();
  let storageThrew = false;
  try {
    await listRfpOnBoard((await getProject(p4.id))!, OWNER_EMAIL);
  } catch {
    storageThrew = true;
  }
  expect(storageThrew, "[D4] listRfpOnBoard() genuinely fails while the KV backend is down (a real transport error, not a quality-gate refusal)");
  await kvServer.restore();
  expect(!(await isMarketUnlocked(p4.id)), "[D4] the market is still locked immediately after the outage -- no partial commit survived it");
  const listed4 = await listRfpOnBoard((await getProject(p4.id))!, OWNER_EMAIL);
  expect(typeof listed4.opportunity_id === "string" && listed4.opportunity_id.length > 0, "[D4] once storage is restored, a retry against the SAME project succeeds and creates a real Opportunity");
  const unlock4 = await unlock(p4.id, listed4.opportunity_id, "public");
  expect(await isMarketUnlocked(p4.id), "[D4] and the market unlocks on this successful retry");

  // ---- D5: idempotent publication replay -- committing the exact same
  // (project, revision, opportunity) triple again never mints a second
  // record or moves the unlock timestamp.
  const replay5 = await commitMarketUnlock({
    project_id: p4.id,
    published_revision_id: unlock4.published_revision_id,
    board_opportunity_id: unlock4.board_opportunity_id,
    board_visibility: "public",
    matching_basis_hash: unlock4.matching_basis_hash,
    invitation_snapshot_id: unlock4.invitation_snapshot_id,
  });
  expect(replay5.id === unlock4.id, "[D5] an idempotent replay of the same publish returns the SAME MarketUnlock record id, not a freshly minted one");
  expect(replay5.unlocked_at === unlock4.unlocked_at, "[D5] and the original unlocked_at timestamp is preserved, never moved by the replay");

  // ---- D6: qa/evaluation after a valid board publication -- the market
  // stays unlocked purely because MarketUnlock exists, independent of
  // whatever the project's own lifecycle status later becomes.
  for (const laterStatus of ["qa", "evaluation"] as const) {
    const current = await getProject(p1.id);
    if (!current) throw new Error(`fixture project ${p1.id} vanished`);
    await saveProject({ ...current, status: laterStatus });
    expect(await isMarketUnlocked(p1.id), `[D6] isMarketUnlocked() stays true once the project's own status later advances to "${laterStatus}"`);
    const shareReadLater = await projectReadRoute(new Request(`https://example.test/api/rfp/${p1.id}?token=${p1.share_token}`), ctx(p1.id));
    expect(shareReadLater.status === 200, `[D6] the share-token read stays open at status "${laterStatus}", got ${shareReadLater.status}`);
  }

  // ---- D7: identities/exports genuinely unavailable before market unlock
  // (a fresh, never-listed draft), covering the export route and the
  // adjacent nda/thread/evidence-draft/respond family's own representative
  // (nda, no vendor param -- proceeds past the gate to a 200 once
  // unlocked, proving the gate is what was blocking it, nothing else).
  const p5 = await createDraft("Part D pre-unlock export/nda fixture RFP");
  const session5 = await createSession({ role: "buyer", email: OWNER_EMAIL, vendor_slug: null });
  const downloadPre = await downloadRoute(
    new Request(`https://example.test/rfp-builder/${p5.id}/preview/download?manage=${p5.manage_token}`, { headers: { cookie: `netify_session=${session5.token}` } }),
    ctx(p5.id),
  );
  expect(downloadPre.status === 403, `[D7/export] the Word/PDF export is refused before market unlock, got ${downloadPre.status}`);
  const downloadPreBody = (await downloadPre.json()) as { publish_required?: boolean };
  expect(downloadPreBody.publish_required === true, "[D7/export] names the reason (publish_required) so the buyer knows what unlocks it");

  const ndaPre = await ndaRoute(new Request(`https://example.test/api/rfp/${p5.id}/nda?token=${p5.share_token}`), ctx(p5.id));
  expect(ndaPre.status === 404, `[D7/nda] the NDA route refuses (404) before market unlock, got ${ndaPre.status}`);

  const listed5 = await listRfpOnBoard((await getProject(p5.id))!, OWNER_EMAIL);
  await unlock(p5.id, listed5.opportunity_id, "public");
  const ndaPost = await ndaRoute(new Request(`https://example.test/api/rfp/${p5.id}/nda?token=${p5.share_token}`), ctx(p5.id));
  expect(ndaPost.status === 200, `[D7/nda] and the SAME route opens (200) once the market genuinely unlocks -- proving the gate, not something else, was what blocked it, got ${ndaPost.status}`);

  console.log(`Part D: ${pass}/${pass + fail} passed cumulative.\n`);
}

async function main() {
  await partA();
  partB();
  partB9();
  await partC(); // partC() also runs partD() internally, inside the same fake-kv session

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
