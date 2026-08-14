/**
 * Living Procurement Canvas Phase 2, round 3 (14 Aug 2026): live-network
 * proof of the durable resume-after-publish fix.
 *
 * Robert's independent read-only audit (run against baseline 4d75761, not
 * against this repo's round-2 fix) found item 6: ProjectDesk's `published`
 * client state was only ever set by the live `signAndPublish()` response
 * handler, never reconstructed from a persisted `project.status`/
 * `invited_vendors` when a project is reopened. A buyer returning to an
 * ALREADY-PUBLISHED project via the resume flow (`?id=`) would see the
 * pre-publish locked outcome panel again instead of their frozen matches.
 * Not an identity leak (the fit API redaction is unconditional regardless
 * of this gap), but a real durability gap in "display the frozen matched
 * and invited suppliers from the published snapshot" -- which is only
 * meaningful if it survives a page reload, not just the live session that
 * clicked Publish.
 *
 * The fix (ProjectDesk.tsx's resume effect): when `GET /api/rfp/[id]`
 * reports `status === "published"`, fetch `GET /api/rfp/[id]/report` (the
 * SAME owner-gated, frozen-snapshot route every export already reads) for
 * `market_report.matched`, cross-reference `invited_vendors` (slugs) against
 * the public, non-project-specific `/api/workspace/market` vendor
 * directory for display names, and reconstruct `published` from that --
 * never a fresh recompute, never `fit`/`rankedFits`.
 *
 * DELIBERATELY NOT part of `npm run validate` / the build gate, for the
 * SAME reason verify-phase2-publish-lifecycle-live-demo.ts already is not
 * (that script found and documented this limit first; this one inherits
 * its rationale): executePublish() always calls verifyBusinessEmail(),
 * real DNS + real HTTPS, not mockable from a plain script. This script
 * therefore drives a REAL publish (`passThroughOtherHosts: true`, so only
 * that one call reaches the internet) and then replicates the CLIENT's
 * exact resume-hydration logic against the REAL routes, asserting the
 * reconstructed `published` object is identical in substance to what the
 * live publish response itself returned -- proving the resumed view
 * cannot drift from the original publish.
 *
 * Run by hand: `npx tsx scripts/verify-round3-resume-after-publish-live-demo.ts`
 */

import type { SecurityRequirementInput } from "../src/lib/security/rulebook";
import { withFakeKv, makeRequest } from "./fake-kv-harness";

type RouteProjectLike = { id?: string; manage_token?: string; status?: string; invited_vendors?: string[]; title?: string };

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

const FULL_REQ: SecurityRequirementInput = {
  organisation: { sector: "healthcare" },
  estate: { sites: 20, users: 200, existingSecurity: ["Defender P2"] },
  drivers: ["renewal"],
  constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
};

