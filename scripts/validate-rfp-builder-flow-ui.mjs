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
  check((await desktop.locator(".nf-section-build-panel").count()) === 0, "the introductory prompt does not stack the RFP Builder underneath it");
  await desktop.getByRole("button", { name: "Use recommended questions" }).click();
  check((await desktop.locator(".nf-2030-command-zone-empty").count()) === 0, "entering the question path removes the introductory landing content");
  const blankSection = await desktop.locator(".nf-section-build-panel").innerText();
  check(blankSection.includes("Organisation and scale"), "a blank RFP opens on the active first section");
  check(["Which sector are you in?", "Confirm site count", "Confirm regions", "Confirm user count"].every((label) => blankSection.includes(label)), "the centre lists the same four questions counted in the section rail");
  check(!blankSection.includes("Sourcing procurement"), "the generic sourcing-document shell no longer competes with the active section");
  check(blankSection.includes("Live section build") && blankSection.includes("Waiting for your first answer"), "the centre shows where answers will populate live");
  check((await desktop.locator(".nf-section-answer-panel").innerText()).includes("Which sector are you in?"), "the active question and answer field share one visible panel");
  check((await desktop.locator(".nf-section-answer-panel textarea").count()) === 1, "the AI answer field is physically inside the active question panel");
  check((await desktop.locator(".nf-section-answer-panel textarea").getAttribute("placeholder"))?.includes("Which sector are you in?"), "the answer field names the active question instead of showing a generic sourcing prompt");
  const siteCountQuestion = desktop.getByRole("button", { name: "Open question: Confirm site count" });
  await siteCountQuestion.scrollIntoViewIfNeeded();
  const beforeQuestionSelection = await desktop.evaluate(() => window.scrollY);
  await siteCountQuestion.click();
  check((await desktop.locator(".nf-section-answer-panel").innerText()).includes("Confirm site count"), "selecting a question updates the adjacent answer panel");
  check(await desktop.evaluate((before) => window.scrollY === before, beforeQuestionSelection), "selecting a question does not jump away from the RFP section");
  check(await desktop.getByRole("button", { name: "Current question: Confirm site count" }).getAttribute("aria-pressed") === "true", "the chosen question has a visible current state");
  await desktop.getByRole("button", { name: /Solution scope/ }).click();
  check((await desktop.locator(".nf-section-build-panel").innerText()).includes("Which technology scope do you need?"), "choosing a section in the rail replaces the centre with that section's questions");
  await desktop.getByRole("button", { name: /Organisation and scale/ }).click();

  await startProject(desktop, "We are a retail business with 20 sites and 50 users and need full SASE.");
  check((await desktop.getByRole("checkbox").count()) >= 8, "the geography question is explicitly multi-select");
  const ukRegion = desktop.getByRole("checkbox", { name: "United Kingdom" });
  const irelandRegion = desktop.getByRole("checkbox", { name: "Ireland" });
  const northAmericaRegion = desktop.getByRole("checkbox", { name: "North America" });
  await ukRegion.click();
  await irelandRegion.click();
  await northAmericaRegion.click();
  check(await ukRegion.getAttribute("aria-checked") === "true" && await irelandRegion.getAttribute("aria-checked") === "true" && await northAmericaRegion.getAttribute("aria-checked") === "true", "selecting another territory retains every previous geography");
  check((await desktop.getByRole("button", { name: "Save 3 regions" }).count()) === 1, "the buyer confirms the region set once");
  await desktop.getByRole("button", { name: "Save 3 regions" }).click();
  await desktop.waitForTimeout(850);
  const globalRequirementText = await desktop.locator("body").innerText();
  check(globalRequirementText.includes("UK/IE/US"), "all selected geographies land in the living RFP");
  check(/Organisation and scale\nReady · 4 of 4 answered/.test(globalRequirementText), "three regions count as one answered geography question, not three questions");

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
  await mobile.goto(BASE_URL, { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: "Use recommended questions" }).click();
  const mobileInlineAnswerBox = await mobile.locator(".nf-section-answer-panel textarea").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  });
  check(mobileInlineAnswerBox.bottom < 844, "mobile exposes the complete active answer field in the first viewport", `input=${Math.round(mobileInlineAnswerBox.top)}-${Math.round(mobileInlineAnswerBox.bottom)}`);
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
