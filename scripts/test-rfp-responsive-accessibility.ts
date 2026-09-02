import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const modes = fs.readFileSync(path.join(root, "src/components/procurement/JourneyModeSelector.tsx"), "utf8");
const procurements = fs.readFileSync(path.join(root, "src/components/MyProcurements.tsx"), "utf8");
const guidedBuild = fs.readFileSync(path.join(root, "src/components/procurement/GuidedBuild.tsx"), "utf8");
const sectionBuild = fs.readFileSync(path.join(root, "src/components/procurement/SectionBuildPanel.tsx"), "utf8");
const projectDesk = fs.readFileSync(path.join(root, "src/components/ProjectDesk.tsx"), "utf8");

function luminance(hex: string) {
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

assert.match(modes, /className="journey-mode-selector /, "the journey selector needs a layout hook");
assert.doesNotMatch(modes, /Choose how to start —/, "the visible heading must not contain an em dash");
assert.match(css, /body:has\(\.nf-2030-workspace\) \.journey-mode-selector \{[\s\S]*?margin-left: 106px;/, "the selector must clear the desktop rail");
assert.match(css, /@media \(max-width: 1100px\) \{[\s\S]*?\.journey-mode-selector \{ margin-left: 58px; \}/, "the selector must clear the compact rail");
assert.match(css, /@media \(max-width: 1280px\) \{[\s\S]*?grid-template-columns: minmax\(0,1fr\) auto !important;[\s\S]*?\.nf-2030-lifecycle \{ display: none !important; \}/, "the lifecycle must not compress at narrow desktop widths");
assert.match(css, /@media \(max-width: 560px\) \{[\s\S]*?\.lpos-section-extensions \{ flex-wrap: wrap;[\s\S]*?\.lpos-unlock ul \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\); \}/, "narrow mobile controls must wrap without widening the page");

assert.ok(contrast("ffffff", "b84e08") >= 4.5, "white action text must meet WCAG AA on the action orange");
assert.ok(contrast("625e58", "fffaf4") >= 4.5, "section detail text must meet WCAG AA");
assert.ok(contrast("9b3d00", "fff1e5") >= 4.5, "needs-input status text must meet WCAG AA");
assert.ok(contrast("3f7030", "f2f8ee") >= 4.5, "draft status text must meet WCAG AA");
assert.match(css, /--lpos-orange-action: #b84e08;/, "filled Living Procurement actions must use the accessible orange");
assert.doesNotMatch(css, /color: #fff; background: var\(--lpos-orange\)/, "white text must not use the low-contrast accent orange as its background");

assert.match(procurements, /fetch\("\/sase\/api\/auth\/session"/, "private account data needs a session preflight");
assert.match(procurements, /if \(!session\.authenticated\) \{[\s\S]*?setRfps\(\[\]\);[\s\S]*?return;/, "signed-out visitors must stop before private record requests");
assert.match(procurements, /Promise\.all\(\[loadRfps\(\), loadOpps\(\)\]\)/, "private records should load only after the session gate");
assert.doesNotMatch(guidedBuild, /<main className="nf-guided-main">/, "the guided panel must not nest a second main landmark");
assert.doesNotMatch(guidedBuild, /<h1>\{visibleQuestion\.prompt\}<\/h1>/, "the current question must not create a second page H1");
assert.doesNotMatch(sectionBuild, /<main className="nf-section-build-panel"/, "the section panel must not create a nested main landmark");
assert.doesNotMatch(sectionBuild, /<h1>/, "the section panel must not create a second page H1");
assert.match(projectDesk, /<textarea\s+aria-label="Describe your requirements"/, "the primary requirement composer needs an accessible name");
assert.match(projectDesk, /<input\s+aria-label="Attach an RFP or requirements document"[\s\S]*?type="file"/, "the document upload needs an accessible name");

console.log("RFP responsive layout, contrast and session-gate tests passed");
