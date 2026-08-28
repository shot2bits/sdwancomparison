import { chromium } from "playwright";

const baseUrl = process.env.RFP_TEST_URL || "http://localhost:3201/sase/home";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10_000);
const results = [];
const badResponses = [];
page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
const check = (label, value, detail = "") => results.push([label, Boolean(value), detail]);

async function send(text) {
  const prompt = page.locator("textarea").first();
  await prompt.fill(text);
  await prompt.press("Enter");
  await page.waitForTimeout(1000);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });

  await send("Healthcare organisation, 12 UK sites, 600 users, buying fully managed SASE across the UK.");
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });

  const ownWords = page.getByRole("button", { name: /Describe it in your own words/ }).first();
  await ownWords.click();
  const questionBefore = await page.locator(".nf-guided-focus h1").innerText();
  await send("We currently use MPLS with Azure and legacy firewalls.");
  check("DEF-18 own-words answer is visibly recorded", await page.locator(".nf-guided-custom-receipt").count() === 1, questionBefore);
  check("DEF-18 essential journey advances after own-words answer", (await page.locator(".nf-guided-focus h1").innerText()) !== questionBefore);

  await send("Actually, we have 15 sites, not 12.");
  const captured = await page.locator(".lpos-captured").innerText();
  check("DEF-19 a typed correction replaces the captured site count", captured.includes("15") && !captured.includes("12 sites"), captured);

  const siteRow = page.locator(".lpos-captured > div").filter({ hasText: /15.*site|site.*15/i }).first();
  check("DEF-20 corrected fact has a working Edit action", await siteRow.getByRole("button", { name: "Edit" }).count() === 1);
  if (await siteRow.getByRole("button", { name: "Edit" }).count()) {
    await siteRow.getByRole("button", { name: "Edit" }).click();
    const countControl = page.getByPlaceholder("Type the exact number");
    const countVisible = await countControl.isVisible().catch(() => false);
    check("DEF-20 Edit opens the bound site-count control", countVisible);
    if (countVisible) {
      await countControl.fill("18");
      await page.getByRole("button", { name: "Set", exact: true }).click();
      await page.waitForTimeout(500);
      check("DEF-20 editing persists the new value in captured requirements", (await page.locator(".lpos-captured").innerText()).includes("18"));
    }
  }

  const rows = page.locator(".lpos-sections > li > button");
  const sectionCount = await rows.count();
  let contentSections = 0;
  for (let index = 0; index < sectionCount; index += 1) {
    await rows.nth(index).click();
    await page.waitForTimeout(100);
    const items = page.locator(".nf-guided-register li");
    if (await items.count() > 0 && !((await items.first().innerText()).includes("No questions recorded"))) contentSections += 1;
  }
  check("DEF-21 all eight sections expose real question/content rows", sectionCount === 8 && contentSections === 8, `${contentSections}/${sectionCount}`);

  const relevantFailures = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js"));
  check("Step 3 has no relevant failed browser requests", relevantFailures.length === 0, relevantFailures.join(" | "));
} finally {
  await browser.close();
}

for (const [label, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
