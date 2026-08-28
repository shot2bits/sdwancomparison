import { chromium } from "playwright";

const baseUrl = process.env.RFP_TEST_URL || "http://localhost:3201/sase/home";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(12_000);
const results = [];
const badResponses = [];
const suggestionSections = [];
const check = (label, value, detail = "") => results.push([label, Boolean(value), detail]);
page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
await page.route("**/api/workspace/suggest-questions", async (route) => {
  const payload = route.request().postDataJSON();
  suggestionSections.push(payload.section);
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ questions: [`How will you evidence delivery for ${payload.section}?`] }),
  });
});

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
  await page.getByRole("button", { name: /Detailed RFP/ }).click();
  await send("Healthcare organisation with 35 UK and EU sites, 900 users, Azure, MPLS, SD-WAN, SSE and a fully managed 24/7 service.");
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });

  const rows = page.locator(".lpos-sections > li > button");
  check("DEF-25 detailed mode exposes all eight RFP sections", await rows.count() === 8, String(await rows.count()));
  let sectionsWithQuestions = 0;
  for (let index = 0; index < await rows.count(); index += 1) {
    await rows.nth(index).click();
    await page.waitForTimeout(100);
    if (await page.locator(".nf-guided-register li").count() > 0) sectionsWithQuestions += 1;
  }
  check("DEF-25 every detailed section shows its question register", sectionsWithQuestions === 8, `${sectionsWithQuestions}/8`);

  await rows.nth(0).click();
  await page.getByRole("button", { name: /Recommended questions/ }).first().click();
  await page.getByText("How will you evidence delivery for Organisation and scale?").waitFor();
  await rows.nth(2).click();
  await page.getByRole("button", { name: /Recommended questions/ }).first().click();
  await page.getByText("How will you evidence delivery for Current estate?").waitFor();
  check("DEF-26 recommendations are requested with the active section", suggestionSections.includes("Organisation and scale") && suggestionSections.includes("Current estate"), suggestionSections.join(" | "));

  const manager = page.locator(".nf-guided-add-question");
  const managerStyle = await manager.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
  check("DEF-27 recommendation panel uses the neutral light design", managerStyle.background !== "rgb(27, 30, 35)" && managerStyle.color !== "rgb(88, 201, 204)", JSON.stringify(managerStyle));
  check("DEF-28 recommendation panel contains one concise approval explanation", (await manager.getByText(/Nothing is added without your approval/).count()) === 1 && (await manager.getByText(/Suggestions are never added/).count()) === 0);

  await page.getByText("How will you evidence delivery for Current estate?").click();
  const customRow = page.locator('.nf-guided-register li[data-status="custom"]').last();
  check("DEF-29 added question uses the accessible confirmation treatment", await customRow.count() === 1);

  const requiredInput = page.locator(".nf-guided-inline-answer input").first();
  if (await requiredInput.count()) {
    const question = await requiredInput.getAttribute("aria-label");
    await requiredInput.fill("Nothing must go down during migration.");
    await requiredInput.press("Enter");
    await page.locator(".nf-guided-custom-receipt").waitFor({ timeout: 25_000 }).catch(() => undefined);
    check("DEF-30 an inline required answer is accepted and recorded", await page.locator(".nf-guided-custom-receipt").count() === 1, question ?? "");
  } else {
    check("DEF-30 an inline required answer is accepted and recorded", false, "No required question input was rendered");
  }

  check("DEF-31 detailed mode provides Continue to next requirement", await page.getByRole("button", { name: /Continue to next requirement/ }).count() === 1);
  check("DEF-32 healthcare context is retained for tailored recommendations", /healthcare/i.test(await page.locator("body").innerText()));

  const relevantFailures = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js"));
  check("Step 5 has no relevant failed browser requests", relevantFailures.length === 0, relevantFailures.join(" | "));
} finally {
  await browser.close();
}

for (const [label, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
