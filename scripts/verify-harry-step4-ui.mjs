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
  await page.waitForTimeout(1200);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });

  await send("Healthcare organisation, 12 UK sites, 600 users, buying managed SASE and SD-WAN.");
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });

  const lifecyclePublish = page.locator('button[aria-label="Publish opportunity"]');
  check("DEF-22 partial baseline keeps the publish lifecycle station unreachable", await lifecyclePublish.isDisabled());

  const nextAction = page.getByRole("button", { name: /Continue to next requirement/ });
  check("DEF-22 partial baseline offers the next requirement instead of Review & publish", await nextAction.isVisible());

  const bodyText = await page.locator("body").innerText();
  check("DEF-24 the incomplete journey does not claim it is ready to publish", !/Almost ready to publish|Publishable now/i.test(bodyText));

  const relevantFailures = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js"));
  check("Step 4 has no relevant failed browser requests", relevantFailures.length === 0, relevantFailures.join(" | "));
} finally {
  await browser.close();
}

for (const [label, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
