#!/usr/bin/env node
import { chromium } from "playwright";

const BASE_URL = process.env.RFP_UI_BASE_URL ?? "http://localhost:3000/sase/home?test=1";

function check(condition, label, detail = "") {
  if (!condition) throw new Error(`FAIL  ${label}${detail ? ` -> ${detail}` : ""}`);
  console.log(`PASS  ${label}${detail ? ` -> ${detail}` : ""}`);
}

async function startProject(page, text) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  const prompt = page.locator("textarea").first();
  await prompt.fill(text);
  await prompt.press("Enter");
  await page.locator('[data-workspace-started="true"]').waitFor({ timeout: 25_000 });
  await page.waitForTimeout(900);
}

const browser = await chromium.launch();
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto(BASE_URL, { waitUntil: "networkidle" });
  const blankSection = await desktop.locator(".nf-section-build-panel").innerText();
  check(blankSection.includes("Organisation and scale"), "a blank RFP opens on the active first section");
  check(["Which sector are you in?", "Confirm site count", "Confirm regions", "Confirm user count"].every((label) => blankSection.includes(label)), "the centre lists the same four questions counted in the section rail");
  check(!blankSection.includes("Sourcing procurement"), "the generic sourcing-document shell no longer competes with the active section");
  check(blankSection.includes("Live section build") && blankSection.includes("Waiting for your first answer"), "the centre shows where answers will populate live");
  check((await desktop.locator(".nf-2030-prompt-question").innerText()).includes("Which sector are you in?"), "the prompt calls out the next required question");
  const siteCountQuestion = desktop.getByRole("button", { name: "Answer question: Confirm site count" });
  await siteCountQuestion.scrollIntoViewIfNeeded();
  const beforeQuestionSelection = await desktop.evaluate(() => window.scrollY);
  await siteCountQuestion.click();
  check((await desktop.locator(".nf-2030-prompt-question").innerText()).includes("Confirm site count"), "selecting a section question changes the prompt callout");
  check((await desktop.locator(".nf-section-selected-question").innerText()).includes("Confirm site count"), "the selected question is acknowledged inside the section");
  check(await desktop.evaluate((before) => window.scrollY === before, beforeQuestionSelection), "selecting a question does not jump away from the RFP section");
  check(await desktop.getByRole("button", { name: "Selected question: Confirm site count" }).getAttribute("aria-pressed") === "true", "the chosen question has a visible selected state");
  await desktop.getByRole("button", { name: "Answer selected question in the AI prompt" }).click();
  check(await desktop.locator("textarea").first().evaluate((element) => element === document.activeElement), "moving to the AI prompt requires an explicit answer action");
  await desktop.getByRole("button", { name: /Solution scope/ }).click();
  check((await desktop.locator(".nf-section-build-panel").innerText()).includes("Which technology scope do you need?"), "choosing a section in the rail replaces the centre with that section's questions");
  await desktop.getByRole("button", { name: /Organisation and scale/ }).click();
  await startProject(desktop, "20 UK sites for a retail business with 50 remote users, HQ in Norwich requires dual RA02 failover. We need full SASE and want to migrate by December 2026.");
  const initialText = await desktop.locator("body").innerText();
  check(/Resilience and availability\nReady · \d+ of \d+ answered/.test(initialText), "stated failover completes the resilience section");
  check(initialText.includes("RFP Builder · Retail"), "the workspace identifies itself as the RFP Builder");

  for (let step = 0; step < 10; step += 1) {
    if (await desktop.getByRole("button", { name: /Review your RFP/i }).count()) break;
    const choices = desktop.getByRole("radio");
    check((await choices.count()) > 0, "each unfinished section exposes a direct answer");
    const before = await choices.first().evaluate((element) => element.getBoundingClientRect().top);
    await choices.first().click();
    const after = await choices.first().evaluate((element) => element.getBoundingClientRect().top);
    check(Math.abs(after - before) < 1, "selecting an option does not move the target under the pointer", `shift=${after - before}`);
    await desktop.getByRole("button", { name: "Continue", exact: true }).click();
    await desktop.waitForTimeout(850);
  }
  const completedText = await desktop.locator("body").innerText();
  check(completedText.includes("7 of 7 sections ready"), "the quick RFP reaches a finite visible completion state");
  check((await desktop.getByRole("button", { name: /Review your RFP/i }).count()) === 1, "completion exposes one clear review action");
  check(await desktop.evaluate(() => document.documentElement.scrollWidth === window.innerWidth), "desktop has no horizontal overflow");
  await desktop.getByRole("button", { name: /Expand to full RFP/i }).click();
  await desktop.waitForTimeout(250);
  const fullText = await desktop.locator("body").innerText();
  check(/RFP sections\n\d+ of 9 sections ready/.test(fullText), "full mode expands the same document to nine required sections");
  check(/Commercial and contractual\n(?:Not started|In progress) · 0 of \d+ answered/.test(fullText), "full mode makes commercial questions visibly required");
  check(!fullText.includes("7 of 7 sections ready"), "expanding to a full RFP removes the quick-mode ready state");
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await startProject(mobile, "We are a retail business with 20 UK sites and need full SASE by December 2026.");
  await mobile.getByRole("button", { name: /Describe it in your own words/i }).click();
  const mobilePrompt = mobile.locator("textarea").first();
  check(await mobilePrompt.evaluate((element) => element === document.activeElement), "describe-in-your-own-words focuses the persistent prompt");
  await mobilePrompt.fill("50 remote users");
  await mobilePrompt.press("Enter");
  await mobile.waitForTimeout(1400);
  const mobileText = await mobile.locator("body").innerText();
  check(mobileText.includes("Answer to"), "a natural-language answer produces a visible saved-answer receipt");
  const builderTop = await mobile.locator(".nf-guided-question").evaluate((element) => element.getBoundingClientRect().top);
  check(builderTop < 180, "mobile advances to the new active question instead of leaving the user at the old scroll position", `top=${Math.round(builderTop)}`);
  check(await mobile.evaluate(() => document.documentElement.scrollWidth === window.innerWidth), "mobile has no horizontal overflow");
  await mobile.close();
} finally {
  await browser.close();
}

console.log("\nALL PASS");
