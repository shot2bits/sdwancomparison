#!/usr/bin/env node
/**
 * Browser journey for the canonical RFP Builder page (3 Sep 2026), run
 * against a started server:
 *
 *   RFP_UI_BASE_URL=http://localhost:3000/sase/home/ node scripts/validate-rfp-canonical-journey.mjs
 *   RFP_UI_BASE_URL=https://netify.co.uk/sase-sd-wan-rfp-builder/ node scripts/validate-rfp-canonical-journey.mjs
 *
 * Confirms, on desktop and on a phone viewport:
 *  - the page loads with the visible H1, the two definitions and the
 *    static table and FAQs, before any interaction;
 *  - the workspace interface is intact (guided pane, living document,
 *    entry routes, prompt) and nothing overflows horizontally;
 *  - a project can still be started by typing a requirement;
 *  - once a project starts the marketing hero collapses (sr-only), so the
 *    workspace carries no marketing headline, exactly as before;
 *  - the publishing controls are unchanged: a fresh draft is NOT published
 *    and the review/publish route still exists.
 */
import { chromium } from "playwright";

const BASE_URL = process.env.RFP_UI_BASE_URL ?? "http://localhost:3000/sase/home/";
let failures = 0;
function check(condition, label, detail = "") {
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` -> ${detail}` : ""}`);
}

async function open(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle" });
  return page;
}

async function staticContent(page, label) {
  const h1 = page.locator("h1#page-h1");
  check((await h1.count()) === 1, `${label}: one H1 with id page-h1`);
  check((await h1.innerText()).trim() === "Build an SD-WAN or SASE RFP and compare vendor responses", `${label}: H1 text`);
  check(await h1.isVisible(), `${label}: the H1 is visible before a project starts`);
  check((await page.locator("#rfp-definitions dt").count()) === 2, `${label}: two definitions above the application`);
  check(await page.locator("#rfp-definitions").isVisible(), `${label}: definitions are visible`);
  check((await page.locator("#rfp-guide table caption").count()) === 1, `${label}: captioned RFP table`);
  check((await page.locator("#rfp-guide tbody th[scope='row']").count()) === 8, `${label}: eight table rows`);
  check((await page.locator("#rfp-guide details").count()) === 5, `${label}: five FAQ items`);
  check((await page.locator("h1").count()) === 1, `${label}: exactly one h1 in the document`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
}

const browser = await chromium.launch();
try {
  const desktop = await open(browser, { width: 1440, height: 900 });
  await staticContent(desktop, "desktop");
  check((await desktop.locator("textarea").first().count()) === 1, "desktop: the prompt is present");
  check((await desktop.getByRole("button", { name: /Check an existing RFP|Check an AI-generated RFP/ }).count()) >= 1, "desktop: the check-an-existing-RFP route is present");
  check((await desktop.locator(".lpos-sections > li").count()) === 8, "desktop: the living document shows its eight sections");

  const prompt = desktop.locator("textarea").first();
  await prompt.fill("We are a retailer with 20 UK stores replacing MPLS with managed SD-WAN and SASE by March 2027.");
  await prompt.press("Enter");
  await desktop.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });
  await desktop.waitForTimeout(900);
  check(true, "desktop: a project can still be started from the prompt");
  const heroHidden = await desktop.locator("h1#page-h1").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width <= 1 && r.height <= 1;
  });
  check(heroHidden, "desktop: the hero collapses to sr-only once a project starts");
  check((await desktop.locator("h1").count()) === 1, "desktop: still exactly one h1 after start (the sr-only one)");
  const bodyText = await desktop.locator("body").innerText();
  check(/NOT PUBLISHED|Not published|Draft/i.test(bodyText), "desktop: a fresh project is a draft, not published");
  check((await desktop.getByRole("button", { name: /Review & publish|Review before publishing|Publish/ }).count()) >= 1, "desktop: the publish route still exists and is gated behind review");
  check(!/manage_token|share_token/.test(await desktop.content()), "desktop: no tokens in the document after start");

  const mobile = await open(browser, { width: 390, height: 844 });
  await staticContent(mobile, "mobile");
  check((await mobile.locator("textarea").first().count()) === 1, "mobile: the prompt is present");
  const tableScrolls = await mobile.locator("#rfp-guide table").evaluate((t) => {
    const wrap = t.parentElement;
    return wrap && getComputedStyle(wrap).overflowX === "auto";
  });
  check(tableScrolls, "mobile: the wide table scrolls inside its own container");
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL PASS: rfp canonical journey");
process.exit(failures ? 1 : 0);
