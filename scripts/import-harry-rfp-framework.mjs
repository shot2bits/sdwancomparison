#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const source = process.argv[2];
const destination = process.argv[3] || "data/harry-rfp-framework.json";
if (!source) throw new Error("Usage: node scripts/import-harry-rfp-framework.mjs <source.docx> [destination.json]");

const xml = execFileSync("unzip", ["-p", resolve(source), "word/document.xml"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
const decode = (value) => value
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const textOf = (block) => decode([...block.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("")).trim();
const styleOf = (block) => block.match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1] || "";
const blocks = [...xml.matchAll(/<w:(p|tbl)(?: [^>]*)?>[\s\S]*?<\/w:\1>/g)].map((m) => ({ type: m[1], style: styleOf(m[0]), text: textOf(m[0]) })).filter((b) => b.text);

const frameworkStart = blocks.findIndex((b) => b.text === "The 20-pillar supplier question set");
const frameworkEnd = blocks.findIndex((b, i) => i > frameworkStart && /^Worked proof-of-concept/.test(b.text));
if (frameworkStart < 0) throw new Error("The 20-pillar question set was not found in the Word document");

const pillars = [];
let current = null;
for (const block of blocks.slice(frameworkStart + 1, frameworkEnd > 0 ? frameworkEnd : undefined)) {
  if (/^P\d{2} - /.test(block.text)) {
    current = { id: block.text.slice(0, 3), title: block.text, introduction: "", questions: [] };
    pillars.push(current);
    continue;
  }
  if (!current) continue;
  if (!current.introduction) { current.introduction = block.text; continue; }
  const match = block.text.match(/^(P\d{2}\.\d{2})\s+\[([^\]]+)\]\s+(.+)$/);
  if (!match) continue;
  const index = blocks.indexOf(block);
  const following = blocks.slice(index + 1, index + 5).map((item) => item.text);
  current.questions.push({
    id: match[1],
    classification: match[2],
    title: match[3],
    question: following[0] || "",
    evidence: (following[1] || "").replace(/^Evidence requested:\s*/, ""),
    strongResponse: (following[2] || "").replace(/^Strong response:\s*/, ""),
    redFlag: (following[3] || "").replace(/^Red flag:\s*/, ""),
  });
}

const getParagraphsBetween = (start, end) => {
  const a = blocks.findIndex((b) => b.text === start);
  const z = blocks.findIndex((b, i) => i > a && b.text === end);
  return blocks.slice(a + 1, z > a ? z : undefined).filter((b) => b.type === "p");
};

const faqBlocks = getParagraphsBetween("Frequently Asked Questions", "ALL AI Citable Blocks");
const faqs = [];
for (const block of faqBlocks) {
  if (block.style === "Heading3") faqs.push({ question: block.text, answer: [] });
  else if (faqs.length) faqs.at(-1).answer.push(block.text);
}

const result = {
  source: "Netify RFP - Page Content (1).docx",
  lastEditedBy: "Harry Yelland",
  title: "The Living SASE & SD-WAN RFP Template",
  strapline: "A continuously updated, vendor-neutral procurement framework for specifying requirements, collecting evidence and comparing SASE and SD-WAN vendors and managed service providers.",
  introduction: "Use the complete template on this page as it stands, or turn it into a living Request for Proposal tailored to your organisation, sites, users, applications, security obligations and operating model. From there, Netify can identify relevant vendors and providers, publish an anonymous opportunity to the market, and collect structured technical and commercial responses for side-by-side evaluation.",
  useIntroduction: blocks.find((b, i) => blocks[i - 1]?.text === "How to use this living template")?.text || "",
  pillars,
  faqs,
};

const questionCount = pillars.reduce((sum, pillar) => sum + pillar.questions.length, 0);
if (pillars.length !== 20 || questionCount !== 120) throw new Error(`Expected 20 pillars and 120 questions, found ${pillars.length} pillars and ${questionCount} questions`);
writeFileSync(resolve(destination), `${JSON.stringify(result, null, 2)}\n`);
console.log(`Imported ${pillars.length} pillars and ${questionCount} questions to ${destination}`);
