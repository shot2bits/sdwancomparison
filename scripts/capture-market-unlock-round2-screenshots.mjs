#!/usr/bin/env node
/**
 * Market-unlock correction round 2 (16 Aug 2026): desktop + mobile
 * screenshots of RfpBuilder.tsx's publish panel in the THREE lifecycle
 * states Robert's deliverables list names -- pre-publish, failed
 * publication, and successfully published -- captured against the REAL
 * running app (real routes, real fake-kv, real business-email
 * verification against netify.co.uk), not a mock or a static render.
 *
 * Follows the exact conventions of validate-row8-vendor-disclosure-ui.mjs
 * (own dev server, own fake-kv, real sign-in via /api/auth/request+verify).
 *
 * NOT part of `npm run validate`/`npm run build` (own browser + own dev
 * server, real network for business-email verification). Run explicitly:
 *   node scripts/capture-market-unlock-round2-screenshots.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startFakeKv } from "./lib/fake-kv-server.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SCREENSHOT_DIR = join(REPO_ROOT, "reports", "screenshots", "market-unlock-round2");
mkdirSync(SCREENSHOT_DIR, { recursive: true });
const PORT = 3217;
const BASE = `http://localhost:${PORT}/sase`;

const DESKTOP_VIEWPORT = { width: 1440, height: 1200 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

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
          try { if (child.pid) process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
          await delay(300);
        },
      };
    }
    await delay(500);
  }
  console.error("Server log tail:\n" + out.slice(-4000));
  throw new Error(`Dev server did not become ready within 90s at ${BASE}`);
}

async function signIn(context, email) {
  const reqRes = await context.request.post(`${BASE}/api/auth/request`, {
    data: { email, role: "buyer", return_to: "/sase/rfp-builder/" },
  });
  const reqData = await reqRes.json();
  if (!reqData.dev_link) throw new Error(`No dev_link in /api/auth/request response: ${JSON.stringify(reqData)}`);
  const token = new URL(reqData.dev_link).searchParams.get("token");
  const verifyRes = await context.request.post(`${BASE}/api/auth/verify`, { data: { token } });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok()) throw new Error(`/api/auth/verify failed: ${JSON.stringify(verifyData)}`);
  return verifyData;
}

async function createDraft(context, title) {
  const createRes = await context.request.post(`${BASE}/api/rfp`, {
    data: { title, buyer: { sector: "manufacturing", organisation_size: "201-1000", operating_model: "hybrid", regions: ["uk"] } },
  });
  return createRes.json();
}

/** One context per viewport, both signed in as the SAME real, netify.co.uk-domain buyer. */
async function newSignedInContext(browser, email, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile });
  await signIn(ctx, email);
  return ctx;
}

async function shotBoth(desktopCtx, mobileCtx, url, baseName, waitForSelector) {
  for (const [ctx, tag] of [[desktopCtx, "desktop"], [mobileCtx, "mobile"]]) {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    if (waitForSelector) await page.locator(waitForSelector).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    const path = join(SCREENSHOT_DIR, `${baseName}-${tag}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(`Screenshot: ${path}`);
    await page.close();
  }
}

async function main() {
  const kv = await startFakeKv();
  const { stop } = await ensureServer(kv);
  let browser;
  try {
    browser = await chromium.launch();
    const email = `qa-mu-r2-shots+${Math.floor(Math.random() * 1e9)}@netify.co.uk`;
    const desktopCtx = await newSignedInContext(browser, email, DESKTOP_VIEWPORT, false);
    const mobileCtx = await newSignedInContext(browser, email, MOBILE_VIEWPORT, true);

    // ---- State 1: PRE-PUBLISH -------------------------------------------
    const p1 = await createDraft(desktopCtx, "SD-WAN and SASE requirement: UK manufacturer, 20 sites");
    const url1 = `${BASE}/rfp-builder/${p1.id}?manage=${p1.manage_token}`;
    await shotBoth(desktopCtx, mobileCtx, url1, "1-pre-publish", "#publish");
    console.log(`State 1 (pre-publish) captured: ${p1.id}`);

    // ---- State 2: FAILED PUBLICATION (real board quality-gate failure, --
    // ---- real business-email verification) ------------------------------
    // A title containing a TITLE_MARKERS word ("placeholder") trips the
    // real publicNoticeQualityGate() board-listing refusal (notice-
    // validate.ts) -- a genuine board failure, not a synthetic one -- which
    // requirement 2 requires leaves the project non-published and market-
    // locked (RfpBuilder.tsx's `publicationLocked` state).
    const p2 = await createDraft(desktopCtx, "Placeholder title for screenshot fixture (deliberately trips the board quality gate)");
    const publishRes2 = await desktopCtx.request.post(`${BASE}/api/rfp/${p2.id}/publish`, {
      data: { manage_token: p2.manage_token, shortlist_size: 3, list_on_board: true },
    });
    const publishBody2 = await publishRes2.json();
    console.log(`State 2 setup: publish call status=${publishRes2.status()} board.listed=${publishBody2.board?.listed} status=${publishBody2.status}`);
    if (publishBody2.status === "published") {
      throw new Error(`State 2 fixture unexpectedly published -- the board quality gate did not trip as intended: ${JSON.stringify(publishBody2)}`);
    }
    const url2 = `${BASE}/rfp-builder/${p2.id}?manage=${p2.manage_token}`;
    await shotBoth(desktopCtx, mobileCtx, url2, "2-failed-publication", "#publish");
    console.log(`State 2 (failed publication) captured: ${p2.id}`);

    // ---- State 3: SUCCESSFULLY PUBLISHED (real public board publication, -
    // ---- real business-email verification, real market unlock) ---------
    const p3 = await createDraft(desktopCtx, "SD-WAN and SASE requirement: UK retailer, 35 sites, SASE consolidation");
    const publishRes3 = await desktopCtx.request.post(`${BASE}/api/rfp/${p3.id}/publish`, {
      data: { manage_token: p3.manage_token, shortlist_size: 3, list_on_board: true },
    });
    const publishBody3 = await publishRes3.json();
    console.log(`State 3 setup: publish call status=${publishRes3.status()} board.listed=${publishBody3.board?.listed} status=${publishBody3.status} market_unlocked=${publishBody3.market_unlocked}`);
    if (publishBody3.status !== "published" || publishBody3.market_unlocked !== true) {
      throw new Error(`State 3 fixture failed to publish/unlock as intended: ${JSON.stringify(publishBody3)}`);
    }
    const url3 = `${BASE}/rfp-builder/${p3.id}?manage=${p3.manage_token}`;
    await shotBoth(desktopCtx, mobileCtx, url3, "3-successfully-published", "#publish");
    console.log(`State 3 (successfully published) captured: ${p3.id}`);

    console.log(`\nAll screenshots written to ${SCREENSHOT_DIR}`);
  } finally {
    await browser?.close();
    await stop();
    await kv.stop();
  }
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exitCode = 1;
});
