import { chromium } from "playwright";

const baseUrl = process.env.RFP_TEST_URL || "http://localhost:3201/sase/home";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(15_000);
const results = [];
const badResponses = [];
const publishRequests = [];
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
  for (let attempt = 0; attempt < 14 && await publish.isDisabled(); attempt += 1) {
    const choices = page.locator(".nf-guided-choices");
    const checkbox = choices.locator('button[role="checkbox"]').first();
    const radio = choices.locator('button[role="radio"]').first();
    if (await checkbox.count()) {
      await checkbox.click();
      await page.locator(".nf-guided-continue").click();
    } else if (await radio.count()) {
      await radio.click();
    } else {
      break;
    }
    await page.waitForTimeout(700);
  }
  return !(await publish.isDisabled());
}

const publishPattern = "**/sase/api/rfp/step9-rfp/publish";

try {
  await page.route("**/sase/api/rfp", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "step9-rfp", manage_token: "step9-manage", envelope_revision: 1 }),
    });
  });
  await page.route("**/sase/api/rfp/step9-rfp/evaluation**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ evaluations: [] }),
  }));

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
  await send("[HARRY TEST] Healthcare organisation with 35 UK sites and 900 users. We need a fully managed SASE and SD-WAN service covering Azure, Microsoft 365, MPLS migration, dual diverse circuits, automatic failover, 99.99% availability, ZTNA, CASB, SWG, DLP, FWaaS, UK GDPR, ISO 27001, a 24/7 NOC and SOC, phased implementation within six months, training, handover and three-year pricing.");
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });
  check("Step 9 baseline reaches publication", await completeBaseline());
  await page.getByRole("button", { name: "Publish opportunity" }).click();
  await page.locator(".nf-2030-publish").waitFor();

  const publishButton = page.getByRole("button", { name: "Generate and publish" });
  check("F05 publishing is disabled before acknowledgements", await publishButton.isDisabled());
  const consents = page.locator('[data-publish="1"] input[type="checkbox"]');
  check("F04 both required acknowledgements are visible", await consents.count() === 2, String(await consents.count()));
  for (let index = 0; index < await consents.count(); index += 1) await consents.nth(index).check();
  check("F05 acknowledgements enable publication", !(await publishButton.isDisabled()));

  await page.route(publishPattern, async (route) => {
    publishRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "The opportunity could not be listed. Nothing was sent; try again." }),
    });
  });
  await publishButton.click();
  const error = page.locator('p[role="alert"]');
  await error.waitFor();
  check("DEF-52 a failed publish has an explicit error state", /Publication failed:.*Nothing was sent/i.test(await error.innerText()), await error.innerText());

  await page.unroute(publishPattern);
  await page.route(publishPattern, async (route) => {
    publishRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: "published",
        market_unlocked: true,
        board: { opportunity_id: "step9-opportunity" },
        invited: [{ slug: "supplier-one", name: "Supplier One", supplier_url: "/supplier-one" }],
        matched_vendors: [{ slug: "supplier-one", name: "Supplier One" }],
        market_report: { matched: { total_evaluated_market: 30 } },
      }),
    });
  });
  await publishButton.click();
  const success = page.locator(".nf-publish-success");
  await success.waitFor();
  check("DEF-52 a successful publish has an unmistakable confirmation", /Publication complete|Published successfully/i.test(await success.innerText()));
  check("DEF-52 confirmation links to the published notice", await success.locator('a[href="/sase/opportunities/step9-opportunity"]').count() >= 1);
  check("DEF-52 the publish request lists on the board", publishRequests.length === 2 && publishRequests.every((request) => request?.list_on_board === true), JSON.stringify(publishRequests));

  const relevantFailures = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js") && !entry.includes("/step9-rfp/publish"));
  check("Step 9 has no unexpected failed browser requests", relevantFailures.length === 0, relevantFailures.join(" | "));
} finally {
  await browser.close();
}

for (const [label, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
