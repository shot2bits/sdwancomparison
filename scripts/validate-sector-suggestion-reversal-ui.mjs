#!/usr/bin/env node
/**
 * Sector-suggestion accept -> undo reversal hotfix (Robert, 15 Aug 2026,
 * post-f33f103 production verification round). A real browser fixture,
 * following the exact conventions of
 * scripts/validate-living-procurement-os-stage-a-ui.mjs (ensureServer,
 * typeAndSend, record, mobile viewport), that CLICKS THE REAL PRODUCTION
 * COMPONENT CONTROLS -- Robert's explicit instruction was "do not satisfy
 * it by constructing ledger events directly" -- to prove the gap found on
 * https://netify.co.uk/ is genuinely closed:
 *
 *   there was no way, in the live UI, to decline a sector suggestion
 *   (e.g. "IT/OT network segmentation") that had already been accepted --
 *   only to accept it once, or decline it while still pending.
 *
 * What this script checks, all via real page.click()/page.fill() against
 * the actual rendered DOM, never by calling declineAcceptedSuggestion or
 * any other app function directly:
 *   1. Accepting a pending sector-suggestion card renders it in the new
 *      "<section> · accepted" block with a green "Accepted" badge, the
 *      requirement count increases by exactly one, and the pending card
 *      is gone.
 *   2. Clicking "Mark as not needed" on that accepted card removes it
 *      immediately -- the accepted card disappears and the requirement
 *      count drops back by exactly one -- with NO reload, proving the
 *      compiled clause (acceptedSectorSuggestionClauses(), reading the
 *      same ps-<id> noted tag) is gone on the very next live compile.
 *   3. The pre-existing "decline while pending" path (recordDecision's
 *      dismiss/decline branch, one of the four call sites this hotfix's
 *      signature refactor touched) still works through a real click, on
 *      the pack's OTHER suggestion -- proving the refactor from
 *      recordDecision(nq, opt, entry) to recordDecision(questionId,
 *      optionLabel, entry) broke nothing at any of its four sites.
 *   4. A REAL save (POST /api/security-sourcing/project, through a real
 *      "Save this project" click, real consent checkbox, real signed-in
 *      session) followed by a REAL page reload via the app's own
 *      ?id=<id> resume link (project/[id]/page.tsx's own "Add more
 *      detail" convention) shows the reversal survives: the undone
 *      suggestion renders neither as accepted nor back in the pending
 *      list, and the OTHER, still-accepted suggestion (added after the
 *      save, see the "post-save cycle" section below) is still there.
 *   5. Steps 1-2 repeat at a 390x844 mobile viewport.
 *
 * On "decline THEN accept the SAME suggestion, real order, real
 * ledger, on resume": Fixture N2 (validate-living-procurement-os-
 * stage-a.ts, "counter-example") already proves this at the ledger-
 * replay level (mergeDecisionLedger resolves ACCEPTED when the accept
 * entry is chronologically later), unmodified by this hotfix. It is not
 * re-driven through a live browser here because the live client has no
 * UI path to reproduce that exact ordering within one sitting:
 * setDeclinedSuggestionIds() is additive-only in ProjectDesk.tsx (three
 * call sites, none of them ever removes an id) BY DESIGN -- declining a
 * still-pending suggestion is meant to be permanent, unlike declining an
 * ALREADY-ACCEPTED one, which is exactly the new reversible action this
 * hotfix adds. Producing "decline recorded before accept" for the same
 * id would require a second session/device racing the first, outside
 * this fixture's scope.
 *
 * Local KV: this sandbox has no KV_REST_API_URL/TOKEN (no network to a
 * real Upstash instance), so every /api/auth/* and /api/rfp/* route
 * would otherwise 503 "Storage not configured" -- which is exactly what
 * blocked scripting a real save/reload fixture earlier in this round.
 * scripts/lib/fake-kv-server.mjs is a same-process, in-memory stand-in
 * for the Upstash REST protocol (GET/SET/DEL/EXPIRE/PEXPIRE/SADD/SREM/
 * SMEMBERS/SISMEMBER/HGETALL/HINCRBY/MGET/SCAN/LPUSH/LRANGE/LTRIM --
 * exactly the command vocabulary rfp-store.ts issues, checked by
 * grepping every call site). It does not touch the application: every
 * request still runs through the real Next.js route handlers and real
 * business logic, only the Redis-compatible persistence layer
 * underneath is swapped for an equivalent local one, same as any unit
 * test fakes an external database. Because it configures a REAL
 * KV_REST_API_URL/TOKEN pair, this script always spawns its OWN `next
 * dev` (never reuses an already-running one, which would lack these
 * env vars) on a dedicated port, and tears it down in `finally`.
 *
 * NOT part of `npm run validate`/`npm run build` (browser + its own
 * server, same as its sibling stage-a-ui fixture). Run explicitly:
 *   node scripts/validate-sector-suggestion-reversal-ui.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startFakeKv } from "./lib/fake-kv-server.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PORT = 3213;
const BASE = `http://localhost:${PORT}/sase`;

// Sector = manufacturing (activates the pack), buying phrased as "managed
// security service" so procurement.buying resolves to "managed_security"
// -- deliberately NOT "SASE"/"SD-WAN"/"SSE" wording, which would resolve
// buying to "sase"/"sdwan"/"sse" instead and flip securityScope
// (buying === "managed_security" || buying === null) to false. That
// matters here specifically because the ?id= resume replay of noted/
// declinedSuggestionIds/decision_ledger (ProjectDesk.tsx, the resumeId
// effect) is explicitly scoped to the security_sourcing engine only
// ("This project isn't a Security Sourcing engagement yet, so it can't
// be reopened here") -- a general network/SASE project's Save path is a
// different, wizard-driven route this resume flow does not drive at
// all. The manufacturing PACK itself activates from organisation.sector
// alone regardless of buying, so this wording still exercises the exact
// suggestions (mf-ot-visibility, mf-segmentation) the hotfix is about.
const promptA =
  "We are a UK manufacturing organisation with 20 sites and 200 users. We need a managed security service covering our OT and ICS systems on the shop floor, operating 24/7.";

const TEST_EMAIL = `qa-reversal-fixture+${Math.floor(Math.random() * 1e9)}@example.com`;

let passed = 0;
let failed = 0;
function record(cond, label, detail) {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${label}${detail !== undefined ? `  ->  ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${label}${detail !== undefined ? `  ->  ${detail}` : ""}`);
  }
}

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function ensureServer(kv) {
  console.log(`Starting a dedicated dev server on port ${PORT} (own KV env, never reused).`);
  const child = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: REPO_ROOT,
    stdio: "pipe",
    detached: true,
    env: { ...process.env, KV_REST_API_URL: kv.url, KV_REST_API_TOKEN: kv.token },
  });
  let out = "";
  child.stdout?.on("data", (d) => { out += d.toString(); });
  child.stderr?.on("data", (d) => { out += d.toString(); });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await reachable(`${BASE}/workspace`)) {
      console.log(`Dev server ready at ${BASE}.`);
      return {
        stop: async () => {
          try {
            if (child.pid) process.kill(-child.pid, "SIGTERM");
          } catch { /* already gone */ }
          await delay(300);
        },
      };
    }
    await delay(500);
  }
  console.error("Server log tail:\n" + out.slice(-4000));
  throw new Error(`Dev server did not become ready within 90s at ${BASE}`);
}

