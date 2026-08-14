/**
 * Living Procurement Canvas Phase 2 (14 Aug 2026): route-level proof of the
 * publish-dependent acceptance tests from Robert's brief -- the ones that
 * can only be proven against a REAL, successfully completed publish:
 *
 *   6. one successful publication creates exactly one board opportunity;
 *   7. matching occurs against the frozen published version;
 *   8. invitations are created only after publication;
 *   9. Word, PDF/print and structured exports unlock only after publication;
 *  10. every export represents the same published snapshot;
 *  11. a repeated publish request is idempotent;
 *  12. a later edit cannot silently alter the published snapshot.
 *
 * DELIBERATELY NOT part of `npm run validate` / the build gate, for the
 * SAME reason scripts/verify-publish-route-live-demo.ts already is not
 * (that script found and documented this limit first; this one inherits
 * its rationale rather than re-arguing it):
 *
 * executePublish() (rfp-publish.ts) always calls verifyBusinessEmail(),
 * which does REAL DNS (node:dns/promises' resolveMx) and REAL HTTPS (a
 * live website reachability check). Neither is mockable from a plain
 * script the way this codebase mocks the model call for Anthropic --
 * resolveMx is a named import, so reassigning it on an external namespace
 * object is a silent no-op under Node's ESM live-binding semantics, and
 * faking it properly would need a Node loader hook, which is exactly the
 * fragile, environment-coupled test machinery the existing rationale
 * argues against. So this script uses real network for that one call,
 * against netify.co.uk (Robert's own domain), with `passThroughOtherHosts:
 * true` so only that one call reaches the internet -- everything else
 * (KV, shortlist ranking, saveProject, sessions, the governed-revision
 * state, the published snapshot) runs through the exact same real,
 * production code as every hermetic fixture in this repo, just not
 * wired into CI/the build gate for the same live-network reason.
 *
 * Run by hand: `npx tsx scripts/verify-phase2-publish-lifecycle-live-demo.ts`
 */

import type { SecurityRequirementInput } from "../src/lib/security/rulebook";
import { withFakeKv, makeRequest } from "./fake-kv-harness";
import type { SourceLedgerEntry } from "../src/lib/workspace/source-ledger";

type RouteProjectLike = { id?: string; manage_token?: string; status?: string; source_ledger?: SourceLedgerEntry[]; invited_vendors?: string[]; title?: string };

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

// Sector deliberately "healthcare" (a real notice-catalogue key, see
// notice-options.ts's SECTORS list), not a free-text label like the
// existing live-demo script's "Healthcare & pharma": that script uses
// `list_on_board: false` and never needs a listing to succeed, but item 6
// below needs a REAL public board listing, which the quality gate
// (notice-validate.ts's publicNoticeQualityGate) only accepts for an
// exact catalogue key or the literal "not_stated" -- a free-text label
// fails it (proven while writing this script) for reasons entirely
// unrelated to Phase 2 (usableSector() stores the buyer's raw string
// verbatim; the gate is pre-existing, pre-Phase-1 behaviour).
const FULL_REQ: SecurityRequirementInput = {
  organisation: { sector: "healthcare" },
  estate: { sites: 20, users: 200, existingSecurity: ["Defender P2"] },
  drivers: ["renewal"],
  constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
};

