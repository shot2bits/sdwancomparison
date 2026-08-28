import { chromium } from "playwright";

const baseUrl = process.env.RFP_TEST_URL || "http://localhost:3201/sase/home";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
const errors = [];
const badResponses = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
const check = (label, value) => results.push([label, Boolean(value)]);

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });

  check("DEF-12 essential progress is persistent and visible", await page.locator(".nf-essential-progress").isVisible());
  check("DEF-09 short mode states its essential-only completion contract", (await page.locator(".lpos-depth-contract").innerText()).includes("Optional questions are not required"));
  check("DEF-09 short mode does not duplicate detailed recommendation controls", await page.getByRole("button", { name: "Build a more detailed RFP" }).count() === 1 && await page.getByRole("button", { name: "Add recommended question" }).count() === 0);

  await page.getByRole("button", { name: /Detailed RFP/ }).first().click();
  const detailedText = await page.locator(".lpos-depth-contract").innerText();
  check("DEF-09 detailed mode states a five-question section target", detailedText.includes("5 populated questions"));
  check("DEF-09 detailed mode exposes recommendation controls", await page.getByRole("button", { name: "Add recommended question" }).count() === 1);
  check("DEF-09 detailed depth is reported independently", (await page.locator(".lpos-depth-recommendations").innerText()).includes("more populated question"));

  await page.getByRole("button", { name: /Short RFP/ }).first().click();
  const prompt = page.locator("textarea").first();
  await prompt.fill("Healthcare organisation, 12 UK sites, 600 users, buying fully managed SASE and SD-WAN.");
  await prompt.press("Enter");
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  check("DEF-16 captured managed service is not re-asked as self-managed", !/Who will operate[\s\S]{0,500}Self-managed/i.test(body));
  /* These questions are sequential, so they are verified at the governed
     data/control layer by validate-section-question-register.ts rather
     than assuming all three must be visible on the first screen. */
  const relevantFailures = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js"));
  check("Step 2 produces no relevant browser request errors", relevantFailures.length === 0);
} finally {
  await browser.close();
}

for (const [label, ok] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (errors.length) console.log(`Console diagnostics: ${errors.join(" | ")}`);
if (badResponses.length) console.log(`Failed responses: ${badResponses.join(" | ")}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
