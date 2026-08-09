// Milestone 3 — FIRST CUT verification (9 Aug 2026). Not part of the app
// bundle, not wired into `npm run validate` (the repo has no test runner;
// this follows the established scripts/verify-*.ts and *.fixtures.ts
// conventions, matching verify-piece2-engine-data.ts). Run:
//   npx tsx scripts/verify-milestone3-conversation.ts
//
// Two parts:
//   1. The new focused suite for this milestone (test matrix A-L plus the
//      implementation's own additional cases).
//   2. Every EXISTING suite this milestone's changes could plausibly touch
//      (create-project, rescope-project, generate-rfp, project-machine,
//      project-story, workspace draft ledger), run unmodified, as the
//      regression proof that the twin-gate and engine_data changes have
//      not altered default behaviour for any existing caller (Test L, and
//      Robert's validation requirement).

import { runConverseProjectTests } from "../src/lib/security/converse-project.fixtures";
import { runCreateProjectTests } from "../src/lib/security/create-project.fixtures";
import { runRescopeTests } from "../src/lib/security/rescope-project.fixtures";
import { runGenerateRfpTests } from "../src/lib/security/generate-rfp.fixtures";
import { runProjectMachineTests } from "../src/lib/project-machine.fixtures";
import { runProjectStoryTests } from "../src/lib/project-story.fixtures";
import { runWorkspaceDraftTests } from "../src/lib/workspace/draft.fixtures";

async function main() {
  const suites: Array<{ name: string; run: () => Promise<{ pass: number; fail: number; failures: string[] }> }> = [
    { name: "Milestone 3: continue_security_conversation (NEW)", run: runConverseProjectTests },
    { name: "create-project (existing, regression)", run: runCreateProjectTests },
    { name: "rescope-project (existing, regression)", run: runRescopeTests },
    { name: "generate-rfp (existing, regression)", run: runGenerateRfpTests },
    { name: "project-machine (existing, regression)", run: async () => runProjectMachineTests() },
    { name: "project-story (existing, regression)", run: runProjectStoryTests },
    { name: "workspace draft ledger (existing, regression)", run: runWorkspaceDraftTests },
  ];

  let totalPass = 0;
  let totalFail = 0;
  const allFailures: string[] = [];

  for (const s of suites) {
    const r = await s.run();
    totalPass += r.pass;
    totalFail += r.fail;
    console.log(`${r.fail === 0 ? "PASS" : "FAIL"}  ${s.name}: ${r.pass} pass, ${r.fail} fail`);
    for (const f of r.failures) {
      console.log(`   - ${f}`);
      allFailures.push(`[${s.name}] ${f}`);
    }
  }

  console.log("");
  console.log(`TOTAL: ${totalPass} pass, ${totalFail} fail`);
  if (totalFail > 0) {
    console.log("\nFailures:");
    for (const f of allFailures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("verify-milestone3-conversation crashed:", e);
  process.exit(1);
});