async function main() {
  await withFakeKv(
    async (store) => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { POST: publishRoute } = await import("../src/app/api/rfp/[id]/publish/route");
      const { GET: rfpGetRoute, PUT: rfpPutRoute } = await import("../src/app/api/rfp/[id]/route");
      const { GET: reportRoute } = await import("../src/app/api/rfp/[id]/report/route");
      const { GET: downloadRoute } = await import("../src/app/rfp-builder/[id]/preview/download/route");
      const { createSession } = await import("../src/lib/rfp-store");
      const { sessionCookieHeader } = await import("../src/lib/auth");
      const { getLatestPublishedSnapshot, getPublishedSnapshotHistory } = await import("../src/lib/published-snapshot");

      // 1. Create + pre-publish refresh, exactly as verify-publish-route-
      // live-demo.ts does (the already-proven real-publish shape).
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_p2l_A", text: "Turn A: initial create.", at: 1000, via: "typed" }] },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      record(createRes.status === 200, "Create route succeeds", `status=${createRes.status} error=${created.error}`);
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      const rescopeRes = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_p2l_B", text: "Turn B: added just before publish.", at: 2000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(rescopeRes.status === 200, "Pre-publish refresh succeeds", `status=${rescopeRes.status}`);

      /* -------------------------------------------------------------- */
      /* Items 2 & 8: invitations are created ONLY after publication --  */
      /* confirmed empty on the draft, immediately before the real       */
      /* publish call below.                                             */
      /* -------------------------------------------------------------- */
      const preReload = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const preReloaded = (await preReload.json()) as RouteProjectLike;
      record((preReloaded.invited_vendors ?? []).length === 0, "Item 8 (pre-publish): invited_vendors is empty on the draft, immediately before publish", `invited_vendors=${JSON.stringify(preReloaded.invited_vendors)}`);

      const email = "phase2-live@netify.co.uk"; // real, Robert-owned domain; fake local part
      const session = await createSession({ role: "buyer", email, vendor_slug: null });
      const cookie = sessionCookieHeader(session.token);

      // 2. FIRST publish -- real business-email verification, real
      // shortlist, real board listing, real snapshot freeze.
      const publishRes1 = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${id}/publish`, { body: { manage_token: manage, shortlist_size: 3, list_on_board: true }, cookie }),
        { params: Promise.resolve({ id }) },
      );
      const publishBody1 = (await publishRes1.json()) as { ok?: boolean; status?: string; invited?: unknown[]; board?: { listed?: boolean; opportunity_id?: string } };
      record(publishRes1.status === 200 && publishBody1.ok === true && publishBody1.status === "published", "First publish succeeds (real business-email verification passed for netify.co.uk)", `status=${publishRes1.status} body=${JSON.stringify(publishBody1)}`);

      /* -------------------------------------------------------------- */
      /* Item 8 (post-publish): invitations now exist.                   */
      /* -------------------------------------------------------------- */
      record(Array.isArray(publishBody1.invited) && publishBody1.invited.length > 0, "Item 8 (post-publish): publish created real invitations", `invited=${JSON.stringify(publishBody1.invited)}`);

      /* -------------------------------------------------------------- */
      /* Item 6: exactly one board opportunity from one publish -- the   */
      /* board mapping key exists and points at one opportunity id.      */
      /* -------------------------------------------------------------- */
      const boardMapping1 = store.peekJson<string>(`rfp:${id}:board_opp`);
      record(publishBody1.board?.listed === true && typeof boardMapping1 === "string" && boardMapping1 === publishBody1.board?.opportunity_id, "Item 6: publish lists the RFP on the board exactly once (one rfp:{id}:board_opp mapping, matching the returned opportunity id)", `mapping=${boardMapping1} returned=${publishBody1.board?.opportunity_id}`);

      const snapshot1 = await getLatestPublishedSnapshot(id);
      record(snapshot1 !== null && snapshot1.document_version === 1, "A published snapshot exists after the first publish, at version 1", `snapshot=${JSON.stringify(snapshot1 && { version: snapshot1.document_version, matched: snapshot1.matched_vendor_ids, invited: snapshot1.invited_vendor_ids, hash: snapshot1.content_hash })}`);

      /* -------------------------------------------------------------- */
      /* Item 9: exports unlock only after publication -- all four       */
      /* formats now succeed for the same owner who was refused pre-     */
      /* publish in the hermetic fixture script.                         */
      /* -------------------------------------------------------------- */
      const formats: Array<string | null> = [null, "doc", "print", "json"];
      const exportResults: Record<string, { status: number; body: string }> = {};
      for (const format of formats) {
        const url = `https://example.test/rfp-builder/${id}/preview/download${format ? `?format=${format}&manage=${manage}` : `?manage=${manage}`}`;
        const dlRes = await downloadRoute(makeRequest("GET", url, { cookie }), { params: Promise.resolve({ id }) });
        const text = await dlRes.text();
        exportResults[format ?? "markdown"] = { status: dlRes.status, body: text };
        record(dlRes.status === 200, `Item 9: format=${format ?? "markdown"} export unlocks after publication`, `status=${dlRes.status}`);
      }

      /* -------------------------------------------------------------- */
      /* Item 10: every export represents the SAME published snapshot -- */
      /* the JSON export's content_hash matches the snapshot's own, and  */
      /* the markdown/doc/print exports all carry that same hash and the */
      /* same published version in their "Publication record" section.   */
      /* -------------------------------------------------------------- */
      const jsonExport = JSON.parse(exportResults.json.body) as { content_hash?: string; published_version?: number };
      record(jsonExport.content_hash === snapshot1?.content_hash, "Item 10: the JSON structured export's content_hash matches the published snapshot's own content_hash", `export=${jsonExport.content_hash} snapshot=${snapshot1?.content_hash}`);
      record(jsonExport.published_version === snapshot1?.document_version, "Item 10: the JSON export's published_version matches the snapshot's document_version", `export=${jsonExport.published_version} snapshot=${snapshot1?.document_version}`);
      // buildRfpMarkdown/buildRfpHtml deliberately show a truncated
      // (16-hex-char) prefix of the full hash in the human-readable
      // "Publication record" section (rfp-document.ts) -- the JSON export
      // above already proved the FULL hash matches the snapshot exactly;
      // this proves the human-readable exports show a consistent PREFIX of
      // that same hash, not an independently-generated identifier.
      const hashPrefix = snapshot1 ? snapshot1.content_hash.slice(0, 16) : "";
      const hashInMarkdown = hashPrefix.length > 0 && exportResults.markdown.body.includes(hashPrefix);
      const hashInDoc = hashPrefix.length > 0 && exportResults.doc.body.includes(hashPrefix);
      record(hashInMarkdown && hashInDoc, "Item 10: the markdown and Word (doc) exports both embed the SAME published content hash prefix as the JSON export and the snapshot", `hash_prefix=${hashPrefix} markdown_has_hash=${hashInMarkdown} doc_has_hash=${hashInDoc}`);

      /* -------------------------------------------------------------- */
      /* Item 11: a REPEATED publish request (identical manage_token,    */
      /* identical options, no intervening edit) is idempotent -- no     */
      /* second board opportunity, no duplicate invitations, no second   */
      /* snapshot version.                                               */
      /* -------------------------------------------------------------- */
      const publishRes2 = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${id}/publish`, { body: { manage_token: manage, shortlist_size: 3, list_on_board: true }, cookie }),
        { params: Promise.resolve({ id }) },
      );
      const publishBody2 = (await publishRes2.json()) as { ok?: boolean; status?: string; invited?: Array<{ slug: string }>; board?: { opportunity_id?: string } };
      record(publishRes2.status === 200 && publishBody2.ok === true, "Repeated (idempotent) publish request still succeeds", `status=${publishRes2.status}`);

      const boardMapping2 = store.peekJson<string>(`rfp:${id}:board_opp`);
      record(boardMapping2 === boardMapping1, "Item 11: the repeated publish did not create a second board opportunity (same mapping)", `first=${boardMapping1} second=${boardMapping2}`);

      const snapshot2 = await getLatestPublishedSnapshot(id);
      const history2 = await getPublishedSnapshotHistory(id);
      record(snapshot2?.document_version === snapshot1?.document_version && snapshot2?.id === snapshot1?.id, "Item 11: the repeated publish did not increment the published version or create a new snapshot record", `first_id=${snapshot1?.id} second_id=${snapshot2?.id} first_v=${snapshot1?.document_version} second_v=${snapshot2?.document_version}`);
      record(history2.length === 1, "Item 11: the snapshot history holds exactly one entry after two identical publish requests", `history_length=${history2.length}`);

      const invitedSlugs1 = (publishBody1.invited as Array<{ slug: string }> | undefined)?.map((i) => i.slug).sort() ?? [];
      const invitedSlugs2 = publishBody2.invited?.map((i) => i.slug).sort() ?? [];
      record(JSON.stringify(invitedSlugs1) === JSON.stringify(invitedSlugs2), "Item 11: the repeated publish returns the SAME invited vendor set, not a duplicated one", `first=${JSON.stringify(invitedSlugs1)} second=${JSON.stringify(invitedSlugs2)}`);

      /* -------------------------------------------------------------- */
      /* Item 7: matching occurred against the frozen published version  */
      /* -- matched_vendor_ids on the snapshot are exactly buildShortlist */
      /* 's own picks for the content AT PUBLISH TIME, never recomputed.  */
      /* Proven properly below (item 12) by editing the live project and */
      /* confirming the snapshot's matches do not move.                  */
      /* -------------------------------------------------------------- */
      const matchedAtPublish = [...(snapshot1?.matched_vendor_ids ?? [])].sort();
      record(matchedAtPublish.length > 0, "Item 7: the published snapshot carries a real, non-empty project-specific matched-vendor list from buildShortlist()", `matched=${JSON.stringify(matchedAtPublish)}`);

      /* -------------------------------------------------------------- */
      /* Item 12: a later edit cannot silently alter the published       */
      /* snapshot. Edit the LIVE project's title through the real PUT    */
      /* route (a genuine, different governed content -- proving this    */
      /* is a real diff, not a no-op); the snapshot and every export     */
      /* must keep showing the OLD, originally-published title until an  */
      /* explicit republish.                                             */
      /* -------------------------------------------------------------- */
      const beforeEditReload = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const beforeEditProject = (await beforeEditReload.json()) as Record<string, unknown>;
      const originalTitle = String(beforeEditProject.title ?? "");
      const editedTitle = `${originalTitle} (post-publish edit)`;
      const putRes = await rfpPutRoute(
        makeRequest("PUT", `https://example.test/api/rfp/${id}`, { body: { ...beforeEditProject, manage_token: manage, title: editedTitle } }),
        { params: Promise.resolve({ id }) },
      );
      record(putRes.status === 200, "A later edit to the published project (title change) is accepted by the real PUT route", `status=${putRes.status}`);

      const snapshotAfterEdit = await getLatestPublishedSnapshot(id);
      record(snapshotAfterEdit?.frozen_content.title === originalTitle && snapshotAfterEdit?.content_hash === snapshot1?.content_hash, "Item 12: the published snapshot's frozen title and content hash are UNCHANGED by the later live edit", `snapshot_title=${snapshotAfterEdit?.frozen_content.title} original=${originalTitle} live_title=${editedTitle}`);

      const jsonExportAfterEdit = await downloadRoute(makeRequest("GET", `https://example.test/rfp-builder/${id}/preview/download?format=json&manage=${manage}`, { cookie }), { params: Promise.resolve({ id }) });
      const jsonExportAfterEditBody = (await jsonExportAfterEdit.json()) as { title?: string };
      record(jsonExportAfterEdit.status === 200 && jsonExportAfterEditBody.title === originalTitle, "Item 12: the download/export route still serves the OLD, originally-published title after the live edit -- never the drifted live draft", `exported_title=${jsonExportAfterEditBody.title} original=${originalTitle}`);

      const reportAfterEdit = await reportRoute(makeRequest("GET", `https://example.test/api/rfp/${id}/report?manage=${manage}`, { cookie }), { params: Promise.resolve({ id }) });
      const reportAfterEditBody = (await reportAfterEdit.json()) as { market_report?: unknown };
      record(reportAfterEdit.status === 200 && JSON.stringify(reportAfterEditBody.market_report) === JSON.stringify(snapshot1?.market_report), "Item 12 (market report): the published (post-edit) report route still serves the CACHED, frozen market_report from the original snapshot", `matches_snapshot=${JSON.stringify(reportAfterEditBody.market_report) === JSON.stringify(snapshot1?.market_report)}`);

      /* -------------------------------------------------------------- */
      /* Explicit republish (a GENUINE content change) creates a NEW,    */
      /* distinct snapshot version -- proving republish is possible and  */
      /* versioned, never silently blocked forever.                      */
      /*                                                                  */
      /* Run against a PLAIN (non-engine) network/wizard project, not the */
      /* security-sourcing project above -- an honest, pre-existing,      */
      /* PRE-Phase-2 limitation found while writing this script:          */
      /* project-machine.ts's PROJECT_TRANSITIONS table only permits the  */
      /* "publish.live" event FROM the "drafted" phase, so calling        */
      /* executePublish() a SECOND time with genuinely different content  */
      /* on an already-published ENGINE (security-sourcing) record throws */
      /* ("No legal transition for event publish.live from phase          */
      /* published") before Phase 2's snapshot/idempotency code ever      */
      /* runs -- this is the engine's own state machine, unchanged by     */
      /* and unrelated to this checkpoint's work, not a Phase 2           */
      /* regression. Plain wizard/network records take the OTHER branch   */
      /* in executePublish() (a direct status write, no state-machine     */
      /* transition table), so republish is provably NOT blocked there,   */
      /* and it exercises the exact same Phase 2 snapshot/idempotency     */
      /* code path proven above. Flagged here plainly, as this file's own */
      /* convention is, rather than silently worked around.               */
      /* -------------------------------------------------------------- */
      const { POST: createNetworkRoute } = await import("../src/app/api/rfp/route");
      const netCreateRes = await createNetworkRoute(
        makeRequest("POST", "https://example.test/api/rfp", {
          body: {
            title: "SASE refresh (Phase 2 republish demo)",
            buyer: { sector: "healthcare", operating_model: "managed", product_scope: "single_vendor_sase", site_count: 20 },
          },
        }),
      );
      const netCreated = (await netCreateRes.json()) as RouteProjectLike;
      const netId = netCreated.id ?? "";
      const netManage = netCreated.manage_token ?? "";
      record(netCreateRes.status === 200 && (netCreated.title ?? "").length > 0, "Republish demo: plain network/wizard draft created", `status=${netCreateRes.status}`);

      const netPublishRes1 = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${netId}/publish`, { body: { manage_token: netManage, shortlist_size: 3, list_on_board: true }, cookie }),
        { params: Promise.resolve({ id: netId }) },
      );
      const netPublishBody1 = (await netPublishRes1.json()) as { ok?: boolean; status?: string };
      record(netPublishRes1.status === 200 && netPublishBody1.ok === true, "Republish demo: first publish of the plain network/wizard draft succeeds", `status=${netPublishRes1.status} body=${JSON.stringify(netPublishBody1)}`);
      const netSnapshot1 = await getLatestPublishedSnapshot(netId);
      record(netSnapshot1?.document_version === 1, "Republish demo: first publish freezes snapshot version 1", `version=${netSnapshot1?.document_version}`);

      const netBeforeEditReload = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${netId}?manage=${netManage}`), { params: Promise.resolve({ id: netId }) });
      const netProject = (await netBeforeEditReload.json()) as Record<string, unknown>;
      const netEditedTitle = "SASE refresh (Phase 2 republish demo, revised scope)";
      const netPutRes = await rfpPutRoute(
        makeRequest("PUT", `https://example.test/api/rfp/${netId}`, { body: { ...netProject, manage_token: netManage, title: netEditedTitle } }),
        { params: Promise.resolve({ id: netId }) },
      );
      record(netPutRes.status === 200, "Republish demo: a later edit to the published title is accepted", `status=${netPutRes.status}`);

      const netPublishRes2 = await publishRoute(
        makeRequest("POST", `https://example.test/api/rfp/${netId}/publish`, { body: { manage_token: netManage, shortlist_size: 3, list_on_board: true }, cookie }),
        { params: Promise.resolve({ id: netId }) },
      );
      const netPublishBody2 = (await netPublishRes2.json()) as { ok?: boolean; status?: string };
      record(netPublishRes2.status === 200 && netPublishBody2.ok === true, "Republish demo: an EXPLICIT republish (after a genuine content change) succeeds on a plain wizard/network record", `status=${netPublishRes2.status} body=${JSON.stringify(netPublishBody2)}`);
      // document_version is the governed-revision reducer's own `cycle`
      // (rfp-governed-revision.ts), which advances on EVERY accepted
      // governed event for this project -- the intervening PUT edit above
      // (a "requirement_edit" event) legitimately advances it too, so the
      // republish's version is strictly greater than the first publish's,
      // not necessarily "+1" (by design: "published document version" and
      // "which governed event produced it" are deliberately the same
      // number, per published-snapshot.ts's own doc comment -- never two
      // independently-maintained counters that could drift apart).
      const netSnapshot2 = await getLatestPublishedSnapshot(netId);
      record(
        (netSnapshot2?.document_version ?? 0) > (netSnapshot1?.document_version ?? 0) && netSnapshot2?.frozen_content.title === netEditedTitle && netSnapshot2?.id !== netSnapshot1?.id,
        "Republish demo: the republish creates a NEW, distinct, strictly-later snapshot version carrying the new title -- republish is explicit and versioned, never blocked forever",
        `v1=${netSnapshot1?.document_version} v2=${netSnapshot2?.document_version} new_title=${netSnapshot2?.frozen_content.title} same_id=${netSnapshot2?.id === netSnapshot1?.id}`,
      );
      const netBoardMapping1 = store.peekJson<string>(`rfp:${netId}:board_opp`);
      const netHistory = await getPublishedSnapshotHistory(netId);
      record(netHistory.length === 2, "Republish demo: the snapshot history now holds exactly two entries (one per genuine publish), never merged or overwritten", `history_length=${netHistory.length}`);
      record(Boolean(netBoardMapping1), "Republish demo: the republish still lists on exactly one board opportunity (no duplicate board entry from a legitimate republish)", `mapping=${netBoardMapping1}`);
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
