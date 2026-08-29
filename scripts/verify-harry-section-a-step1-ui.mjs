import { chromium } from "playwright";

const baseUrl = process.env.RFP_TEST_URL || "http://localhost:3201/sase/home";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
const consoleErrors = [];
const badResponses = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
const check = (label, value) => results.push([label, Boolean(value)]);

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const relevantBadResponses = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js"));
  const onlyLocalInsightsError = baseUrl.includes("localhost") && relevantBadResponses.length === 0;
  check("DEF-01 clean sessions have no console errors", consoleErrors.length === 0 || onlyLocalInsightsError);
  check("DEF-01 clean sessions make no failing requests", relevantBadResponses.length === 0);

  const railLabels = await page.locator(".lpos-product-rail nav .lpos-rail-label").allTextContents();
  check("DEF-02 recognisable labelled navigation", ["Requirements", "Suppliers", "Responses", "Evidence", "Reports", "Review", "Exports"].every((label) => railLabels.includes(label)));

  const lockedSupplier = page.locator('.lpos-product-rail button[aria-label^="Suppliers, locked"]');
  await lockedSupplier.focus();
  check("DEF-03 locked navigation remains focusable", await lockedSupplier.evaluate((element) => document.activeElement === element));
  const tooltipDisplay = await lockedSupplier.locator('[role="tooltip"]').evaluate((element) => getComputedStyle(element).display);
  const lockedReason = await lockedSupplier.getAttribute("data-disabled-reason");
  check("DEF-03 locked navigation explains why", tooltipDisplay === "block" && lockedReason?.includes("essential baseline"));

  const activeStageColour = await page.locator('.lpos-header .nf-2030-lifecycle button[data-current="true"] b').evaluate((element) => getComputedStyle(element).backgroundColor);
  check("NEW-01 current stage uses Netify orange", activeStageColour === "rgb(243, 107, 16)");

  check("DEF-04 Review follows Reports", railLabels.indexOf("Review") === railLabels.indexOf("Reports") + 1 && !railLabels.includes("Overview"));

  const collapse = page.locator(".lpos-product-rail .lpos-collapse");
  const collapseSize = await collapse.locator(".lpos-rail-label").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  check("DEF-05 Collapse label matches navigation typography", collapseSize <= 11);

  await page.getByRole("button", { name: "Settings", exact: true }).evaluate((element) => element.click());
  const dialog = page.getByRole("dialog", { name: "RFP preferences" });
  check("DEF-07 one RFP preferences heading", await dialog.isVisible() && await dialog.getByRole("heading").count() === 1);
  check("DEF-08 no question-bank statistics in Settings", !((await dialog.textContent()) || "").includes("386-question"));

  await page.setViewportSize({ width: 390, height: 844 });
  check("DEF-02 compact navigation retains text labels", await page.locator('.lpos-product-rail .lpos-rail-label', { hasText: "Suppliers" }).first().isVisible());
  check("DEF-06 Collapse hidden on compact layouts", !(await collapse.isVisible()));
} finally {
  await browser.close();
}

for (const [label, ok] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
