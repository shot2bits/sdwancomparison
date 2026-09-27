import fs from "node:fs";

const guided = fs.readFileSync("src/components/procurement/GuidedBuild.tsx", "utf8");
const desk = fs.readFileSync("src/components/ProjectDesk.tsx", "utf8");
const css = fs.readFileSync("src/app/globals.css", "utf8");

const checks: Array<[string, boolean]> = [
  ["the draft visibly explains what is available before publication", /Private draft\.<\/strong> Build and review your RFP now\./.test(guided)],
  ["the notice names supplier matching as publication-locked", /Publishing it anonymously unlocks supplier matching/.test(guided)],
  ["the notice names responses, evidence and reports as publication-locked", /supplier responses, evidence, reports/.test(guided)],
  ["the notice allows private draft exports without publication", /Download a private Word draft or print to PDF without publishing/.test(guided)],
  ["mobile users receive the same unlock explanation beside their progress", /lpos-mobile-unlock-note[\s\S]{0,260}Private draft downloads are available now/.test(guided)],
  ["mobile layouts hide the longer desktop notice instead of duplicating it", /\.lpos-builder \.lpos-publish-unlock-note \{ display: none; \}/.test(css)],
  ["the pre-publication notice disappears after publication", /\{!published && \(\s*<p className="lpos-publish-unlock-note"/.test(guided)],
  ["the document status no longer says draft after publication", /published \? "Published" : "Draft · not published"/.test(guided)],
  ["disabled navigation reasons are exposed to assistive technology", /aria-describedby=\{item\.disabled \? tooltipId : undefined\}/.test(desk) && /role="tooltip"/.test(desk)],
  ["the guided builder receives the real publication state everywhere it renders", (desk.match(/<GuidedBuild[\s\S]{0,5000}?published=\{publishedFlag\}/g) ?? []).length === 2],
];

let failures = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failures += 1;
}
if (failures) process.exit(1);
console.log("\nALL PASS");
