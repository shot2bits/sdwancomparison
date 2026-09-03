#!/usr/bin/env node
import { chromium } from "playwright";

const BASE_URL = process.env.RFP_UI_BASE_URL ?? "http://localhost:3100/sase/home/?test=1";
const VIEWPORTS = [390, 768, 819, 821, 1024, 1280, 1440, 1728];
let checks = 0;
let failures = 0;

export function check(condition, label, detail = "") {
  checks += 1;
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` -> ${detail}` : ""}`);
}

const browser = await chromium.launch();
try {
  for (const width of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    check(await page.locator(".nf-2030-workspace").count() === 1, `${width}px: RFP workspace renders`);
    await page.close();
  }

  for (const [width, submission] of [[1440, "enter"], [390, "button"]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".lpos-sections > li").first().waitFor();
    check(await page.locator(".lpos-sections > li").count() === 8, `${width}px: eight document sections before guided answers`);
    await page.getByRole("radio", { name: "Healthcare & pharma", exact: true }).click();
    await page.waitForTimeout(800);
    await page.getByRole("radio", { name: "Up to 50", exact: true }).click();
    await page.waitForTimeout(800);
    const before = await page.locator(".nf-guided-focus h2").innerText();
    await page.getByRole("button", { name: /Describe it in your own words/ }).click();
    const answer = page.getByLabel("Answer: Where are the sites?");
    await answer.fill("United Kingdom and Ireland");
    if (submission === "enter") await answer.press("Enter");
    else await answer.locator("xpath=..").getByRole("button", { name: "Save answer" }).click();
    await page.waitForFunction((oldQuestion) => document.querySelector(".nf-guided-focus h2")?.textContent?.trim() !== oldQuestion, before);
    check((await page.locator(".nf-guided-focus h2").innerText()) !== before, `${width}px: free-text answer advances with ${submission}`);
    check(await page.locator(".lpos-sections > li").count() === 8, `${width}px: guided answer preserves eight document sections`);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
