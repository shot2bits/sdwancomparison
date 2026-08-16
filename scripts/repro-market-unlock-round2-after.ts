/**
 * Market-unlock correction round 2 (16 Aug 2026) -- AFTER evidence.
 *
 * The counterpart to reports/row8-repro/repro-market-unlock-round2-before.ts.txt
 * (moved out of scripts/ once it started calling OLD, now-removed APIs --
 * see that file's own header). This script drives the SAME three named
 * defects against the CORRECTED code on this branch and captures real,
 * machine-readable evidence that each one no longer reproduces:
 *
 *   1. an unlisted Opportunity's MarketUnlock no longer unlocks the market
 *      -- commitMarketUnlock() refuses it outright;
 *   2. a real board-quality-gate failure, driven through the REAL
 *      production route (not a hand-simulated sequence) with real
 *      business-email verification against netify.co.uk, leaves the
 *      project's status non-published;
 *   3. commitMarketUnlock() refuses a MarketUnlock whose published_revision_id
 *      references a FrozenRevision that was never actually persisted.
 *
 * Defects 1 and 3 run hermetically (fake-kv, no network) against the real
 * commitMarketUnlock()/isMarketUnlocked()/market-unlock.ts functions.
 * Defect 2 needs the REAL production path (executePublish() always calls
 * verifyBusinessEmail(), real DNS + HTTPS) to prove the actual route
 * behaves correctly end to end, not just the layer functions in isolation
 * -- same rationale as scripts/verify-publish-route-live-demo.ts, whose
 * Scenario 3 this reuses directly. NOT part of `npm run validate` for that
 * reason (real network dependency); run by hand:
 *   npx tsx scripts/repro-market-unlock-round2-after.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "reports", "row8-repro");
mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const evidence: Record<string, unknown> = { at: "after this round's edits (working tree on fix/row8-pre-publish-supplier-disclosure, on top of 7608a09)", defects: {} };

  // ---------------------------------------------------------------------
  // Defects 1 and 3: hermetic, fake-kv, real market-unlock.ts functions.
  // ---------------------------------------------------------------------
  const { startFakeKv } = await import("./lib/fake-kv-server.mjs");
  const kv = await startFakeKv();
  process.env.KV_REST_API_URL = kv.url;
  process.env.KV_REST_API_TOKEN = kv.token;

  try {
    const { POST: createRoute } = await import("../src/app/api/rfp/route");
    const { getProject, saveOpportunity, newId } = await import("../src/lib/rfp-store");
    const { OpportunitySchema } = await import("../src/lib/opportunity-types");
    const { commitMarketUnlock, isMarketUnlocked, MarketUnlockBindingError } = await import("../src/lib/market-unlock");
    const { saveFrozenRevision, rfpContentSnapshot, contentHash } = await import("../src/lib/published-snapshot");
    const { GET: projectReadRoute } = await import("../src/app/api/rfp/[id]/route");

    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

    async function createDraft(title: string) {
      const res = await createRoute(
        new Request("https://example.test/api/rfp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, buyer: { sector: "manufacturing", organisation_size: "201-1000", operating_model: "hybrid", regions: ["uk"] } }),
        }),
      );
      return (await res.json()) as { id: string; share_token: string; manage_token: string };
    }

    // --- Defect 1 (after): an UNLISTED Opportunity's MarketUnlock -------
    console.log("\n=== Defect 1 (after): unlisted Opportunity attempting to unlock the market ===");
    const p1 = await createDraft("Round-2 AFTER repro: defect 1 (unlisted unlock refused)");
    const project1 = (await getProject(p1.id))!;
    const snap1 = rfpContentSnapshot(project1);
    const revId1 = newId("snap");
    await saveFrozenRevision({
      id: revId1,
      project_id: p1.id,
      content_hash: contentHash(snap1),
      frozen_content: { title: project1.title, buyer: project1.buyer, rfp_sections: project1.rfp_sections },
      created_at: Date.now(),
    });
    // Directly construct an UNLISTED Opportunity bound to that real, valid
    // FrozenRevision -- listRfpOnBoard() itself can no longer produce
    // anything but public, so this is the closest an attacker or a bug
    // could still get: everything else about the binding is genuinely
    // valid, only visibility is wrong.
    const oppId1 = newId("opp");
    await saveOpportunity(OpportunitySchema.parse({
      id: oppId1, created: Date.now(), updated: Date.now(), title: "Repro fixture (unlisted)", scope: ["sase"],
      status: "open", buyer_token: `btok_${oppId1}`, visibility: "unlisted", source_rfp_id: p1.id, source_published_revision_id: revId1,
    }));
    let defect1Threw = false;
    let defect1Error = "";
    try {
      await commitMarketUnlock({ project_id: p1.id, published_revision_id: revId1, board_opportunity_id: oppId1 });
    } catch (e) {
      defect1Threw = e instanceof MarketUnlockBindingError;
      defect1Error = (e as Error).message;
    }
    const unlocked1 = await isMarketUnlocked(p1.id);
    const shareRead1 = await projectReadRoute(new Request(`https://example.test/api/rfp/${p1.id}?token=${p1.share_token}`), ctx(p1.id));
    evidence.defects = {
      ...(evidence.defects as object),
      defect1_unlisted_unlock: {
        project_id: p1.id,
        opportunity_id: oppId1,
        board_visibility_attempted: "unlisted",
        commit_market_unlock_refused: defect1Threw,
        refusal_reason: defect1Error,
        is_market_unlocked: unlocked1,
        share_token_read_status: shareRead1.status,
        VIOLATION: unlocked1 === true || shareRead1.status === 200,
      },
    };
    console.log(`commitMarketUnlock() refused (MarketUnlockBindingError) = ${defect1Threw} (${defect1Error})`);
    console.log(`isMarketUnlocked (unlisted opportunity) = ${unlocked1} (expected false)`);
    console.log(`share-token read status = ${shareRead1.status} (expected non-200, still locked)`);

    // --- Defect 3 (after): MarketUnlock referencing a never-persisted ---
    // -------------------- FrozenRevision ---------------------------------
    console.log("\n=== Defect 3 (after): MarketUnlock attempted against a dangling, never-persisted revision ===");
    const p3 = await createDraft("Round-2 AFTER repro: defect 3 (dangling revision refused)");
    const project3 = (await getProject(p3.id))!;
    const oppId3 = newId("opp");
    const danglingRevId3 = "snap_repro_defect3_never_persisted_after";
    await saveOpportunity(OpportunitySchema.parse({
      id: oppId3, created: Date.now(), updated: Date.now(), title: project3.title || "Repro fixture (dangling revision)", scope: ["sase"],
      status: "open", buyer_token: `btok_${oppId3}`, visibility: "public", source_rfp_id: p3.id, source_published_revision_id: danglingRevId3,
    }));
    let defect3Threw = false;
    let defect3Error = "";
    try {
      await commitMarketUnlock({ project_id: p3.id, published_revision_id: danglingRevId3, board_opportunity_id: oppId3 });
    } catch (e) {
      defect3Threw = e instanceof MarketUnlockBindingError;
      defect3Error = (e as Error).message;
    }
    const { getFrozenRevision } = await import("../src/lib/published-snapshot");
    const revisionExists3 = (await getFrozenRevision(danglingRevId3)) !== null;
    const unlocked3 = await isMarketUnlocked(p3.id);
    evidence.defects = {
      ...(evidence.defects as object),
      defect3_dangling_revision: {
        project_id: p3.id,
        published_revision_id_attempted: danglingRevId3,
        frozen_revision_actually_persisted: revisionExists3,
        commit_market_unlock_refused: defect3Threw,
        refusal_reason: defect3Error,
        is_market_unlocked: unlocked3,
        VIOLATION: unlocked3 === true,
      },
    };
    console.log(`FrozenRevision for "${danglingRevId3}" actually persisted = ${revisionExists3} (expected false)`);
    console.log(`commitMarketUnlock() refused (MarketUnlockBindingError) = ${defect3Threw} (${defect3Error})`);
    console.log(`isMarketUnlocked() = ${unlocked3} (expected false -- never unlocked against a revision that was never frozen)`);

    // -------------------------------------------------------------------
    // Defect 2: the real production path (real business-email
    // verification, real DNS/HTTPS to netify.co.uk) -- reruns
    // verify-publish-route-live-demo.ts's Scenario 3 against the SAME
    // fake-kv instance/session as defects 1 and 3 above (kept open
    // throughout, not restarted -- the app's KV client caches
    // KV_REST_API_URL/TOKEN at module-import time, so a second,
    // differently-addressed fake-kv instance is silently ignored by
    // every route handler already imported earlier in this process; see
    // Part D's own header comment in
    // validate-rfp-builder-match-disclosure.ts for the same gotcha).
    // -------------------------------------------------------------------
    console.log("\n=== Defect 2 (after): real board quality-gate failure, real production route ===");
    const { makeRequest } = await import("./fake-kv-harness");
    const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
    const { POST: publishRoute } = await import("../src/app/api/rfp/[id]/publish/route");
    const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
    const { createSession } = await import("../src/lib/rfp-store");
    const { sessionCookieHeader } = await import("../src/lib/auth");
    const { getPublicationAttempt } = await import("../src/lib/publication-attempt");

    const email = "test-buyer@netify.co.uk";
    const session = await createSession({ role: "buyer", email, vendor_slug: null });
    const cookie = sessionCookieHeader(session.token);

    const createRes = await createSecurityProjectRoute(
      makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
        body: {
          requirement: { organisation: { sector: "Healthcare & pharma" }, estate: { sites: 12, users: 90 }, drivers: ["renewal"], constraints: {} },
          consent: true,
          source_turns: [{ id: "st_after_d2", text: "Round-2 AFTER repro: defect 2.", at: 1000, via: "typed" }],
        },
      }),
    );
    const created = (await createRes.json()) as { project?: { id?: string; manage_token?: string }; error?: string };
    const id = created.project?.id ?? "";
    const manage = created.project?.manage_token ?? "";

    const publishRes = await publishRoute(
      makeRequest("POST", `https://example.test/api/rfp/${id}/publish`, { body: { manage_token: manage, shortlist_size: 3, list_on_board: true }, cookie }),
      { params: Promise.resolve({ id }) },
    );
    const publishBody = (await publishRes.json()) as { ok?: boolean; status?: string; market_unlocked?: boolean; board?: { listed?: boolean; reason?: string } };

    const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
    const reloaded = (await reload.json()) as { status?: string };
    const unlocked2 = await isMarketUnlocked(id);
    const attempt2 = await getPublicationAttempt(id);

    evidence.defects = {
      ...(evidence.defects as object),
      defect2_status_published_before_board_success: {
        project_id: id,
        board_listing_failed: publishBody.board?.listed === false,
        board_fail_reason: publishBody.board?.reason ?? "",
        project_status_immediately_after_publish_call: publishBody.status,
        project_status_after_reload: reloaded.status,
        market_unlocked: unlocked2,
        publication_attempt_exists_and_retryable: attempt2 !== null && attempt2.board_opportunity_id === null,
        VIOLATION: publishBody.status === "published" || reloaded.status === "published" || unlocked2 === true,
      },
    };
    console.log(`board listing failed = ${publishBody.board?.listed === false} (${publishBody.board?.reason})`);
    console.log(`project.status immediately after the publish call = "${publishBody.status}" (expected NOT "published")`);
    console.log(`project.status after reload = "${reloaded.status}" (expected NOT "published")`);
    console.log(`isMarketUnlocked() = ${unlocked2} (expected false)`);
  } finally {
    await kv.stop();
  }

  const outFile = join(OUT_DIR, "round2-after-evidence.json");
  writeFileSync(outFile, JSON.stringify(evidence, null, 2));
  console.log(`\nEvidence written to ${outFile}`);

  const anyViolation = Object.values(evidence.defects as Record<string, { VIOLATION?: boolean }>).some((d) => d.VIOLATION === true);
  console.log(anyViolation ? "\nSTILL VIOLATING (unexpected -- investigate)" : "\nALL THREE DEFECTS CONFIRMED FIXED (no VIOLATION)");
  if (anyViolation) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
