import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const desk = fs.readFileSync(path.join(root, "src/components/ProjectDesk.tsx"), "utf8");
const guided = fs.readFileSync(path.join(root, "src/components/procurement/GuidedBuild.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");

const checks: Array<[string, boolean]> = [
  ["DEF-02: recognisable SVG navigation icons are rendered", desk.includes("const railIcon =") && desk.includes("<svg {...common}>")],
  ["DEF-02: compact labels remain visible below 1100px", css.includes(".nf-2030-workspace .lpos-product-rail .lpos-rail-label { display: block;")],
  ["DEF-03: locked items remain focusable and expose a reason", desk.includes("aria-disabled={item.disabled || undefined}") && desk.includes("data-disabled-reason={item.disabled ? item.disabledReason : undefined}") && css.includes("content: attr(data-disabled-reason)")],
  ["DEF-04: Review replaces Overview and follows Reports", !desk.includes('label: "Overview"') && desk.indexOf('label: "Review"') > desk.indexOf('label: "Reports"')],
  ["DEF-05: collapse typography targets the arrow, not every span", css.includes(".lpos-collapse > span:first-child") && !css.includes(".lpos-collapse span { font-size: 30px")],
  ["DEF-06: collapse is hidden on compact layouts", css.includes(".nf-2030-workspace .lpos-product-rail .lpos-collapse { display: none; }")],
  ["DEF-07: Settings has one RFP preferences title", guided.includes(">RFP preferences</h2>") && !guided.includes(">Document preferences</p>") && !guided.includes(">Document settings</h2>")],
  ["DEF-08: question-bank statistics are absent from Settings", !guided.includes("lpos-settings-methodology") && !guided.includes("386-question procurement bank")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
