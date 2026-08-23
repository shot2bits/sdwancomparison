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
  await desktop.getByRole("button", { name: "Answer one question at a time" }).click();
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
  check(/Organisation and scale\nEssential facts captured · 4 of 5 populated/.test(globalRequirementText), "three regions count as one populated geography question and the five-question RFP target stays explicit");

  // Production persists anonymous projects; isolate the second fixture so its
  // section counts cannot inherit answers from the multi-region fixture above.
  await desktop.context().clearCookies();
  await desktop.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await startProject(desktop, "20 UK sites for a retail business with 50 remote users, HQ in Norwich requires dual RA02 failover. We need full SASE and want to migrate by December 2026.");
  const initialText = await desktop.locator("body").innerText();
  const resilienceRow = await desktop.getByRole("button", { name: /Resilience and availability/ }).innerText();
  check(/(?:Essential facts captured|RFP-ready) · [1-5] of 5 populated/.test(resilienceRow) && /RA02|failover/i.test(initialText), "stated failover is captured in the resilience section while the RFP-depth target remains honest");
  check(initialText.includes("RFP Builder · Retail"), "the workspace identifies itself as the RFP Builder");

  const publishNow = desktop.getByRole("button", { name: "Publish opportunity now" });
  check((await publishNow.count()) === 1 && await publishNow.isEnabled(), "a concise opportunity can publish as soon as the essential facts stand");
  check(initialText.includes("You can publish this as a concise opportunity now"), "the AI advisor explains that early publishing is available and recommends further RFP depth");
  check(initialText.includes("of 5 populated"), "every section exposes the five-populated-question RFP quality threshold");
  check(await desktop.evaluate(() => document.documentElement.scrollWidth === window.innerWidth), "desktop has no horizontal overflow");
  check(!initialText.match(/Quick requirement|Full RFP|Expand to full|Recommended questions|Expanded questions/i), "the UI contains no short/large RFP mode choice");
  await publishNow.click();
  await desktop.locator(".nf-2030-publish").waitFor();
  const publishBackground = await desktop.locator(".nf-2030-publish").evaluate((element) => getComputedStyle(element).backgroundColor);
  check(publishBackground !== "rgb(255, 255, 255)", "the publish handoff remains on the dark workspace surface", publishBackground);
  check((await desktop.getByRole("button", { name: /Generate and publish|create the test position/i }).count()) === 1, "the prominent publish path reaches the governed final action");
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE_URL, { waitUntil: "networkidle" });
  await mobile.getByRole("button", { name: "Answer one question at a time" }).click();
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
