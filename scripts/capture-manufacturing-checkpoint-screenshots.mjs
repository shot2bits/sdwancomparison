#!/usr/bin/env node
/**
 * Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug 2026)
 * checkpoint: desktop + 390px mobile screenshots of the real,
 * un-pushed branch reproducing the exact manufacturing prompt, plus the
 * B/C/D follow-on answers, so the "before -> after" claim in the
 * checkpoint report is a real screenshot, not a description. Manual
 * verification run, same clean-room server-lifecycle convention as
 * scripts/validate-living-procurement-os-stage-a-ui.mjs (reused directly
 * below) -- not part of `npm run validate`/`npm run build`.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SCREENSHOT_DIR = join(REPO_ROOT, "reports", "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const DEFAULT_BASE = "http://localhost:3000/sase";
const FALLBACK_PORT = 3212;

const promptManufacturing = "UK 20 site SD-WAN in the manufacturing sector, full SASE required, 50 remote users.";
const promptResilience = "Yes, dual circuits at our five production-critical sites. Single circuits are acceptable elsewhere.";
const promptSaseShape = "We prefer a single platform, but identity must integrate with Entra ID and we will consider third-party SOC services.";
const promptResidency = "Customer data must remain in the UK, including backups and support access.";

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await reachable(`${DEFAULT_BASE}/workspace`)) {
    console.log(`Reusing already-running dev server at ${DEFAULT_BASE}.`);
    return { base: DEFAULT_BASE, stop: async () => {} };
  }
  console.log(`Starting a dev server on port ${FALLBACK_PORT} for this run.`);
  const child = spawn("npx", ["next", "dev", "-p", String(FALLBACK_PORT)], { cwd: REPO_ROOT, stdio: "pipe", detached: true });
  let out = "";
  child.stdout?.on("data", (d) => { out += d.toString(); });
  child.stderr?.on("data", (d) => { out += d.toString(); });
  const base = `http://localhost:${FALLBACK_PORT}/sase`;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await reachable(`${base}/workspace`)) {
      console.log(`Self-started dev server ready at ${base}.`);
      return {
        base,
        stop: async () => {
          try { if (child.pid) process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
          await delay(300);
        },
      };
    }
    await delay(500);
  }
  console.error("Server log tail:\n" + out.slice(-4000));
  throw new Error(`Dev server did not become ready within 90s at ${base}`);
}

async function typeAndSend(page, text) {
  const box = page.locator("textarea").first();
  await box.click();
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(1200);
}

async function main() {
  const { base: BASE, stop } = await ensureServer();
  let browser;
  try {
    browser = await chromium.launch();

    // ---- Desktop, 1440x1200 ----
    const ctxD = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    const pageD = await ctxD.newPage();
    await pageD.goto(`${BASE}/workspace`, { waitUntil: "networkidle" });
    await typeAndSend(pageD, promptManufacturing);
    await pageD.screenshot({ path: join(SCREENSHOT_DIR, "mfg-01-desktop-after-fixtureA.png"), fullPage: true });
    console.log("Saved mfg-01-desktop-after-fixtureA.png");

    await typeAndSend(pageD, promptResilience);
    await typeAndSend(pageD, promptSaseShape);
    await typeAndSend(pageD, promptResidency);
    await pageD.screenshot({ path: join(SCREENSHOT_DIR, "mfg-02-desktop-after-fixturesBCD.png"), fullPage: true });
    console.log("Saved mfg-02-desktop-after-fixturesBCD.png");
    await ctxD.close();

    // ---- Mobile, 390x844 (ordinary iPhone 12/13/14 viewport) ----
    const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageM = await ctxM.newPage();
    await pageM.goto(`${BASE}/workspace`, { waitUntil: "networkidle" });
    await typeAndSend(pageM, promptManufacturing);
    // ordinary (non-fullPage) capture at natural post-send scroll
    // position -- see the existing UI fixture's own note on why
    // fullPage captures can show a transient sticky-composer gap that a
    // real scrolling user never sees.
    await pageM.screenshot({ path: join(SCREENSHOT_DIR, "mfg-03-mobile-390-ordinary.png") });
    console.log("Saved mfg-03-mobile-390-ordinary.png");
    await pageM.screenshot({ path: join(SCREENSHOT_DIR, "mfg-04-mobile-390-fullpage.png"), fullPage: true });
    console.log("Saved mfg-04-mobile-390-fullpage.png");

    // Scroll to the NextQuestion cards / section outline specifically,
    // since they sit below the composer and fold.
    const nextDecisions = pageM.getByText(/Best next decisions/i).first();
    if (await nextDecisions.count()) {
      await nextDecisions.scrollIntoViewIfNeeded();
      await pageM.screenshot({ path: join(SCREENSHOT_DIR, "mfg-05-mobile-390-next-decisions.png") });
      console.log("Saved mfg-05-mobile-390-next-decisions.png");
    } else {
      console.log("WARNING: 'Best next decisions' text not found on mobile viewport -- check selector/render gate.");
    }
    await ctxM.close();
  } finally {
    if (browser) await browser.close();
    await stop();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
