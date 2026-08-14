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
 * Two halves, mirroring validate-pre-publish-vendor-disclosure.ts's own
 * split:
 *
 *   A) Route-level data availability: the owner-gated `GET /api/rfp/[id]`
 *      response carries `status` and `invited_vendors`, and `GET
 *      /api/rfp/[id]/report` correctly gates `market_report` on publish
 *      status -- the two data contracts this fix's client-side hydration
 *      depends on. Proven against the real route handlers, for a DRAFT
 *      project (no live business-email verification needed, so this stays
 *      inside the build gate). The full end-to-end proof -- a REAL publish,
 *      then a byte-for-byte fidelity check that resume-hydration
 *      reproduces exactly what that publish returned -- needs a real
 *      publish (verifyBusinessEmail() does real DNS/HTTPS, the same
 *      limitation documented on verify-phase2-publish-lifecycle-live-
 *      demo.ts) and lives in the companion script
 *      scripts/verify-round3-resume-after-publish-live-demo.ts, run by
 *      hand, NOT wired into `npm run validate` for that reason.
 *
 *   B) UI/component structural proof (TOOLING LIMITATION, reported
 *      honestly, same convention as validate-pre-publish-vendor-
 *      disclosure.ts's own Part B): ProjectDesk.tsx's resume effect is
 *      read as source text and checked for the specific wiring this fix
 *      requires -- the resume-fetch type carries `status`/`invited_vendors`,
 *      the report/market fetches are conditioned on `status === "published"`,
 *      `setPhase("fits")` is called so the rehydrated panel actually
 *      renders (not just sits in state), and the "reopened" message is
 *      gated on the ACTUAL hydration outcome rather than merely echoing
 *      `proj.status` (a failed best-effort fetch must never claim matches
 *      are showing).
 *
 * Run standalone: `npx tsx scripts/validate-published-resume-hydration.ts`
 * Wired into `npm run validate` (package.json) alongside every other
 * validate-*.ts / verify-*.ts script.
 */

import { readFileSync } from "node:fs";
import { withFakeKv, makeRequest } from "./fake-kv-harness";
import type { SecurityRequirementInput } from "../src/lib/security/rulebook";

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
    // is what makes the client's `if (proj.status === "published")` guard
    // meaningful, not redundant -- a draft must carry no `market_report`.
    const reportRes = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${id}/report?manage=${manage}`), { params: Promise.resolve({ id }) });
    const reportBody = (await reportRes.json()) as Record<string, unknown>;
    expect(reportRes.status === 200, "[A] report route succeeds for a draft");
    expect(reportBody.preview === true, "[A] a draft's report route returns preview:true");
    expect(!("market_report" in reportBody), "[A] a draft's report route carries no `market_report` key at all -- the status guard this fix relies on is load-bearing");
  });

  console.log(`Part A: ${pass}/${pass + fail} passed so far.\n`);
}

function partB() {
  console.log("=== Part B: ProjectDesk.tsx resume-hydration structural proof ===\n");

  const deskSrcRaw = readFileSync(new URL("../src/components/ProjectDesk.tsx", import.meta.url), "utf8");
  const desk = codeOnly(deskSrcRaw);

  /* ---- B1: the resume-fetch type carries the fields this fix reads. ---- */
  const resumeTypeMatch = desk.match(/const proj = \(await res\.json\(\)\) as \{([\s\S]*?)\n {10}\};/);
  expect(resumeTypeMatch !== null, "[B1] the resume-fetch response type is found");
  const resumeTypeBody = resumeTypeMatch?.[1] ?? "";
  expect(/status\?:\s*string/.test(resumeTypeBody), "[B1] the resume-fetch type carries `status?: string`");
  expect(/invited_vendors\?:\s*string\[\]/.test(resumeTypeBody), "[B1] the resume-fetch type carries `invited_vendors?: string[]`");

  /* ---- B2: the hydration is conditioned on the REAL persisted status,   */
  /* not merely attempted unconditionally (which would silently no-op or  */
  /* misrender for a draft).                                               */
  expect(/if \(proj\.status === "published"\) \{/.test(desk), '[B2] the resume block gates report/market hydration on `proj.status === "published"`');

  /* ---- B3: both the report route and the market route are called,      */
  /* exactly the frozen/general sources -- never `fit`/`rankedFits`.       */
  const hydrationBlockMatch = desk.match(/let rehydratedPublished = false;([\s\S]*?)\n {10}say\(/);
  expect(hydrationBlockMatch !== null, "[B3] the resume-hydration block (between the `rehydratedPublished` flag and the closing `say(`) is found");
  const hydrationSrc = hydrationBlockMatch?.[1] ?? "";
  expect(/\/rfp\/\$\{encodeURIComponent\(resumeId\)\}\/report/.test(hydrationSrc), "[B3] the hydration block fetches this project's own /report route");
  expect(/\/api\/workspace\/market/.test(hydrationSrc), "[B3] the hydration block fetches the general, non-project-specific /api/workspace/market route for display names");
  expect(!/rankedFits|keptFits|fitSlugs|\bfit\.suppliers\b|\bfit\?\.suppliers\b/.test(hydrationSrc), "[B3] the hydration block reads none of the banned per-vendor fit fields");
  expect(/setPublished\(\{/.test(hydrationSrc), "[B3] the hydration block calls `setPublished(`");

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
