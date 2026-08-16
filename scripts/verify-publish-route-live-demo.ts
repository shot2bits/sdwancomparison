/**
 * Fifth amendment (13 Aug 2026), Robert's item 4, the "publish" half: a
 * real route-level demonstration that source_ledger survives the actual
 * /api/rfp/[id]/publish route, not just the create/re-scope routes proven
 * hermetically in scripts/verify-fact-ledger-reliability-gate.ts.
 *
 * Market-unlock correction round 2 (16 Aug 2026): Scenario 1 below used to
 * call publish with `list_on_board: false` and assert `status === "published"`
 * -- that was true under the OLD, now-corrected behaviour (an unlisted
 * publish still flipped the project to "published" and unlocked the
 * market). Under Robert's non-negotiable rule it is now flatly wrong:
 * `list_on_board: false` must never publish, never unlock, and never list
 * anything. Scenario 1 is fixed to `list_on_board: true` so it keeps
 * proving its ORIGINAL point (source_ledger survives a REAL publish call,
 * end to end, against real business-email verification) against a request
 * that actually reaches "published" under the corrected rule. Scenario 2
 * is new: the same real route, same real network dependency, driving
 * `list_on_board: false` specifically to prove it stays locked -- this is
 * one of requirement 6's "drive the real production path" fixtures, which
 * cannot run inside `npm run validate`'s hermetic fixtures because
 * verifyBusinessEmail() needs real DNS/HTTPS (see below).
 *
 * DELIBERATELY NOT part of `npm run validate` / the build gate, and this
 * is a considered choice, not an oversight -- read before wiring it in:
 *
 * executePublish() (rfp-publish.ts) always calls verifyBusinessEmail(),
 * which does REAL DNS (node:dns/promises' resolveMx) and REAL HTTPS
 * (a live website reachability check, plus Companies House when a key is
 * configured). Empirically confirmed this round: neither is mockable from
 * a plain script the way this codebase already mocks `global.fetch` for
 * Anthropic model calls --
 *
 *   - resolveMx is a NAMED import (`import { resolveMx } from
 *     "node:dns/promises"`) inside verify-business.ts. Reassigning the
 *     property on an external `import * as dns` namespace object is a
 *     silent no-op under Node's ESM live-binding semantics (proven with a
 *     throwaway script this round: the assignment "succeeds" without
 *     throwing, but a subsequent real call still hits the real resolver).
 *   - Faking it properly would need a Node loader hook
 *     (`module.register()`) intercepting `node:dns/promises` before
 *     verify-business.ts's first import -- version-sensitive, and exactly
 *     the kind of fragile, environment-coupled test machinery the
 *     existing hermetic-model-mocking rationale in the gate script
 *     explicitly argues against.
 *
 * So this script uses REAL network for that one call, deliberately kept
 * OUT of the build gate: a Vercel build (or any other CI run) should never
 * depend on live DNS/HTTPS to a real domain succeeding, for the same
 * reason the gate script mocks the model instead of calling it for real.
 *
 * Run it by hand when you want live proof beyond the hermetic route-level
 * fixtures: `npx tsx scripts/verify-publish-route-live-demo.ts`.
 * It uses netify.co.uk itself (Robert's own domain, already used for real
 * MX/website checks in the 11 Aug bounce-webhook round) as the publishing
 * email's domain -- never a third party's.
 *
 * Everything else in this flow (KV, the shortlist ranking, saveProject,
 * the session lookup) runs through the SAME real code as
 * verify-fact-ledger-reliability-gate.ts's route-level fixtures, via the
 * same fake-kv-harness.ts, just with `passThroughOtherHosts: true` so the
 * one real network call (and only that one) reaches the internet.
 */

import type { SecurityRequirementInput } from "../src/lib/security/rulebook";
import { withFakeKv, makeRequest } from "./fake-kv-harness";
import type { SourceLedgerEntry } from "../src/lib/workspace/source-ledger";

