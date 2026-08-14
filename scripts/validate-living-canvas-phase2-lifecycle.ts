/**
 * Living Procurement Canvas Phase 2 (14 Aug 2026): route-level lifecycle
 * fixtures for the product rule Robert's Phase 2 brief states plainly --
 * "publication is a boundary, not a UI event." These prove, through the
 * REAL route handlers (never hand-reimplemented substitutes) over the
 * SAME fake-kv-harness.ts every other route-level fixture in this repo
 * uses, that:
 *
 *   - a draft never lists on the board, never invites anyone, and never
 *     reveals a project-specific matched-vendor list or an export;
 *   - a signed-out or token-only caller cannot publish or export;
 *   - the three support-hours double-negative reproductions Robert named
 *     resolve correctly through the real production function.
 *
 * DELIBERATELY EXCLUDED from this file (and kept out of `npm run
 * validate`): every acceptance test that requires a REAL, successful
 * publish. `executePublish()` always calls `verifyBusinessEmail()`, which
 * does real DNS (`resolveMx`) and real HTTPS -- not mockable from a plain
 * script the way this repo already mocks the model call (see
 * verify-publish-route-live-demo.ts's own doc comment, which found and
 * documented this exact limit first). Those tests --
 * one-board-opportunity-per-publish, matching against the frozen
 * snapshot, invitations only after publication, export unlock, cross-
 * export snapshot consistency, idempotent republish, and a later edit
 * never mutating a live published snapshot -- live in the companion
 * script scripts/verify-phase2-publish-lifecycle-live-demo.ts, run by
 * hand against real network for the same reason the existing live-demo
 * script is, and NOT wired into the build gate for the same reason.
 *
 * Run standalone: `npx tsx scripts/validate-living-canvas-phase2-lifecycle.ts`
 * Wired into `npm run validate` (package.json) alongside every other
 * validate-*.ts / verify-*.ts script.
 */

import { withFakeKv, makeRequest } from "./fake-kv-harness";
import { supportHoursFromHistory, chronologicalHistory } from "../src/lib/workspace/procurement-templates";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

type RouteProjectLike = {
  id?: string;
  manage_token?: string;
  status?: string;
  invited_vendors?: string[];
  buyer?: { pinned_vendors?: string[] };
};

/* ------------------------------------------------------------------ */
/* Item 15: the three support-hours double-negative reproductions --   */
/* Robert's exact adversarial finding, against the real production     */
/* function, "before editing" evidence already captured separately     */
/* (all three false against 0e3e7ac); this is the permanent regression */
/* fixture proving they now resolve to hours247=true and stay that way.*/
/* ------------------------------------------------------------------ */
function hoursOf(text: string): boolean {
  return supportHoursFromHistory(chronologicalHistory([{ id: "t1", text, at: 1000, via: "typed" }], [])).hours247;
}
record(hoursOf("24/7 support is not optional.") === true, "Item 15/support-hours: \"24/7 support is not optional.\" resolves hours247=true", "double negative (\"not optional\") must assert, not negate");
record(hoursOf("We cannot operate without 24/7 support.") === true, "Item 15/support-hours: \"We cannot operate without 24/7 support.\" resolves hours247=true", "negation + \"without\" is a double negative, must assert");
record(hoursOf("We do not accept suppliers without 24/7 support.") === true, "Item 15/support-hours: \"We do not accept suppliers without 24/7 support.\" resolves hours247=true", "negation + \"without\" is a double negative, must assert");
// Sanity: a genuine single negation (no inner "without"/"not optional")
// still correctly resolves to NOT required -- the fix must not have
// flipped every negation to asserted.
record(hoursOf("24/7 support is not required.") === false, "Item 15/support-hours: a genuine single negation (\"is not required\") still resolves hours247=false", "guards against an over-broad fix that asserts on every negation word");
record(hoursOf("We need 24/7 support.") === true, "Item 15/support-hours: a plain positive statement still resolves hours247=true", "guards against a fix that only fires on negation-shaped text");

const SASE_REQUIREMENT = {
  organisation: { sector: "Healthcare & pharma" },
  estate: { sites: 20, users: 200, existingSecurity: ["Defender P2"] },
  drivers: ["renewal"],
  constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
};

