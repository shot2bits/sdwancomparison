/**
 * Build gate for the Continuation derivation rulebook (DEF wave one).
 * Chained into `npm run validate`, so no build ships with a failing
 * derivation fixture, locally or on Vercel.
 */
import { runContinuationTests } from "../src/lib/continuation/fixtures";

runContinuationTests().then((r) => {
  if (r.fail > 0) {
    console.error(`continuations: ${r.fail} fixture(s) failing`);
    for (const f of r.failures) console.error(`  ✘ ${f}`);
    process.exit(1);
  }
  console.log(`continuations: ${r.pass} fixtures pass (${r.fail} fail)`);
});
