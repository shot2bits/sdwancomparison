import { chromium } from "playwright";

const baseUrl = process.env.RFP_TEST_URL || "http://localhost:3201/sase/home";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(12_000);
const results = [];
const badResponses = [];
const check = (label, value, detail = "") => results.push([label, Boolean(value), detail]);
page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

async function send(target, text) {
  const prompt = target.locator("textarea").first();
  await prompt.fill(text);
  await prompt.press("Enter");
  await target.waitForTimeout(1200);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });

  const initial = "Healthcare organisation, 15 UK sites, 600 users, buying a fully managed SASE service.";
  await send(page, initial);
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });
  await page.getByText("Draft saved", { exact: true }).waitFor({ timeout: 10_000 });
  check("DEF-44/46 automatic save is visibly confirmed", await page.getByText("Draft saved", { exact: true }).count() === 1);

  const savedBefore = await page.evaluate(() => {
    const pointer = localStorage.getItem("netify_living_rfp_active_draft_v1");
    return { pointer, raw: pointer ? localStorage.getItem(`netify_living_rfp_draft_v1_${pointer}`) : null };
  });
  check("DEF-44 a durable on-device draft is written", Boolean(savedBefore.pointer && savedBefore.raw));
  check("DEF-47 the exact buyer wording is retained in the draft", Boolean(savedBefore.raw?.includes(initial)), savedBefore.pointer ?? "");

  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 15_000 });
  check("DEF-43 refresh restores the captured site count", /Sites\s*15/i.test(await page.locator(".lpos-captured").innerText()));

  const correction = "Actually, we have 18 sites, not 15.";
  await send(page, correction);
  await page.waitForFunction(() => /Sites\s*18/i.test(document.querySelector(".lpos-captured")?.textContent ?? ""), null, { timeout: 25_000 });
  await page.getByText("Draft saved", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 15_000 });
  const capturedAfter = await page.locator(".lpos-captured").innerText();
  check("DEF-45 corrected data survives another reopen", /Sites\s*18/i.test(capturedAfter) && !/Sites\s*15/i.test(capturedAfter), capturedAfter);

  const reopened = await context.newPage();
  reopened.setDefaultTimeout(12_000);
  await reopened.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await reopened.locator('[data-workspace-started="true"]').waitFor({ timeout: 15_000 });
  check("DEF-44 closing the tab and reopening in the same browser profile restores the draft", /Sites\s*18/i.test(await reopened.locator(".lpos-captured").innerText()));
  await reopened.close();

  const relevantFailures = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js"));
  check("Step 7 has no relevant failed browser requests", relevantFailures.length === 0, relevantFailures.join(" | "));
} finally {
  await browser.close();
}

for (const [label, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
