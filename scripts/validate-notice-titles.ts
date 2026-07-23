/**
 * Build gate for the notice display-title rulebook. Chained into
 * `npm run validate`, so no build ships with a failing title fixture,
 * locally or on Vercel.
 */
import { runNoticeTitleTests } from "../src/lib/notice-title.fixtures";

const r = runNoticeTitleTests();
if (r.fail > 0) {
  console.error(`notice-titles: ${r.fail} fixture(s) failing`);
  for (const f of r.failures) console.error(`  ✘ ${f}`);
  process.exit(1);
}
console.log(`notice-titles: ${r.pass} fixtures pass (${r.fail} fail)`);
