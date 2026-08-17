#!/usr/bin/env node
/**
 * 2030 shell reset, Checkpoint A (16 Aug 2026): desktop 1440x900 and
 * mobile 390x844 screenshots of the restructured ProjectDesk.tsx shell
 * (project bar, ~70/30 document/mission-rail grid, fixed bottom command
 * dock) against the REAL running dev server and REAL component code --
 * not a static mock. Follows the existing dev-server-screenshot
 * convention already used by capture-market-unlock-round2-screenshots.mjs.
 *
 * NOT part of `npm run validate`/`npm run build`. Run explicitly:
 *   node scripts/capture-2030-shell-screenshots.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SCREENSHOT_DIR = join(REPO_ROOT, "reports", "screenshots", "2030-shell-checkpoint-a");
mkdirSync(SCREENSHOT_DIR, { recursive: true });
const PORT = 3411;
const BASE = `http://localhost:${PORT}/sase`;

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await reachable(url)) return;
    await delay(500);
  }
  throw new Error(`Dev server did not become reachable at ${url} within ${timeoutMs}ms`);
}

async function main() {
  console.log("Starting dev server on port", PORT);
  const dev = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  let devOut = "";
  dev.stdout.on("data", (d) => { devOut += d.toString(); });
  dev.stderr.on("data", (d) => { devOut += d.toString(); });

  try {
    await waitForServer(`${BASE}/`, 90000);
    await delay(1500);

    const browser = await chromium.launch();

    // ---- Desktop: blank/first-turn state ----
    {
      const page = await browser.newPage({ viewport: DESKTOP_VIEWPORT });
      await page.goto(`${BASE}/home/`, { waitUntil: "networkidle" });
      await delay(800);
      await page.screenshot({ path: join(SCREENSHOT_DIR, "01-desktop-blank.png") });
      await page.close();
    }

    // ---- Desktop: scope-forming state (composer used, outline + mission rail populated) ----
    {
      const page = await browser.newPage({ viewport: DESKTOP_VIEWPORT });
      await page.goto(`${BASE}/home/`, { waitUntil: "networkidle" });
      const box = page.locator("textarea").first();
      await box.click();
      await box.fill(
        "Manufacturing company, 20 sites across the UK, 50 remote users, replacing an ageing MPLS network with SD-WAN and full SASE, need dual-circuit resilience on our production-critical sites."
      );
      await box.press("Enter");
      await delay(4000);
      await page.screenshot({ path: join(SCREENSHOT_DIR, "02-desktop-scope-forming.png"), fullPage: false });
      await page.screenshot({ path: join(SCREENSHOT_DIR, "02b-desktop-scope-forming-fullpage.png"), fullPage: true });
      await page.close();
    }

    // ---- Mobile: blank/first-turn state ----
    {
      const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
      await page.goto(`${BASE}/home/`, { waitUntil: "networkidle" });
      await delay(800);
      await page.screenshot({ path: join(SCREENSHOT_DIR, "03-mobile-blank.png") });
      await page.close();
    }

    // ---- Mobile: scope-forming state ----
    {
      const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
      await page.goto(`${BASE}/home/`, { waitUntil: "networkidle" });
      const box = page.locator("textarea").first();
      await box.click();
      await box.fill(
        "Manufacturing company, 20 sites across the UK, 50 remote users, replacing an ageing MPLS network with SD-WAN and full SASE, need dual-circuit resilience on our production-critical sites."
      );
      await box.press("Enter");
      await delay(4000);
      await page.screenshot({ path: join(SCREENSHOT_DIR, "04-mobile-scope-forming.png") });
      await page.screenshot({ path: join(SCREENSHOT_DIR, "04b-mobile-scope-forming-fullpage.png"), fullPage: true });
      await page.close();
    }

    await browser.close();
    console.log("Screenshots saved to", SCREENSHOT_DIR);
  } catch (err) {
    console.error("FAILED:", err);
    console.error("---- dev server output (tail) ----");
    console.error(devOut.slice(-4000));
    process.exitCode = 1;
  } finally {
    dev.kill("SIGTERM");
    await delay(500);
  }
}

main();
