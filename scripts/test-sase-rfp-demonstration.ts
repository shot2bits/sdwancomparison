import assert from "node:assert/strict";
import { saseDemoData, saseDemoSections, SASE_DEMO_BESPOKE } from "../src/lib/sase-rfp-demonstration";
import { validateRfpText } from "../src/lib/workspace/rfp-validator";
const demo = saseDemoData();
assert.equal(demo.initialAssessment.sector.detected, "manufacturing");
assert(!demo.initialAssessment.validBaseline);
assert(demo.initialAssessment.missingRequirementCount > 0);
for (const [depth, doc] of Object.entries(demo.documents)) {
  assert.deepEqual(doc.assessment, validateRfpText(doc.text));
  assert.equal(doc.assessment.sector.detected, "manufacturing", `${depth}: bank rationale must not change buyer sector`);
  assert(doc.assessment.validBaseline, `${depth}: complete example must be recognised as baseline`);
  assert(doc.text.includes(SASE_DEMO_BESPOKE.question));
  assert(doc.text.includes("Still to confirm"));
  assert(doc.text.includes(demo.disclosure));
}
const short = saseDemoSections("short").flatMap(s=>s.questions);
const detailed = saseDemoSections("detailed").flatMap(s=>s.questions);
assert.equal(short.length, 8);
assert.equal(detailed.length, 43);
assert(short.every(q=>detailed.some(d=>d.question_id===q.question_id)));
assert.equal(validateRfpText("A manufacturing company. Generic notes mention healthcare.").sector.detected, "manufacturing");
assert.equal(validateRfpText("A healthcare organisation. Generic notes mention manufacturing.").sector.detected, "healthcare");
console.log("PASS: real checker parity, sector regression, both baselines, full bank, bespoke question and disclosures retained");
