// Project Foundation Piece 3B-2 verification (9 Aug 2026, hybrid model per
// Robert's ruling). Not part of the app bundle, not wired into `npm run
// validate` (the repo has no test runner; this follows the established
// scripts/verify-*.ts and *.fixtures.ts conventions, same as Piece 3A). Run:
//   npx tsx scripts/verify-piece3b-2-supplier-identity.ts
//
// Runs the pure, two-tier identity test matrix against
// resolveSupplierPrincipalFromFacts directly, plus two small KV-free
// integration checks of the async wrapper. Does not require KV/live storage.
// A live preview smoke test (matching each route's actual HTTP behaviour,
// including the bearer-credential and lazy-issuance paths against real KV)
// is prepared as an acceptance plan in the Piece 3B-2 review report, per
// this piece's stop-before-commit/deploy condition — not run here.

import { runSupplierPrincipalTests } from "../src/lib/supplier-capability-access.fixtures";
import { runCredentialExchangeTests } from "../src/lib/supplier-credential-exchange.fixtures";
import { runResponseAccessTests } from "../src/lib/rfp-response-access.fixtures";

async function main() {
  console.log("=== Piece 3B-2: supplier-principal identity test matrix (hybrid model) ===\n");
  const result = await runSupplierPrincipalTests();
  for (const f of result.failures) console.log(`FAIL  ${f}`);
  console.log(`\n${result.pass}/${result.pass + result.fail} passed.`);

  console.log("\n=== Piece 3B-2: credential-exchange test matrix (redeem-once-then-cookie, 9 Aug 2026 ruling) ===\n");
  const exchange = await runCredentialExchangeTests();
  for (const f of exchange.failures) console.log(`FAIL  ${f}`);
  console.log(`\n${exchange.pass}/${exchange.pass + exchange.fail} passed.`);

  console.log("\n=== Regression check: Piece 3A response-access parity matrix (A-J), unmodified this piece ===\n");
  const r3a = runResponseAccessTests();
  for (const f of r3a.failures) console.log(`FAIL  ${f}`);
  console.log(`\n${r3a.pass}/${r3a.pass + r3a.fail} passed.`);

  const totalFail = result.fail + exchange.fail + r3a.fail;
  if (totalFail > 0) {
    console.log(`\n${totalFail} total failure(s).`);
    process.exit(1);
  }
  console.log("\nAll Piece 3B-2 tests pass, and Piece 3A shows no regression.");
}

main();
