#!/usr/bin/env node
import { chromium } from "playwright";

const BASE_URL = process.env.RFP_UI_BASE_URL ?? "http://localhost:3100/sase/home/?test=1";
const VIEWPORTS = [390, 768, 819, 820, 821, 1024, 1280, 1440, 1728];
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
    check(await page.locator('[role="heading"][aria-level="1"]').count() === 0, `${width}px: no synthetic level-one heading duplicates the canonical H1`);
    check(await page.getByRole("img", { name: "Netify Living Procurement OS", exact: true }).count() === 1, `${width}px: product brand has one accessible name`);
    const unnamedButtons = await page.locator("button").evaluateAll((elements) => elements.filter((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const name = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || "";
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0 && !name.trim();
    }).length);
    check(unnamedButtons === 0, `${width}px: every visible button has an accessible name`, `${unnamedButtons} unnamed`);
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
    if (width === 1440) {
      await page.getByRole("button", { name: /Detailed RFP/ }).click();
      check(await page.getByRole("button", { name: /Recommended questions/ }).count() === 1, "detailed mode keeps recommended questions available in the active section");
      const lockedLabels = ["Suppliers", "Responses", "Evidence", "Reports", "Exports"];
      for (const label of lockedLabels) {
        const locked = page.getByRole("button", { name: new RegExp(`^${label}, locked\\.`) });
        check(await locked.isDisabled() && (await locked.getAttribute("aria-disabled")) === "true", `${label} is disabled and exposes aria-disabled before publication`);
      }
      await page.getByRole("button", { name: /Short RFP/ }).click();
    }
    if (width === 390 || width === 820) {
      const mobileRail = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll(".lpos-product-rail button")].filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        });
        const lockedIcon = document.querySelector('.lpos-product-rail button[data-locked="true"] .lpos-rail-icon');
        const badge = lockedIcon?.querySelector("i");
        const iconBox = lockedIcon?.getBoundingClientRect();
        const badgeBox = badge?.getBoundingClientRect();
        return {
          targets: buttons.map((button) => {
            const box = button.getBoundingClientRect();
            return { width: box.width, height: box.height };
          }),
          badgeContained: Boolean(iconBox && badgeBox && badgeBox.left >= iconBox.left && badgeBox.right <= iconBox.right && badgeBox.top >= iconBox.top && badgeBox.bottom <= iconBox.bottom),
        };
      });
      check(mobileRail.targets.every((target) => target.width >= 44 && target.height >= 44), `${width}px: rail touch targets are at least 44 by 44 pixels`, JSON.stringify(mobileRail.targets));
      check(mobileRail.badgeContained, `${width}px: lock badge remains inside its icon box`);
      const suppliers = page.locator('.lpos-product-rail button[data-disabled-reason]').filter({ has: page.locator('.lpos-rail-label', { hasText: "Suppliers" }) });
      check(await suppliers.isDisabled(), `${width}px: locked supplier navigation is natively disabled`);
      check((await suppliers.getAttribute("data-disabled-reason")) === "Complete the essential baseline before reviewing publication and supplier matching.", `${width}px: locked supplier navigation exposes the full reason`);
      const architecture = page.getByRole("region", { name: "Solution architecture. Scroll horizontally to see every element." }).first();
      await architecture.evaluate((element) => { element.scrollLeft = 0; });
      const architectureOverflows = await architecture.evaluate((element) => element.scrollWidth > element.clientWidth);
      await architecture.focus();
      await architecture.press("ArrowRight");
      await page.waitForTimeout(100);
      check(!architectureOverflows || (await architecture.evaluate((element) => element.scrollLeft)) > 0, `${width}px: architecture fits or keyboard users can pan it`, architectureOverflows ? "overflowing" : "fits without horizontal pan");
    }
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
  await completePrompt.fill("We are Example Buyer 7391, a healthcare organisation with 20 UK sites and 200 users across the United Kingdom and Ireland. We need fully managed SASE and SD-WAN to replace MPLS and legacy firewalls, with dual circuits, automatic failover and 99.99% availability. Security must include ZTNA, secure web gateway, CASB, DLP, Entra ID and MFA. We need a 24/7 managed NOC and SOC, incident escalation and service reviews. Migration must include a pilot, phased cutover, rollback, training and handover by December 2026.");
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
  check(await complete.locator('[role="heading"][aria-level="1"]').count() === 0, "review has no synthetic level-one heading after project start and navigation");
  const supplierText = await supplierProjection.innerText();
  const forbiddenSupplierText = ["Example Buyer 7391", "Procurement lead", "Private workspace", "Draft saved", "Document settings", "NOT PUBLISHED"];
  check(forbiddenSupplierText.every((text) => !supplierText.includes(text)), "supplier projection excludes buyer identity and workspace chrome", supplierText.slice(0, 220).replace(/\s+/g, " "));
  check((await complete.locator("body").innerText()).includes("Review before publishing") && !supplierText.includes("Review before publishing"), "buyer review controls remain outside the supplier projection boundary");
  await complete.close();
} finally {
  await browser.close();
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
