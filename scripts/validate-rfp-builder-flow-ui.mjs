#!/usr/bin/env node
import { chromium } from "playwright";

const BASE_URL = process.env.RFP_UI_BASE_URL ?? "http://localhost:3000/sase/home?test=1";
function check(condition, label, detail = "") {
  if (!condition) throw new Error(`FAIL  ${label}${detail ? ` -> ${detail}` : ""}`);
  console.log(`PASS  ${label}${detail ? ` -> ${detail}` : ""}`);
}
async function reset(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.context().clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle" });
}
async function startProject(page, text) {
  const prompt = page.locator("textarea").first();
  await prompt.fill(text);
  await prompt.press("Enter");
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });
  await page.waitForTimeout(900);
}

const browser = await chromium.launch();
try {
  const desktop = await browser.newPage({ viewport: { width: 1728, height: 1180 } });
  await reset(desktop);
  check(await desktop.locator(".lpos-header").count() === 1, "the Living Procurement OS header is present");
  check(await desktop.locator("body > header").evaluate((el) => getComputedStyle(el).display) === "none", "the marketing header is suppressed inside the procurement OS");
  check(await desktop.locator(".lpos-product-rail").count() === 1, "the dark product rail is present");
  check(await desktop.locator(".lpos-builder > .nf-guided-main").count() === 1 && await desktop.locator(".lpos-builder > .nf-guided-document").count() === 1, "the workspace is split into guided conversation and living document panes");
  check(await desktop.locator(".lpos-persistent-prompt").count() === 1, "the guided pane contains one prominent persistent AI prompt");
  const desktopPrompt = await desktop.locator(".lpos-persistent-prompt").evaluate((element) => {
    const box = element.getBoundingClientRect();
    const captured = document.querySelector(".lpos-you-said")?.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, beforeCaptured: Boolean(captured && box.bottom <= captured.top), position: getComputedStyle(element).position };
  });
  check(desktopPrompt.top < 320 && desktopPrompt.beforeCaptured, "the AI prompt appears near the top before captured context", JSON.stringify(desktopPrompt));
  check(desktopPrompt.position === "sticky", "the desktop AI prompt remains available while its guided pane scrolls");
  check(await desktop.locator(".lpos-sections > li").count() === 8, "the living document exposes the approved eight-section outline");
  check(await desktop.getByRole("button", { name: /Recommended questions/ }).count() === 1, "recommended questions are available in the active section");
  check(await desktop.getByRole("button", { name: /Bespoke question/ }).count() === 1, "bespoke questions are available in the active section");
  check((await desktop.locator(".lpos-unlock").innerText()).includes("Almost ready to publish"), "publishing is visibly gated before the essential baseline exists");
  check(await desktop.evaluate(() => document.documentElement.scrollWidth === innerWidth), "desktop has no horizontal overflow");

  await startProject(desktop, "We are a healthcare organisation with 20 UK sites and 200 users. We need SASE and SD-WAN by December 2026.");
  const startedText = await desktop.locator("body").innerText();
  check(startedText.includes("Healthcare") && startedText.includes("20"), "guided input updates the living document through the existing question bank");
  check(await desktop.getByRole("button", { name: /Review & publish/ }).count() === 1, "the essential baseline unlocks review and publish");
  await desktop.getByRole("button", { name: /Bespoke question/ }).click();
  const bespoke = desktop.locator("#bespoke-supplier-question");
  await bespoke.fill("Describe your service credit approval process.");
  await desktop.locator(".nf-guided-add-question").getByRole("button", { name: "Add", exact: true }).click();
  await desktop.locator(".nf-guided-register").getByText("Describe your service credit approval process?", { exact: true }).waitFor();
  const registerText = await desktop.locator(".nf-guided-register").innerText();
  check(registerText.includes("Describe your service credit approval process?"), "a bespoke question is added to the canonical section register");
  check(await desktop.locator('.nf-guided-register li[data-status="custom"]').count() >= 1, "buyer-added wording is distinguished from bank and recommended questions");
  await desktop.close();

  const tablet = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await reset(tablet);
  check(await tablet.locator(".lpos-builder").evaluate((el) => getComputedStyle(el).display) === "block", "narrow browser and tablet widths stack the panes instead of clipping them");
  check(await tablet.evaluate(() => document.documentElement.scrollWidth === innerWidth), "tablet has no horizontal overflow");
  check(await tablet.locator(".lpos-persistent-prompt").evaluate((el) => getComputedStyle(el).position) === "static", "tablet keeps the prominent prompt in flow so it cannot cover the stacked document");
  await tablet.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await reset(mobile);
  check(await mobile.locator(".lpos-builder").evaluate((el) => getComputedStyle(el).display) === "block", "mobile stacks the procurement panes");
  check(await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth), "mobile has no horizontal overflow");
  check(await mobile.locator("textarea").first().count() === 1, "mobile keeps the own-words answer path available");
  const mobilePrompt = await mobile.locator(".lpos-persistent-prompt").evaluate((element) => ({ top: element.getBoundingClientRect().top, position: getComputedStyle(element).position }));
  check(mobilePrompt.top < 360 && mobilePrompt.position === "static", "mobile keeps the prompt near the top without a covering sticky overlay", JSON.stringify(mobilePrompt));
  await mobile.close();
} finally {
  await browser.close();
}
console.log("\nALL PASS");
