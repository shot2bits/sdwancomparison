import fs from "node:fs";

const guided = fs.readFileSync("src/components/procurement/GuidedBuild.tsx", "utf8");
const desk = fs.readFileSync("src/components/ProjectDesk.tsx", "utf8");
const css = fs.readFileSync("src/app/globals.css", "utf8");

const checks: Array<[string, boolean]> = [
  ["the draft visibly explains what is available before publication", /Private draft\.<\/strong> Build and review your RFP now\./.test(guided)],
  ["the notice names supplier matching as publication-locked", /Publishing it anonymously unlocks supplier matching/.test(guided)],
  ["the notice names responses, evidence and reports as publication-locked", /supplier responses, evidence, reports/.test(guided)],
  ["the notice names Word and PDF exports as publication-locked", /Word\/PDF exports/.test(guided)],
  ["mobile users receive the same unlock explanation beside their progress", /lpos-mobile-unlock-note[\s\S]{0,180}Supplier matching, responses, evidence, reports and exports unlock after anonymous publication/.test(guided)],
  ["mobile layouts hide the longer desktop notice instead of duplicating it", /\.lpos-builder \.lpos-publish-unlock-note \{ display: none; \}/.test(css)],
  ["the pre-publication notice disappears after publication", /\{!published && \(\s*<p className="lpos-publish-unlock-note"/.test(guided)],
  ["the document status no longer says draft after publication", /published \? "PUBLISHED" : "DRAFT · NOT PUBLISHED"/.test(guided)],
  ["disabled navigation reasons are exposed to assistive technology", /aria-description=\{item\.disabled \? item\.disabledReason : undefined\}/.test(desk)],
  ["the guided builder receives the real publication state everywhere it renders", (desk.match(/<GuidedBuild[\s\S]{0,5000}?published=\{publishedFlag\}/g) ?? []).length === 2],
];

let failures = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failures += 1;
}
if (failures) process.exit(1);
console.log("\nALL PASS");
