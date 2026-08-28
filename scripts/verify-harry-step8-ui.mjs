import { chromium } from "playwright";

const baseUrl = process.env.RFP_TEST_URL || "http://localhost:3201/sase/home";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(15_000);
const results = [];
const badResponses = [];
const check = (label, value, detail = "") => results.push([label, Boolean(value), detail]);
page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

async function send(text) {
  const prompt = page.locator("textarea").first();
  await prompt.fill(text);
  await prompt.press("Enter");
  await page.waitForTimeout(1_200);
}

async function completeBaseline() {
  const publish = page.getByRole("button", { name: "Publish opportunity" });
  let suppliedMigrationFallback = false;
  for (let attempt = 0; attempt < 14 && await publish.isDisabled(); attempt += 1) {
    const choices = page.locator(".nf-guided-choices");
    if (await choices.count()) {
      const checkbox = choices.locator('button[role="checkbox"]').first();
      if (await checkbox.count()) {
        await checkbox.click();
        await page.locator(".nf-guided-continue").click();
      } else {
        await choices.locator('button[role="radio"]').first().click();
      }
      await page.waitForTimeout(700);
      continue;
    }
    const required = page.locator(".nf-guided-inline-answer input").first();
    if (await required.count()) {
      await required.fill("Required for this procurement.");
      await required.press("Enter");
      await page.waitForTimeout(900);
      continue;
    }
    if (!suppliedMigrationFallback) {
      suppliedMigrationFallback = true;
      await send("Migration and implementation must include discovery, detailed design, a pilot, phased site migration, rollback planning, testing, training, documentation and operational handover, completed within six months.");
      await page.waitForTimeout(1_200);
      continue;
    }
    break;
  }
  return !(await publish.isDisabled());
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
  await send("[HARRY TEST] Healthcare organisation with 35 UK sites and 900 users. We need a fully managed SASE and SD-WAN service covering Azure, Microsoft 365, MPLS migration, dual diverse circuits, automatic failover, 99.99% availability, ZTNA, CASB, SWG, DLP, FWaaS, UK GDPR, ISO 27001, a 24/7 NOC and SOC, phased implementation within six months, training, handover and three-year pricing.");
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });
  check("Step 8 baseline can reach Review and Publish", await completeBaseline());
  await page.getByRole("button", { name: "Publish opportunity" }).click();
  const review = page.locator(".nf-2030-publish");
  await review.waitFor();

  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  check("DEF-48 Review and Publish stays within the viewport", dimensions.body <= dimensions.viewport, JSON.stringify(dimensions));

  const style = await review.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { background: computed.backgroundColor, color: computed.color };
  });
  check("DEF-49 Review and Publish uses the shared light workspace styling", style.background !== "rgb(11, 13, 16)" && style.color !== "rgb(241, 241, 239)", JSON.stringify(style));

  const text = await review.innerText();
  check("DEF-50 publication behaviour is stated plainly", /Publishing lists your project anonymously on the Netify opportunity board/i.test(text) && /Only vetted vendors and service providers can view the opportunity in full or respond/i.test(text));

  const preview = page.locator(".nf-publish-document-preview");
  check("DEF-51 a compiled RFP preview is present", await preview.count() === 1);
  const previewText = await preview.innerText();
  check("DEF-51 preview contains the buyer requirement", /Healthcare|35 sites|SASE|SD-WAN/i.test(previewText), previewText.slice(0, 240));
  check("DEF-51 preview offers a route back to editing", await preview.getByRole("button", { name: "Edit requirements" }).count() === 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const mobileDimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  check("DEF-48 Review and Publish remains readable on mobile", mobileDimensions.body <= mobileDimensions.viewport, JSON.stringify(mobileDimensions));

  const relevantFailures = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js"));
  check("Step 8 has no relevant failed browser requests", relevantFailures.length === 0, relevantFailures.join(" | "));
} finally {
  await browser.close();
}

for (const [label, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
