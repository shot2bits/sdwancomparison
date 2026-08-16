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
  expect(src.includes('import { hasPublished } from "@/lib/project-machine";'), "[B8] RfpBuilder.tsx imports the shared `hasPublished()` predicate (already required by B7)");
  expect(/const published = hasPublished\(project\.status\);/.test(src), "[B8] the panel's own `published` flag delegates to `hasPublished()`, not a parallel status-equality re-derivation");
  expect(/\{published && \(\s*\n\s*<button onClick=\{suggestSuppliers\}/.test(src), "[B8] the \"Suggest best-fit vendors\" button (the trigger for the project-specific vendor match call) is gated on `published`");
  expect(/if \(!project \|\| !hasPublished\(project\.status\)\) return;/.test(src), "[B8] suggestSuppliers() itself guards on `hasPublished()`, independent of the button's visibility");
  expect(/\{published && suggestions && suggestions\.length > 0 && \(/.test(src), "[B8] the suggested-vendors block is gated on `published`");
  expect(/\{published && \(\s*\n\s*<div className="space-y-3">\s*\n\s*\{connections\.map/.test(src), "[B8] the real connections list (named vendors, messages, actions) is gated on `published`");
  expect(/if \(!hasPublished\(project\.status\)\) \{\s*\n\s*return Response\.json\(\s*\n\s*\{ error: "Publish the RFP before inviting or contacting vendors\./.test(readFileSync(new URL("../src/app/api/rfp/[id]/connect/route.ts", import.meta.url), "utf8")), "[B8] the connect route itself refuses to persist a connection before publish (defence in depth behind the UI gate)");
  expect(/if \(!hasPublished\(project\.status\)\) \{\s*\n\s*return Response\.json\(\{ error: "RFP not found\."/.test(readFileSync(new URL("../src/app/api/rfp/[id]/route.ts", import.meta.url), "utf8")), "[B8] the share-token project read refuses to serve supplierView() before publish");

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
    expect(invitePreRes.status === 409, `[C1/owner] pre-publish invite is refused (409 not_published), got ${invitePreRes.status}`);
    const invitePreBody = (await invitePreRes.json()) as { vendor_slug?: string; code?: string };
    expect(invitePreBody.code === "not_published", "[C1/owner] the refusal names the reason (\"not_published\"), not a generic error");
    expect(!invitePreBody.vendor_slug, "[C1/owner] the refusal response carries no SupplierConnection shape (nothing was constructed to return)");

    const listPreRes = await listConnectionsRoute(new Request(`https://example.test/api/rfp/${project.id}/connect`, { headers: { "x-manage-token": project.manage_token } }), ctx(project.id));
    const listPreBody = (await listPreRes.json()) as { connections?: unknown[] };
    expect((listPreBody.connections?.length ?? -1) === 0, `[C1/owner] independently listing connections after the refused invite shows zero persisted (non-vacuous: proves the 409 above was not just a misleading response over a real write), found ${listPreBody.connections?.length}`);

    // ---- Flip the same project to a genuinely post-publish status via the
    // same store the route handlers use (saveProject), not a raw KV poke --
    // this exercises the real schema/history/phase guards saveProject
    // enforces, isolating exactly the boundary this hotfix owns (does
    // hasPublished()'s TRUE branch correctly restore access?) without
    // re-running the unrelated publish orchestration (sign-in, vendor
    // ranking, board listing, notification email).
    const { getProject, saveProject } = await import("../src/lib/rfp-store");
    const stored = await getProject(project.id);
    if (!stored) throw new Error("fixture project vanished between create and publish-flip");
    await saveProject({ ...stored, status: "published" });

    const anonPostRes = await projectReadRoute(new Request(`https://example.test/api/rfp/${project.id}`), ctx(project.id));
    expect(anonPostRes.status === 401, `[C2/anonymous] post-publish anonymous read is STILL refused (401) -- publication never lowers the owner/share-token bar, got ${anonPostRes.status}`);

    const sharePostRes = await projectReadRoute(new Request(`https://example.test/api/rfp/${project.id}?token=${project.share_token}`), ctx(project.id));
    expect(sharePostRes.status === 200, `[C2/share-token] post-publish share-token read now succeeds, got ${sharePostRes.status}`);
    const sharePostBody = (await sharePostRes.json()) as { rfp_sections?: unknown[]; viewer?: string };
    expect(sharePostBody.viewer === "supplier", "[C2/share-token] the post-publish share-token read returns the supplier projection");
    expect(Array.isArray(sharePostBody.rfp_sections), "[C2/share-token] the post-publish share-token read carries real rfp_sections (the intended reveal actually happens)");

    const invitePostRes = await connectRoute(
      new Request(`https://example.test/api/rfp/${project.id}/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendor_slug: "fortinet", intro: "fixture invite, post-publish", manage_token: project.manage_token }),
      }),
      ctx(project.id),
    );
    expect(invitePostRes.status === 200, `[C2/owner] post-publish invite now succeeds, got ${invitePostRes.status}`);
    const invitePostBody = (await invitePostRes.json()) as { vendor_slug?: string; vendor_name?: string; token?: string };
    expect(invitePostBody.vendor_slug === "fortinet", "[C2/owner] the post-publish invite returns a real SupplierConnection naming the vendor (the frozen identity Robert's step 6 asks to prove is available after publication)");
    expect(typeof invitePostBody.vendor_name === "string" && invitePostBody.vendor_name.length > 0, "[C2/owner] the post-publish invite response carries a real vendor_name");
    expect(typeof invitePostBody.token === "string" && invitePostBody.token.length > 0, "[C2/owner] the post-publish invite mints a real per-supplier response-link token");

    const listPostRes = await listConnectionsRoute(new Request(`https://example.test/api/rfp/${project.id}/connect`, { headers: { "x-manage-token": project.manage_token } }), ctx(project.id));
    const listPostBody = (await listPostRes.json()) as { connections?: { vendor_slug: string }[] };
    expect((listPostBody.connections?.length ?? 0) === 1 && listPostBody.connections?.[0]?.vendor_slug === "fortinet", "[C2/owner] the invited connection is genuinely persisted and independently readable back");
  } finally {
    await kvServer.stop();
  }

  console.log(`Part C: ${pass}/${pass + fail} passed cumulative.\n`);
}

async function main() {
  await partA();
  partB();
  await partC();

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
