// Project Foundation Piece 3A verification (8 Aug 2026). Not part of the app
// bundle, not wired into `npm run validate` (the repo has no test runner;
// this follows the established scripts/verify-*.ts and *.fixtures.ts
// conventions). Run: npx tsx scripts/verify-piece3a-response-parity.ts
//
// Runs the pure parity test matrix (A-J) from the Piece 3A implementation
// prompt against evaluateSupplierResponseAccess directly. This does not
// require KV/live storage — resolveSupplierResponseAccess (the async
// orchestrator that wraps this with real claim/NDA lookups) is exercised
// separately by a live smoke test against a deployed preview, the same
// pattern used for Piece 2, which is explicitly NOT run here per this
// piece's stop-before-commit/deploy condition.

import { runResponseAccessTests } from "../src/lib/rfp-response-access.fixtures";

function main() {
  console.log("=== Piece 3A: supplier-response access parity test matrix (A-J) ===\n");
  const result = runResponseAccessTests();
  for (const f of result.failures) console.log(`FAIL  ${f}`);
  console.log(`\n${result.pass}/${result.pass + result.fail} passed.`);
  if (result.fail > 0) {
    console.log("\nFailures:");
    for (const f of result.failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main();
