import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const baseUrl = process.env.RFP_TEST_URL || "http://localhost:3201/sase/home";
const pdfPath = join(tmpdir(), `netify-step6-${process.pid}.pdf`);
const source = [
  "SASE and SD-WAN RFP for a UK healthcare organisation with 30 sites and 4000 users across three UK regions.",
  "Current estate: MPLS, leased lines, broadband, Azure, Microsoft 365, legacy firewalls, Entra ID and SIEM.",
  "Scope: SD-WAN, SSE, ZTNA, CASB, secure web gateway, DLP, FWaaS, DNS security and automatic failover.",
  "Suppliers must evidence 99.99% availability, diverse dual circuits, latency, jitter, packet loss and recovery objectives.",
  "Provide evidence for GDPR, UK data residency, ISO 27001, MFA, least privilege, logging and threat prevention.",
  "Provide a fully managed 24/7 NOC and SOC, service desk, RACI, escalation, governance and reporting.",
  "Provide a phased six-month implementation with pilot, migration waves, rollback, training and handover.",
  "Provide per-site and per-user pricing, five-year TCO, licensing assumptions, three-year term, indexation and service credits.",
  "Complete a compliance matrix and pricing table. Mandatory requirements are pass or fail and remaining responses use published scoring weights.",
  "Describe architecture and integrations? Explain availability evidence? Provide implementation dependencies? Confirm support and escalation? Demonstrate compliance with dated evidence? State all costs and exclusions?",
];

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const pagePdf = pdf.addPage([595, 842]);
let y = 790;
for (const paragraph of source) {
  for (const line of paragraph.match(/.{1,88}(?:\s|$)/g) ?? [paragraph]) {
    pagePdf.drawText(line.trim(), { x: 42, y, size: 9.5, font });
    y -= 14;
  }
  y -= 7;
}
await writeFile(pdfPath, await pdf.save());

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15_000);
const results = [];
const badResponses = [];
const check = (label, value, detail = "") => results.push([label, Boolean(value), detail]);
page.on("response", (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: "networkidle", timeout: 30_000 });
  await page.getByRole("button", { name: /Check an AI-generated RFP/ }).click();
  await page.locator('input[type="file"]').setInputFiles(pdfPath);
  await page.locator(".lpos-validation-report").waitFor({ timeout: 35_000 });

  const score = Number(await page.locator(".lpos-validation-score strong").innerText());
  check("DEF-33/34 valid PDF is ingested and assessed", Number.isFinite(score) && score > 0, String(score));
  check("DEF-35 assessment reports all eight procurement sections", await page.locator(".lpos-validation-sections > button").count() === 8, String(await page.locator(".lpos-validation-sections > button").count()));

  const scoreBox = await page.locator(".lpos-validation-score").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height), radius: getComputedStyle(element).borderRadius };
  });
  check("DEF-38 score indicator is circular", Math.abs(scoreBox.width - scoreBox.height) <= 1 && scoreBox.radius !== "0px", JSON.stringify(scoreBox));

  const cta = await page.locator(".lpos-validation-improve").innerText();
  check("DEF-39 validation CTA sells the next procurement action", /Opportunity Board|Complete this RFP with Netify/i.test(cta), cta);

  const relevantFailures = badResponses.filter((entry) => !entry.includes("/_vercel/insights/script.js"));
  check("Step 6 has no relevant failed browser requests", relevantFailures.length === 0, relevantFailures.join(" | "));
} finally {
  await browser.close();
  await unlink(pdfPath).catch(() => undefined);
}

for (const [label, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` -> ${detail}` : ""}`);
if (results.some(([, ok]) => !ok)) process.exit(1);
