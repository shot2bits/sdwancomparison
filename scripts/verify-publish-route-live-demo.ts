/**
 * Fifth amendment (13 Aug 2026), Robert's item 4, the "publish" half: a
 * real route-level demonstration that source_ledger survives the actual
 * /api/rfp/[id]/publish route, not just the create/re-scope routes proven
 * hermetically in scripts/verify-fact-ledger-reliability-gate.ts.
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

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

const FULL_REQ: SecurityRequirementInput = {
  organisation: { sector: "Healthcare & pharma" },
  estate: { sites: 20, users: 200, existingSecurity: ["Defender P2"] },
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
      // netify.co.uk), real shortlist ranking, real saveProject.
      const publishRes = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${id}/publish`, {
          body: { manage_token: manage, shortlist_size: 3, list_on_board: false },
          cookie,
        }),
        { params: Promise.resolve({ id }) },
      );
      const publishBody = (await publishRes.json()) as { ok?: boolean; status?: string; error?: string };
      record(
        publishRes.status === 200 && publishBody.ok === true && publishBody.status === "published",
        "Publish route succeeds (real business-email verification passed for netify.co.uk)",
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
