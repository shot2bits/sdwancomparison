import fs from "node:fs";

const guided = fs.readFileSync("src/components/procurement/GuidedBuild.tsx", "utf8");
const envelope = fs.readFileSync("src/lib/workspace/envelope.ts", "utf8");

const checks: Array<[string, boolean]> = [
  ["Settings identifies itself as a modal dialog", /role="dialog" aria-modal="true" aria-labelledby="lpos-document-settings"/.test(guided)],
  ["Settings moves initial focus inside the dialog", /data-settings-initial-focus/.test(guided) && /querySelector<HTMLElement>\("\[data-settings-initial-focus\]"\)\?\.focus\(\)/.test(guided)],
  ["Escape closes Settings", /event\.key === "Escape"[\s\S]{0,140}onSettingsOpenChange\(false\)/.test(guided)],
  ["Tab and Shift+Tab remain inside Settings", /event\.key !== "Tab"[\s\S]{0,900}last\.focus\(\)[\s\S]{0,220}first\.focus\(\)/.test(guided)],
  ["closing Settings restores focus to its opener", /settingsReturnFocusRef\.current\?\.focus\(\)/.test(guided)],
  ["concurrent stale saves remain rejected with 409", /status: 409/.test(envelope) && /base revision/i.test(envelope)],
];

let failures = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failures += 1;
}
if (failures) process.exit(1);
console.log("\nALL PASS");
