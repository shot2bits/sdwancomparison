// Verification-only script (not part of the app).
//
// Robert, 20 Aug 2026: "include a version number on the page so I can see
// whether the page is cached or not."
//
// The whole value of this stamp rests on ONE property: it must be baked
// in at build time. A value computed per request -- a header, a runtime
// clock, `new Date()` in a component -- reads fresh on months-old cached
// HTML, which is precisely the opposite of what was asked for. That
// property is easy to break by accident in a later edit, so it is
// asserted here rather than trusted.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildStamp, BUILD_SHA } from "../src/lib/build-info";

const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const src = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");

let failures = 0;
const record = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

function main() {
  const config = src("next.config.ts");
  const lib = src("src/lib/build-info.ts");
  const footer = src("src/components/CommercialFooter.tsx");
  const root = src("src/app/layout.tsx");

  /* --- The load-bearing property --- */
  record(
    /NEXT_PUBLIC_BUILD_SHA:\s*process\.env\.VERCEL_GIT_COMMIT_SHA/.test(config),
    "the sha comes from Vercel's own per-deployment commit variable",
  );
  record(
    /env:\s*\{/.test(config) && /NEXT_PUBLIC_BUILD_TIME:\s*new Date\(\)\.toISOString\(\)/.test(config),
    "both values are set in next.config's `env` block, which Next INLINES at build time",
  );
  record(
    !/new Date\(\)(?!\.toISOString)/.test(lib) || !/return.*new Date\(\)/.test(lib),
    "build-info.ts never substitutes a request-time clock for a missing build time",
  );
  record(
    /process\.env\.NEXT_PUBLIC_BUILD_TIME \|\| ""/.test(lib),
    "a missing build time reads as absent rather than being papered over with `now`",
    "an empty value is honest; a fresh one would defeat the entire purpose",
  );
  record(!/from "react"|useState/.test(lib), "build-info.ts is pure -- no React (Article 17)");

  /* --- It is actually on the page --- */
  record(/buildStamp\(\)/.test(footer), "the footer renders the shared stamp function, not its own formatting");
  record(
    /"netify-build": BUILD_SHA/.test(root),
    "the sha is also emitted as page metadata, readable from view-source without scrolling",
  );
  record(
    /* Matched as JSX at the start of a line, never as a bare word: this
       file's own doc comment names the tag it is banning, and a bare-word
       regex fails on the comment explaining the rule. That has caught this
       repo four times now -- always assert the USAGE form. */
    /other:\s*\{/.test(root) && !/^\s*<head>/m.test(root),
    "emitted through Next's metadata API, not a hand-written head element (which risks a second one)",
  );

  /* --- The formatter behaves --- */
  record(BUILD_SHA.length <= 7, "the sha is shortened to 7 characters", BUILD_SHA);
  const stamp = buildStamp();
  record(stamp.startsWith("build "), "the stamp is labelled so it is not mistaken for anything else", stamp);
  record(/UTC$/.test(stamp) || stamp === `build ${BUILD_SHA}`, "a time, when present, is stated in UTC", stamp);

  console.log(failures === 0 ? "\nALL PASS" : `\nFAILs: ${failures}`);
  if (failures) process.exit(1);
}

main();
