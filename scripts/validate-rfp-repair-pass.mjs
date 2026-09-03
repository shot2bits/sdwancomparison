#!/usr/bin/env node
import { chromium } from "playwright";

const BASE_URL = process.env.RFP_UI_BASE_URL ?? "http://localhost:3100/sase/home/?test=1";
const VIEWPORTS = [390, 768, 819, 821, 1024, 1280, 1440, 1728];
let checks = 0;
let failures = 0;

export function check(condition, label, detail = "") {
  checks += 1;
  if (!condition) failures += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` -> ${detail}` : ""}`);
}

const browser = await chromium.launch();
try {
  for (const width of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    check(await page.locator(".nf-2030-workspace").count() === 1, `${width}px: RFP workspace renders`);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