async function typeAndSend(page, text) {
  const box = page.locator("textarea").first();
  await box.click();
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(1200);
}

async function requirementCount(page) {
  const card = page.getByText(/^requirements$/i).first().locator("xpath=..");
  const text = await card.innerText();
  const m = /^(\d+)/.exec(text.trim());
  return m ? Number(m[1]) : null;
}

/** Real sign-in, no UI navigation: exchanges a magic token for a session
 *  cookie via the SAME /api/auth/request + /api/auth/verify routes the
 *  app's own SignIn/CodeEntry components call, using the context's own
 *  APIRequestContext (shares the cookie jar with every page opened from
 *  this context, no manual cookie plumbing). This sidesteps the one
 *  genuine dead end investigated earlier: clicking the SignIn
 *  component's dev_link anchor navigates the tab to /auth/verify and
 *  back, which would destroy every in-memory React state change (typed
 *  prompts, accept/undo clicks) built up before that point. Signing in
 *  BEFORE the workspace page ever mounts avoids the problem entirely --
 *  ProjectDesk's own mount-time fetch("/api/auth/session") then finds an
 *  authenticated session from the very first render, exactly like a
 *  buyer who signed in on a previous visit. */
async function signIn(context, email) {
  const reqRes = await context.request.post(`${BASE}/api/auth/request`, {
    data: { email, role: "buyer", return_to: "/sase/workspace/" },
  });
  const reqData = await reqRes.json();
  if (!reqData.dev_link) throw new Error(`No dev_link in /api/auth/request response: ${JSON.stringify(reqData)}`);
  const token = new URL(reqData.dev_link).searchParams.get("token");
  const verifyRes = await context.request.post(`${BASE}/api/auth/verify`, { data: { token } });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok()) throw new Error(`/api/auth/verify failed: ${JSON.stringify(verifyData)}`);
  return verifyData;
}