type RouteProjectLike = { id?: string; manage_token?: string; status?: string; source_ledger?: SourceLedgerEntry[] };
type PublishBody = { ok?: boolean; status?: string; error?: string; market_unlocked?: boolean };

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

// Round 2 correction (16 Aug 2026): `organisation.sector` deliberately
// carries NO value here, not "Healthcare & pharma". That free-text label
// is what the real security-sourcing intake (ProjectDesk.tsx's quick
// facts, SecuritySourcingAdvisor.tsx) actually sends as `buyer.sector`,
// unbridged to the board's catalogue sector KEYS ("healthcare", not
// "Healthcare & pharma") -- publicNoticeQualityGate() (notice-validate.ts)
// then genuinely refuses it as "not a catalogue sector" once Scenario 1
// below asks for a REAL public listing. That refusal is itself correct
// behaviour under requirement 2 (a board quality failure must leave the
// project non-published) and is exercised on its own terms in Scenario 3;
// it would just be the wrong failure to trip for Scenario 1's actual
// purpose (proving source_ledger survives a publish that succeeds), and
// it is a separate, pre-existing sector-label/catalogue-key bridging gap
// -- unrelated to the MarketUnlock saga this round corrects, out of this
// focused round's scope, and worth flagging to Robert separately rather
// than silently fixed here. Leaving `sector` unset falls back to
// SECTOR_NOT_STATED (rfp-publish.ts's `p.buyer.sector || SECTOR_NOT_STATED`),
// which the gate always accepts, so Scenario 1 gets a genuine, real board
// success instead.
const FULL_REQ: SecurityRequirementInput = {
  organisation: {},
  estate: { sites: 20, users: 200, existingSecurity: ["Defender P2"] },
  drivers: ["renewal"],
  constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
};

// Scenario 3 uses a real catalogue sector ON PURPOSE, specifically to
// reproduce the quality-gate failure above and prove requirement 2 against
// it for real: a board quality failure (this exact "not a catalogue
// sector" refusal) must leave the project non-published, market-locked,
// with no MarketUnlock -- not just when the KV is hand-constructed
// (validate-rfp-builder-match-disclosure.ts's Part D4), but through the
// REAL route, REAL business-email verification, and the REAL intake path
// that actually produces this exact failure in production today.
const BOARD_QUALITY_FAILURE_REQ: SecurityRequirementInput = {
  organisation: { sector: "Healthcare & pharma" },
  estate: { sites: 12, users: 90, existingSecurity: ["Defender P2"] },
  drivers: ["renewal"],
  constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
};

