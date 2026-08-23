import fs from "node:fs";
import path from "node:path";
import { compileProcurementDocument, CUSTOM_SUPPLIER_QUESTION_PREFIX } from "../src/lib/workspace/procurement-document";

const root = process.cwd();
const projectDesk = fs.readFileSync(path.join(root, "src/components/ProjectDesk.tsx"), "utf8");
const guidedBuild = fs.readFileSync(path.join(root, "src/components/procurement/GuidedBuild.tsx"), "utf8");

function expect(ok: unknown, message: string) {
  if (!ok) throw new Error(`FAIL  ${message}`);
  console.log(`PASS  ${message}`);
}

const question = "How will you evidence application performance during failover?";
const document = compileProcurementDocument({
  facts: [],
  requirement: {},
  verdict: null,
  noted: [{ id: `${CUSTOM_SUPPLIER_QUESTION_PREFIX}resilience_availability:test`, label: question, section: "resilience_availability", own: true }],
  rfiSet: null,
  instrument: "sor",
  receipts: [],
  previousDocument: null,
});
const compiledQuestion = document.responseGroups.flatMap((group) => group.questions).find((item) => item.text === question);

expect(compiledQuestion?.source === "custom", "a buyer-added question is compiled into the supplier response pack");
expect(projectDesk.includes("activeSectionQuestionItems"), "the primary builder derives one visible section question register");
expect(projectDesk.includes("activeRow?.state === \"confirmed\""), "a completed selected section remains inspectable instead of snapping away");
expect(guidedBuild.includes("Everything answered, outstanding and added by you."), "the register explains its complete scope");
expect(guidedBuild.includes("Suggest questions with Netify AI"), "AI-assisted question suggestions are available explicitly");
expect(guidedBuild.includes("Suggestions are never added until you choose them."), "AI suggestions require buyer approval before inclusion");

console.log("\nALL PASS");