/** Locates a pending NextQuestion suggestion card by its stable
 *  "sector:<id>" title, and the sibling button with the given label
 *  inside the SAME card -- never a global button query, which could hit
 *  the wrong card once more than one suggestion is pending. */
// xpath ancestor::div[1] with the card's own rounded-corner class walks up
// to the SINGLE nearest card container, not every containing div up to the
// page root (a plain locator(div, {has: ...}) match, tried first, matched
// 3 nested divs at once -- the individual card, the 3-column grid, and the
// section wrapper -- each "containing" every Accept button on the page).
function pendingSuggestionCard(page, suggestionId) {
  return page
    .locator(`span[title="Stable question id"]`, { hasText: `sector:${suggestionId}` })
    .locator(`xpath=ancestor::div[contains(@class,'rounded-[10px]')][1]`);
}
function acceptedSuggestionCard(page, suggestionId) {
  return page
    .locator(`span[title="Stable suggestion id"]`, { hasText: new RegExp(`^${suggestionId}$`) })
    .locator(`xpath=ancestor::div[contains(@class,'rounded-[10px]')][1]`);
}

async function runCoreFlow(page, { viewportLabel }) {
  await page.goto(`${BASE}/workspace/`, { waitUntil: "networkidle" });
  await typeAndSend(page, promptA);

  const baseline = await requirementCount(page);
  record(baseline !== null, `[${viewportLabel}] Requirements count reads as a real number after Prompt A`, `count=${baseline}`);

  // Both manufacturing suggestions pending.
  const segPending = pendingSuggestionCard(page, "mf-segmentation");
  const otPending = pendingSuggestionCard(page, "mf-ot-visibility");
  record(await segPending.count() > 0, `[${viewportLabel}] Segmentation suggestion (mf-segmentation) renders as a pending card`, "");
  record(await otPending.count() > 0, `[${viewportLabel}] OT visibility suggestion (mf-ot-visibility) renders as a pending card`, "");

  // ---- Step 1: real click on "Accept" for mf-segmentation ----
  await segPending.getByRole("button", { name: "Accept" }).click();
  await page.waitForTimeout(600);
  const afterAccept = await requirementCount(page);
  record(afterAccept === baseline + 1, `[${viewportLabel}] Accepting mf-segmentation (real click) increases the requirement count by exactly 1`, `before=${baseline} after=${afterAccept}`);
  record(await pendingSuggestionCard(page, "mf-segmentation").count() === 0, `[${viewportLabel}] mf-segmentation is no longer a pending card once accepted`, "");
  const accCard = acceptedSuggestionCard(page, "mf-segmentation");
  record(await accCard.count() > 0, `[${viewportLabel}] mf-segmentation now renders in the new accepted-suggestions block`, "");
  record((await accCard.getByText("Accepted", { exact: true }).count()) > 0, `[${viewportLabel}] The accepted card shows the green "Accepted" badge`, "");

  // ---- Step 3 (regression): real click on "Not needed" for the OTHER,
  //      still-pending suggestion (mf-ot-visibility) -- the pre-existing
  //      decline-while-pending path, through one of the four call sites
  //      the recordDecision signature refactor touched. ----
  await otPending.getByRole("button", { name: "Not needed" }).click();
  await page.waitForTimeout(600);
  record(await pendingSuggestionCard(page, "mf-ot-visibility").count() === 0, `[${viewportLabel}] Declining mf-ot-visibility while pending (real click) removes its pending card -- pre-existing path unbroken by the recordDecision refactor`, "");
  record(await acceptedSuggestionCard(page, "mf-ot-visibility").count() === 0, `[${viewportLabel}] The declined-while-pending suggestion never appears in the accepted block`, "");
  const afterDecline = await requirementCount(page);
  record(afterDecline === afterAccept, `[${viewportLabel}] Declining a suggestion contributes no clause -- requirement count unchanged`, `count=${afterDecline}`);

  // ---- Step 2: THE HOTFIX -- real click on "Mark as not needed" for
  //      the already-accepted mf-segmentation card. ----
  await accCard.getByRole("button", { name: "Mark as not needed" }).click();
  await page.waitForTimeout(600);
  const afterUndo = await requirementCount(page);
  record(afterUndo === baseline, `[${viewportLabel}] HOTFIX: "Mark as not needed" on an accepted suggestion (real click) drops the requirement count back to baseline immediately, no reload`, `baseline=${baseline} afterUndo=${afterUndo}`);
  record(await acceptedSuggestionCard(page, "mf-segmentation").count() === 0, `[${viewportLabel}] HOTFIX: the accepted card for mf-segmentation is gone immediately after "Mark as not needed"`, "");
  record(await pendingSuggestionCard(page, "mf-segmentation").count() === 0, `[${viewportLabel}] mf-segmentation does not reappear as a pending card either -- declining is permanent by design, same as declining while pending`, "");

  return { baseline, afterAccept, afterDecline, afterUndo };
}