async function main() {
  await withFakeKv(async (store) => {
    const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
    const { POST: createNetworkRoute } = await import("../src/app/api/rfp/route");
    const { POST: publishRoute } = await import("../src/app/api/rfp/[id]/publish/route");
    const { GET: reportRoute } = await import("../src/app/api/rfp/[id]/report/route");
    const { GET: downloadRoute } = await import("../src/app/rfp-builder/[id]/preview/download/route");
    const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
    const { createSession } = await import("../src/lib/rfp-store");
    const { sessionCookieHeader } = await import("../src/lib/auth");

    /* ---------------------------------------------------------------- */
    /* Two drafts: one via the security-sourcing path, one via the       */
    /* plain network/wizard path -- item 13, "network and security-      */
    /* sourcing paths obey the same lifecycle," proven by running every  */
    /* draft-state assertion against BOTH creation routes.               */
    /* ---------------------------------------------------------------- */
    const secRes = await createSecurityProjectRoute(
      makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
        body: {
          requirement: SASE_REQUIREMENT,
          consent: true,
          test: true,
          source_turns: [{ id: "st_p2_A", text: "Turn A: initial create.", at: 1000, via: "typed" }],
        },
      }),
    );
    const secCreated = (await secRes.json()) as { project?: RouteProjectLike; error?: string };
    record(secRes.status === 200, "Draft create (security-sourcing path) succeeds", `status=${secRes.status} error=${secCreated.error}`);
    const secId = secCreated.project?.id ?? "";
    const secManage = secCreated.project?.manage_token ?? "";

    const netRes = await createNetworkRoute(
      makeRequest("POST", "https://example.test/api/rfp", {
        body: { title: "SD-WAN refresh", buyer: { sector: "Retail", pinned_vendors: [] } },
      }),
    );
    const netCreated = (await netRes.json()) as RouteProjectLike & { error?: string };
    record(netRes.status === 200, "Draft create (plain network/wizard path) succeeds", `status=${netRes.status}`);
    const netId = netCreated.id ?? "";
    const netManage = netCreated.manage_token ?? "";

    for (const [label, id, manage] of [["security-sourcing", secId, secManage] as const, ["network/wizard", netId, netManage] as const]) {
      /* -------------------------------------------------------------- */
      /* Items 1 & 2: draft creation lists nothing on the board and      */
      /* invites nobody -- checked directly against the store (the      */
      /* board-mapping key listRfpOnBoard() writes) and the project's    */
      /* own invited_vendors, never a UI-only signal.                    */
      /* -------------------------------------------------------------- */
      const boardMapping = store.peekJson<string>(`rfp:${id}:board_opp`);
      record(boardMapping === null, `Item 1 (${label}): a draft is not listed on the board (no rfp:{id}:board_opp mapping exists)`, `mapping=${JSON.stringify(boardMapping)}`);

      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded = (await reload.json()) as RouteProjectLike;
      record(reload.status === 200 && (reloaded.invited_vendors ?? []).length === 0, `Item 2 (${label}): a draft invites nobody (invited_vendors is empty)`, `invited_vendors=${JSON.stringify(reloaded.invited_vendors)}`);
      // The engine lane's coarse status can be "draft" or "review" pre-
      // publish (project-machine.ts's own phase->status mapping: scoping/
      // scoped/drafting -> "draft", drafted -> "review") -- both are
      // pre-publication states. The one invariant every acceptance test in
      // this file actually needs is "not published yet", proven precisely.
      record(reloaded.status !== "published", `Item 2 (${label}) sanity: project genuinely not yet published`, `status=${reloaded.status}`);

      /* -------------------------------------------------------------- */
      /* A real session + real ownership (manage_token), so items 3/4    */
      /* prove the GATE itself, not merely "nobody was signed in."       */
      /* -------------------------------------------------------------- */
      const email = `buyer-${label.replace(/[^a-z]/g, "")}@example-corp.test`;
      const session = await createSession({ role: "buyer", email, vendor_slug: null });
      const cookie = sessionCookieHeader(session.token);

      /* -------------------------------------------------------------- */
      /* Item 3: a draft cannot download Word/PDF/print/JSON -- the      */
      /* real gated route, an authenticated OWNER, every format.         */
      /* -------------------------------------------------------------- */
      for (const format of [null, "doc", "print", "json"]) {
        const url = `https://example.test/rfp-builder/${id}/preview/download${format ? `?format=${format}&manage=${manage}` : `?manage=${manage}`}`;
        const dlRes = await downloadRoute(makeRequest("GET", url, { cookie }), { params: Promise.resolve({ id }) });
        const dlBody = (await dlRes.json().catch(() => ({}))) as { publish_required?: boolean };
        record(
          dlRes.status === 403 && dlBody.publish_required === true,
          `Item 3 (${label}): an authenticated OWNER of a DRAFT cannot download format=${format ?? "markdown"} (route itself refuses, not just the UI)`,
          `status=${dlRes.status} body=${JSON.stringify(dlBody)}`,
        );
      }

      /* -------------------------------------------------------------- */
      /* Item 4: a draft cannot retrieve matched vendor names -- the     */
      /* real market-report route must return a readiness object, never */
      /* matched.names / matched.count (the exact pre-Phase-2 leak).     */
      /* -------------------------------------------------------------- */
      const reportRes = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${id}/report?manage=${manage}`, { cookie }), { params: Promise.resolve({ id }) });
      const reportBody = (await reportRes.json()) as Record<string, unknown>;
      const hasMatchedLeak = "market_report" in reportBody && Boolean((reportBody.market_report as Record<string, unknown> | undefined)?.matched);
      const hasReadiness = reportBody.preview === true && typeof reportBody.readiness === "object" && reportBody.readiness !== null;
      record(
        reportRes.status === 200 && !hasMatchedLeak && hasReadiness,
        `Item 4 (${label}): a draft's report route returns readiness only -- no matched vendor names, no matched count, no market_report at all`,
        `status=${reportRes.status} keys=${JSON.stringify(Object.keys(reportBody))} readiness=${JSON.stringify(reportBody.readiness)}`,
      );
      const readiness = reportBody.readiness as Record<string, unknown> | undefined;
      record(
        readiness !== undefined && "evaluated_market_total" in readiness && !("names" in readiness) && !("count" in readiness),
        `Item 4 (${label}) detail: readiness carries the general evaluated-market total (safe, non-project-specific) but never names/count`,
        `readiness_keys=${JSON.stringify(Object.keys(readiness ?? {}))}`,
      );

      /* -------------------------------------------------------------- */
      /* Item 14: signed-out / token-only callers cannot publish or      */
      /* export. manage_token alone (no session) must not be enough for  */
      /* either the publish route's hard identity gate or the download   */
      /* route's account gate.                                           */
      /* -------------------------------------------------------------- */
      const publishNoSession = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${id}/publish`, { body: { manage_token: manage } }),
        { params: Promise.resolve({ id }) },
      );
      const publishNoSessionBody = (await publishNoSession.json()) as { error?: string; auth_required?: boolean };
      record(
        publishNoSession.status === 401 && publishNoSessionBody.auth_required === true,
        `Item 14 (${label}): a token-only (signed-out) caller cannot publish -- manage_token possession alone is refused`,
        `status=${publishNoSession.status} body=${JSON.stringify(publishNoSessionBody)}`,
      );

      const downloadNoSession = await downloadRoute(makeRequest("GET", `https://example.test/rfp-builder/${id}/preview/download?manage=${manage}`), { params: Promise.resolve({ id }) });
      const downloadNoSessionBody = (await downloadNoSession.json()) as { error?: string; auth_required?: boolean };
      record(
        downloadNoSession.status === 401 && downloadNoSessionBody.auth_required === true,
        `Item 14 (${label}): a token-only (signed-out) caller cannot download -- manage_token possession alone is refused`,
        `status=${downloadNoSession.status} body=${JSON.stringify(downloadNoSessionBody)}`,
      );
    }

    /* ---------------------------------------------------------------- */
    /* Item 5: buyer-pinned vendors remain distinguishable from Netify's */
    /* project matches. A pin is buyer INPUT, stored on buyer context    */
    /* and returned by a plain owner GET regardless of publish state --  */
    /* never folded into (or mistaken for) the hidden, project-specific  */
    /* matched-vendor list items 3/4 above just proved stays locked.     */
    /* ---------------------------------------------------------------- */
    const pinnedRes = await createNetworkRoute(
      makeRequest("POST", "https://example.test/api/rfp", {
        body: { title: "SASE renewal", buyer: { sector: "Retail", pinned_vendors: ["cato-networks", "palo-alto-networks"] } },
      }),
    );
    const pinnedCreated = (await pinnedRes.json()) as RouteProjectLike;
    const pinnedId = pinnedCreated.id ?? "";
    const pinnedManage = pinnedCreated.manage_token ?? "";
    const pinnedReload = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${pinnedId}?manage=${pinnedManage}`), { params: Promise.resolve({ id: pinnedId }) });
    const pinnedReloaded = (await pinnedReload.json()) as RouteProjectLike;
    const pins = pinnedReloaded.buyer?.pinned_vendors ?? [];
    record(
      pins.length === 2 && pins.includes("cato-networks") && pins.includes("palo-alto-networks"),
      "Item 5: buyer-pinned vendors survive as buyer input on a draft (distinct field from any Netify match list)",
      `pinned_vendors=${JSON.stringify(pins)}`,
    );
    const pinnedReportRes = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${pinnedId}/report?manage=${pinnedManage}`), { params: Promise.resolve({ id: pinnedId }) });
    const pinnedReportBody = (await pinnedReportRes.json()) as Record<string, unknown>;
    record(
      pinnedReportBody.preview === true && !("matched" in pinnedReportBody),
      "Item 5: even with buyer pins present, the pre-publish report never presents them as (or alongside) Netify's project matches -- no matched field at all",
      `keys=${JSON.stringify(Object.keys(pinnedReportBody))}`,
    );
  });

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