async function main() {
  await withFakeKv(
    async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { POST: publishRoute } = await import("../src/app/api/rfp/[id]/publish/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
      const { createSession } = await import("../src/lib/rfp-store");
      const { sessionCookieHeader } = await import("../src/lib/auth");

      // 1. Create (turn A), through the real route -- deliberately NOT
      // test:true this time, since executePublish's shortlist/board logic
      // is exactly what we want exercised for real.
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: {
            requirement: FULL_REQ,
            consent: true,
            source_turns: [{ id: "st_pub_A", text: "Turn A: initial create.", at: 1000, via: "typed" }],
          },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      record(createRes.status === 200, "Create route succeeds", `status=${createRes.status} error=${created.error}`);
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      // 2. The pre-publish refresh (turn B) -- the exact call
      // signAndPublish()'s refreshRecord() makes right before publish.
      const rescopeRes = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_pub_B", text: "Turn B: added just before publish.", at: 2000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(rescopeRes.status === 200, "Pre-publish refresh (re-scope route) succeeds", `status=${rescopeRes.status}`);

      // 3. A real session, so the publish route's hard identity gate
      // (sign-in required, not just manage_token) is satisfied honestly --
      // written into the SAME fake KV via the real createSession(), then
      // carried on the request as a real session cookie.
      const email = "test-buyer@netify.co.uk"; // real, Robert-owned domain; fake local part
      const session = await createSession({ role: "buyer", email, vendor_slug: null });
      const cookie = sessionCookieHeader(session.token);

      // 4. Publish, through the real route -- real business-email
      // verification (real DNS MX + real HTTPS website reachability for
      // netify.co.uk), real shortlist ranking, real saveProject. Round 2
      // correction: `list_on_board: true`, not `false` -- this scenario's
      // whole point is proving source_ledger survives a REAL publish that
      // actually reaches "published"; under the corrected rule only a
      // successful PUBLIC board publication can do that (see Scenario 2
      // below for the `list_on_board: false` case).
      const publishRes = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${id}/publish`, {
          body: { manage_token: manage, shortlist_size: 3, list_on_board: true },
          cookie,
        }),
        { params: Promise.resolve({ id }) },
      );
      const publishBody = (await publishRes.json()) as PublishBody;
      record(
        publishRes.status === 200 && publishBody.ok === true && publishBody.status === "published" && publishBody.market_unlocked === true,
        "Publish route succeeds and unlocks the market (real business-email verification passed for netify.co.uk, real public board publication)",
        `status=${publishRes.status} body=${JSON.stringify(publishBody)}`,
      );

      // 5. Reload the published project (owner read) and confirm BOTH
      // turns -- including turn B, added via the pre-publish refresh --
      // are present in the persisted, now-published record.
      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded = (await reload.json()) as RouteProjectLike;
      const hasBoth = ["st_pub_A", "st_pub_B"].every((tid) => (reloaded.source_ledger ?? []).some((e) => e.id === tid));
      record(
        reload.status === 200 && reloaded.status === "published" && hasBoth,
        "The PUBLISHED project, reloaded through the real route, still carries both source turns -- including the one added via the pre-publish refresh, immediately before this publish call",
        `status=${reload.status} project_status=${reloaded.status} source_ledger=${JSON.stringify(reloaded.source_ledger)}`,
      );

      // ---------------------------------------------------------------
      // Scenario 2 (market-unlock correction round 2, 16 Aug 2026): the
      // SAME real route, SAME real network dependency (verifyBusinessEmail
      // against netify.co.uk), driving `list_on_board: false` specifically.
      // Robert's requirement 6, "drive the real production path and
      // prove: list_on_board:false remains locked" -- this is the one
      // fixture in that list that genuinely needs a live run rather than
      // the hermetic fake-kv route fixtures in
      // validate-rfp-builder-match-disclosure.ts's Part D2a/D2b, because
      // it must pass through the REAL executePublish() including the real
      // business-email gate, not a hand-constructed KV state.
      // ---------------------------------------------------------------
      const { isMarketUnlocked } = await import("../src/lib/market-unlock");
      const { getPublicationAttempt } = await import("../src/lib/publication-attempt");

      const createRes2 = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: {
            requirement: FULL_REQ,
            consent: true,
            source_turns: [{ id: "st_pub_c2_A", text: "Scenario 2: initial create.", at: 1000, via: "typed" }],
          },
        }),
      );
      const created2 = (await createRes2.json()) as { project?: RouteProjectLike; error?: string };
      record(createRes2.status === 200, "Scenario 2: create route succeeds", `status=${createRes2.status} error=${created2.error}`);
      const id2 = created2.project?.id ?? "";
      const manage2 = created2.project?.manage_token ?? "";

      const publishRes2 = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${id2}/publish`, {
          body: { manage_token: manage2, shortlist_size: 3, list_on_board: false },
          cookie,
        }),
        { params: Promise.resolve({ id: id2 }) },
      );
      const publishBody2 = (await publishRes2.json()) as PublishBody;
      record(
        publishRes2.status === 200 && publishBody2.ok === true && publishBody2.status !== "published" && publishBody2.market_unlocked === false,
        "Scenario 2: `list_on_board: false` succeeds as a request but does NOT publish and does NOT unlock the market (real business-email verification still ran and passed)",
        `status=${publishRes2.status} body=${JSON.stringify(publishBody2)}`,
      );

      const unlocked2 = await isMarketUnlocked(id2);
      record(unlocked2 === false, "Scenario 2: isMarketUnlocked() against the real KV state confirms the market is genuinely locked, not just the response body", `market_unlocked=${unlocked2}`);

      const attempt2 = await getPublicationAttempt(id2);
      record(
        attempt2 !== null && attempt2.board_opportunity_id === null && attempt2.unlocked === false,
        "Scenario 2: a PublicationAttempt exists (a real attempt was made) but carries no board_opportunity_id and is not unlocked -- `list_on_board:false` never creates any Opportunity, public or unlisted",
        `attempt=${JSON.stringify(attempt2)}`,
      );

      const reload2 = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id2}?manage=${manage2}`), { params: Promise.resolve({ id: id2 }) });
      const reloaded2 = (await reload2.json()) as RouteProjectLike;
      record(
        reload2.status === 200 && reloaded2.status !== "published",
        "Scenario 2: reloading the project through the real route confirms `status` never flipped to \"published\"",
        `status=${reload2.status} project_status=${reloaded2.status}`,
      );

      // ---------------------------------------------------------------
      // Scenario 3 (market-unlock correction round 2, 16 Aug 2026):
      // Robert's requirement 6, "board quality failure leaves status
      // non-published" -- reproduced here through the REAL production
      // path (real intake shape, real route, real business-email check),
      // not a hand-constructed KV state. `BOARD_QUALITY_FAILURE_REQ`
      // deliberately uses the exact free-text sector label the real
      // security-sourcing UI sends today ("Healthcare & pharma"), which
      // publicNoticeQualityGate() genuinely refuses as "not a catalogue
      // sector" (see the fixture comment above) -- this IS a real board
      // quality failure, not a synthetic one.
      // ---------------------------------------------------------------
      const createRes3 = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: {
            requirement: BOARD_QUALITY_FAILURE_REQ,
            consent: true,
            source_turns: [{ id: "st_pub_c3_A", text: "Scenario 3: initial create.", at: 1000, via: "typed" }],
          },
        }),
      );
      const created3 = (await createRes3.json()) as { project?: RouteProjectLike; error?: string };
      record(createRes3.status === 200, "Scenario 3: create route succeeds", `status=${createRes3.status} error=${created3.error}`);
      const id3 = created3.project?.id ?? "";
      const manage3 = created3.project?.manage_token ?? "";

      const publishRes3 = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${id3}/publish`, {
          body: { manage_token: manage3, shortlist_size: 3, list_on_board: true },
          cookie,
        }),
        { params: Promise.resolve({ id: id3 }) },
      );
      const publishBody3 = (await publishRes3.json()) as PublishBody & { board?: { listed?: boolean; reason?: string } };
      record(
        publishRes3.status === 200 && publishBody3.ok === true && publishBody3.board?.listed === false && publishBody3.status !== "published" && publishBody3.market_unlocked === false,
        "Scenario 3: a REAL board quality-gate failure (real production sector-label mismatch, not a synthetic one) leaves the project non-published and market-locked",
        `status=${publishRes3.status} body=${JSON.stringify(publishBody3)}`,
      );

      const unlocked3 = await isMarketUnlocked(id3);
      record(unlocked3 === false, "Scenario 3: isMarketUnlocked() against the real KV state confirms the market is genuinely locked after the real board quality failure", `market_unlocked=${unlocked3}`);

      const attempt3 = await getPublicationAttempt(id3);
      record(
        attempt3 !== null && attempt3.board_opportunity_id === null,
        "Scenario 3: a PublicationAttempt exists (a real, retryable attempt) but carries no board_opportunity_id -- the real board failure created no Opportunity",
        `attempt=${JSON.stringify(attempt3)}`,
      );

      const reload3 = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id3}?manage=${manage3}`), { params: Promise.resolve({ id: id3 }) });
      const reloaded3 = (await reload3.json()) as RouteProjectLike;
      record(
        reload3.status === 200 && reloaded3.status !== "published",
        "Scenario 3: reloading the project through the real route confirms `status` never flipped to \"published\" after the real board quality failure",
        `status=${reload3.status} project_status=${reloaded3.status}`,
      );
    },
    { passThroughOtherHosts: true },
  );

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