async function main() {
  const kv = await startFakeKv();
  const { stop } = await ensureServer(kv);
  let browser;
  try {
    browser = await chromium.launch();

    // ================================================================
    // Desktop: the full accept -> decline(other) -> undo cycle, THEN a
    // real save, a real page reload via ?id=, and re-checking the
    // reversal survived.
    // ================================================================
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await signIn(ctx, TEST_EMAIL);
    const page = await ctx.newPage();

    await runCoreFlow(page, { viewportLabel: "desktop" });

    // ---- Step 4: real save ----
    await page.getByRole("button", { name: /Save this project/i }).click();
    await page.waitForTimeout(300);
    const consentBox = page.locator('label:has-text("consent") input[type="checkbox"]').first();
    // Fall back to the first checkbox in the open save sheet if the text
    // match above is too narrow for the actual consent copy.
    const saveSheetCheckbox = (await consentBox.count()) > 0 ? consentBox : page.locator('div:has(> button:has-text("Save")) input[type="checkbox"]').first();
    if (await saveSheetCheckbox.count() > 0) await saveSheetCheckbox.check();

    const [saveResponse] = await Promise.all([
      page.waitForResponse((r) => /\/api\/(security-sourcing\/project|rfp)(\?|$)/.test(r.url()) && r.request().method() === "POST"),
      page.getByRole("button", { name: /^Save$|^Save changes$/ }).click(),
    ]);
    const saveData = await saveResponse.json().catch(() => ({}));
    const savedId = saveData.id ?? saveData.project?.id;
    const savedManage = saveData.manage_token ?? saveData.project?.manage_token ?? "";
    record(Boolean(savedId), "Real save (POST, real click, real consent checkbox) returns a project id", `id=${savedId} status=${saveResponse.status()}`);

    // Reload via the app's own resume link convention
    // (project/[id]/page.tsx's "Add more detail": /workspace/?id=<id>).
    // The owner's signed-in session travels automatically (no manage
    // token required, per the resumeId effect's own item 4) -- included
    // anyway since it is present and harmless, matching what a real
    // "Add more detail" link actually carries when the visitor holds one.
    const resumeUrl = `${BASE}/workspace/?id=${encodeURIComponent(savedId)}${savedManage ? `&manage=${encodeURIComponent(savedManage)}` : ""}`;
    await page.goto(resumeUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // resume fetch + decision-ledger replay

    record(await acceptedSuggestionCard(page, "mf-segmentation").count() === 0, "SAVE -> RELOAD: after a genuine page reload, the undone mf-segmentation suggestion is NOT back in the accepted block -- the reversal survived a real save/resume round trip", "");
    record(await pendingSuggestionCard(page, "mf-segmentation").count() === 0, "SAVE -> RELOAD: mf-segmentation is not back in the pending list either -- decline_suggestion replays as permanent on resume too", "");
    const accOtAfterReload = acceptedSuggestionCard(page, "mf-ot-visibility");
    const pendingOtAfterReload = pendingSuggestionCard(page, "mf-ot-visibility");
    record(await accOtAfterReload.count() === 0 && await pendingOtAfterReload.count() === 0, "SAVE -> RELOAD: mf-ot-visibility (declined while pending, never touched again) stays correctly absent from both lists -- sanity check that this reload genuinely replayed real persisted ledger state, not just an empty fresh page", "");

    await ctx.close();

    // ================================================================
    // Mobile (390x844): steps 1-2 repeated at the production breakpoint.
    // ================================================================
    const ctxMobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await signIn(ctxMobile, `mobile-${TEST_EMAIL}`);
    const pageMobile = await ctxMobile.newPage();
    await runCoreFlow(pageMobile, { viewportLabel: "mobile-390" });
    await ctxMobile.close();
  } finally {
    if (browser) await browser.close();
    await stop();
    await kv.stop();
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