async function main() {
  await withFakeKv(
    async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: publishRoute } = await import("../src/app/api/rfp/[id]/publish/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
      const { GET: reportRoute } = await import("../src/app/api/rfp/[id]/report/route");
      const { GET: marketRoute } = await import("../src/app/api/workspace/market/route");
      const { createSession } = await import("../src/lib/rfp-store");
      const { sessionCookieHeader } = await import("../src/lib/auth");

      // 1. Create + publish for real -- same shape as the accepted
      // Phase 2 live-demo script (real business-email verification).
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_r3_A", text: "Turn A: initial create.", at: 1000, via: "typed" }] },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      record(createRes.status === 200, "Create route succeeds", `status=${createRes.status} error=${created.error}`);
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      const email = "phase2-round3-live@netify.co.uk"; // real, Robert-owned domain; fake local part
      const session = await createSession({ role: "buyer", email, vendor_slug: null });
      const cookie = sessionCookieHeader(session.token);

      const publishRes = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${id}/publish`, { body: { manage_token: manage, shortlist_size: 3, list_on_board: true }, cookie }),
        { params: Promise.resolve({ id }) },
      );
      const publishBody = (await publishRes.json()) as {
        ok?: boolean;
        status?: string;
        invited?: { slug: string; name: string }[];
        market_report?: { matched?: { count: number; names: string[]; total_evaluated_market: number } };
      };
      record(
        publishRes.status === 200 && publishBody.ok === true && publishBody.status === "published",
        "Real publish succeeds (business-email verification passed for netify.co.uk)",
        `status=${publishRes.status} invited=${JSON.stringify(publishBody.invited)}`,
      );
      record(
        Array.isArray(publishBody.invited) && publishBody.invited.length > 0 && Boolean(publishBody.market_report?.matched),
        "Sanity: the real publish response carries a non-empty invited list and a matched report -- so fidelity below is meaningful",
        `invited_count=${publishBody.invited?.length} matched=${JSON.stringify(publishBody.market_report?.matched)}`,
      );

      /* -------------------------------------------------------------- */
      /* 2. Replicate the CLIENT's exact resume-hydration logic, against */
      /* the REAL routes, exactly as ProjectDesk.tsx's resume effect     */
      /* does it: GET the project (status + invited_vendors), then --    */
      /* only because status === "published" -- GET the report route     */
      /* for the frozen matched report, and GET the market route to      */
      /* resolve invited slugs to display names.                         */
      /* -------------------------------------------------------------- */
      const projRes = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id}?manage=${manage}`, { cookie }), { params: Promise.resolve({ id }) });
      const proj = (await projRes.json()) as RouteProjectLike;
      record(proj.status === "published", "Resumed GET /api/rfp/[id] reports status: \"published\"", `status=${proj.status}`);
      record(
        Array.isArray(proj.invited_vendors) && proj.invited_vendors.length > 0,
        "Resumed GET /api/rfp/[id] carries a non-empty invited_vendors (slugs) -- the data this fix's client type change depends on",
        `invited_vendors=${JSON.stringify(proj.invited_vendors)}`,
      );

      let rehydratedInvited: { slug: string; name: string; supplier_url: string }[] = [];
      let rehydratedMatched: { count: number; names: string[]; total_evaluated_market: number } | null = null;
      if (proj.status === "published") {
        const reportRes = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${id}/report?manage=${manage}`, { cookie }), { params: Promise.resolve({ id }) });
        const reportBody = (await reportRes.json()) as { ok?: boolean; market_report?: { matched?: { count: number; names: string[]; total_evaluated_market: number } } };
        record(reportRes.status === 200 && reportBody.ok === true, "Resumed GET /api/rfp/[id]/report (owner-gated) succeeds post-publish", `status=${reportRes.status}`);
        const matched = reportBody.market_report?.matched ?? null;
        if (matched) {
          const slugs = proj.invited_vendors ?? [];
          const marketRes = await marketRoute(makeRequest("GET", "https://example.test/api/workspace/market"));
          const marketBody = (await marketRes.json()) as { vendors?: Array<{ slug: string; name: string }> };
          const namesBySlug = new Map((marketBody.vendors ?? []).map((v) => [v.slug, v.name]));
          rehydratedInvited = slugs.map((slug) => ({ slug, name: namesBySlug.get(slug) ?? slug, supplier_url: "" }));
          rehydratedMatched = matched;
        }
      }

      /* -------------------------------------------------------------- */
      /* 3. Fidelity: the resume-hydrated view must not drift from what  */
      /* the original, live publish actually returned.                   */
      /* -------------------------------------------------------------- */
      record(rehydratedMatched !== null, "Resume hydration reconstructed a non-null `matched` object", `rehydratedMatched=${JSON.stringify(rehydratedMatched)}`);
      record(
        JSON.stringify(rehydratedMatched) === JSON.stringify(publishBody.market_report?.matched),
        "The resume-hydrated `matched` is IDENTICAL to the original publish response's `market_report.matched` -- the frozen snapshot, not a drifted recompute",
        `resumed=${JSON.stringify(rehydratedMatched)} original=${JSON.stringify(publishBody.market_report?.matched)}`,
      );
      const originalSlugs = new Set((publishBody.invited ?? []).map((v) => v.slug));
      const rehydratedSlugs = new Set(rehydratedInvited.map((v) => v.slug));
      record(
        originalSlugs.size === rehydratedSlugs.size && [...originalSlugs].every((s) => rehydratedSlugs.has(s)),
        "The resume-hydrated invited slug set is IDENTICAL to the original publish response's invited slug set",
        `resumed=${JSON.stringify([...rehydratedSlugs])} original=${JSON.stringify([...originalSlugs])}`,
      );
      const originalNamesBySlug = new Map((publishBody.invited ?? []).map((v) => [v.slug, v.name]));
      const namesMismatch = rehydratedInvited.filter((v) => originalNamesBySlug.get(v.slug) !== v.name);
      record(
        namesMismatch.length === 0,
        "Every resume-hydrated invited vendor's display name matches the name the original publish response used",
        `mismatches=${JSON.stringify(namesMismatch)}`,
      );

      /* -------------------------------------------------------------- */
      /* 4. Non-vacuity of the gate itself: a DRAFT project's report      */
      /* route must NOT carry `market_report.matched` at all -- proving  */
      /* the client's `if (proj.status === "published")` guard is doing  */
      /* real work, not redundant with something the route already does */
      /* unconditionally.                                                 */
      /* -------------------------------------------------------------- */
      const draftRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_r3_B", text: "A second, never-published draft.", at: 1000, via: "typed" }] },
        }),
      );
      const draft = (await draftRes.json()) as { project?: RouteProjectLike };
      const draftReportRes = await reportRoute(
        makeRequest("GET", `https://example.test/api/rfp/${draft.project?.id}/report?manage=${draft.project?.manage_token}`),
        { params: Promise.resolve({ id: draft.project?.id ?? "" }) },
      );
      const draftReportBody = (await draftReportRes.json()) as { preview?: boolean; market_report?: unknown };
      record(
        draftReportBody.preview === true && draftReportBody.market_report === undefined,
        "Sanity/non-vacuous: an unpublished draft's report route carries no `market_report` at all -- the client's status guard is load-bearing, not redundant",
        `keys=${JSON.stringify(Object.keys(draftReportBody))}`,
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
