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
    check(await page.locator(".lpos-header").count() === 1, `${width}px: exactly one application header renders`);
    check(await page.locator("h1").count() === 1, `${width}px: exactly one H1 remains after hydration`);
    const layout = await page.evaluate(() => {
      const rail = document.querySelector(".lpos-product-rail");
      const targets = [document.querySelector("#page-h1"), document.querySelector("#rfp-definitions"), document.querySelector(".journey-mode-selector")].filter(Boolean);
      const railBox = rail?.getBoundingClientRect();
      const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        position: rail ? getComputedStyle(rail).position : "missing",
        overlap: Boolean(railBox && targets.some((target) => intersects(railBox, target.getBoundingClientRect()))),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    check(layout.position === "sticky", `${width}px: navigation rail is sticky inside the application`, JSON.stringify(layout));
    check(!layout.overlap, `${width}px: navigation rail does not cover canonical or entrance content`);
    check(layout.overflow <= 1, `${width}px: application creates no viewport overflow`, JSON.stringify(layout));
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
    check(await page.locator(".journey-mode-selector").count() === 0, `${width}px: entrance cards unmount after the project starts`);
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

  const partial = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await partial.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await partial.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await partial.reload({ waitUntil: "domcontentloaded" });
  await partial.getByRole("radio", { name: "Healthcare & pharma", exact: true }).click();
  await partial.waitForTimeout(700);
  await partial.getByRole("button", { name: "Review", exact: true }).click();
  await partial.locator(".nf-publication-checklist").waitFor();
  const partialChecklist = await partial.locator(".nf-publication-checklist").innerText();
  check(!partialChecklist.includes("7 of 7 essential sections complete"), "review shows an incomplete publication checklist for a partial project");
  check(await partial.locator(".nf-publication-checklist input[type=checkbox]").count() === 0, "review does not present publication acknowledgements before the baseline is complete");
  check(await partial.locator(".nf-publication-checklist > button").isDisabled(), "review keeps the publication handoff disabled for a partial project");
  await partial.close();

  const complete = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await complete.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await complete.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await complete.reload({ waitUntil: "domcontentloaded" });
  const completePrompt = complete.locator("textarea").first();
  await completePrompt.fill("We are a healthcare organisation with 20 UK sites and 200 users across the United Kingdom and Ireland. We need fully managed SASE and SD-WAN to replace MPLS and legacy firewalls, with dual circuits, automatic failover and 99.99% availability. Security must include ZTNA, secure web gateway, CASB, DLP, Entra ID and MFA. We need a 24/7 managed NOC and SOC, incident escalation and service reviews. Migration must include a pilot, phased cutover, rollback, training and handover by December 2026.");
  await completePrompt.press("Enter");
  await complete.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });
  await complete.waitForTimeout(900);
  await complete.getByRole("button", { name: "Select all SASE controls", exact: true }).click();
  await complete.getByRole("button", { name: /Save 5 selections/ }).click();
  await complete.waitForTimeout(1100);
  await complete.getByRole("radio", { name: "Migration", exact: true }).click();
  await complete.waitForTimeout(1100);
  await complete.getByRole("button", { name: "Review", exact: true }).click();
  await complete.locator(".nf-publication-checklist").waitFor();
  const completeChecklist = await complete.locator(".nf-publication-checklist").innerText();
  check(completeChecklist.includes("7 of 7 essential sections complete"), "review shows the complete seven-section publication baseline", completeChecklist.replace(/\s+/g, " "));
  check(await complete.getByRole("button", { name: /Continue to publication|Complete \d+ more sections? to continue/ }).isEnabled(), "a complete project can continue to the separate publication step");
  const supplierProjection = complete.getByTestId("supplier-projection");
  check(await supplierProjection.count() === 1, "review exposes one scoped supplier-facing projection");
  check(await complete.locator(".lpos-header").count() === 1, "review keeps one application header after project start and navigation");
  check(await complete.locator("h1").count() === 1, "review keeps one H1 after project start and navigation");
  const supplierText = await supplierProjection.innerText();
  const forbiddenSupplierText = ["Procurement lead", "Private workspace", "Draft saved", "Document settings", "NOT PUBLISHED"];
  check(forbiddenSupplierText.every((text) => !supplierText.includes(text)), "supplier projection excludes buyer workspace chrome", supplierText.slice(0, 220).replace(/\s+/g, " "));
  check((await complete.locator("body").innerText()).includes("Review before publishing") && !supplierText.includes("Review before publishing"), "buyer review controls remain outside the supplier projection boundary");
  await complete.close();
} finally {
  await browser.close();
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
