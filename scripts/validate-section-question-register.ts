import fs from "node:fs";
import path from "node:path";
import { compileProcurementDocument, CUSTOM_SUPPLIER_QUESTION_PREFIX } from "../src/lib/workspace/procurement-document";
import { buildSectionQuestionRegister, questionProgressBySection } from "../src/lib/workspace/section-question-register";
import type { OutlineRow } from "../src/lib/workspace/procurement-outline";

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
expect(projectDesk.includes("buildSectionQuestionRegister"), "the primary builder uses the canonical section question register");
expect(projectDesk.includes("activeRow?.state === \"confirmed\""), "a completed selected section remains inspectable instead of snapping away");
expect(guidedBuild.includes("Every core answer, optional refinement and supplier question in this section."), "the register explains core, optional and bespoke questions");
expect(guidedBuild.includes("Suggest questions with Netify AI"), "AI-assisted question suggestions are available explicitly");
expect(guidedBuild.includes("Suggestions are never added until you choose them."), "AI suggestions require buyer approval before inclusion");

const rows: OutlineRow[] = [
  { key: "current_estate", title: "Current estate", state: "confirmed", detail: "MPLS estate stated", missing: ["cloud estate", "existing security"] },
  { key: "resilience_availability", title: "Resilience and availability", state: "confirmed", detail: "Dual failover required" },
  { key: "security_identity_data", title: "Security, identity and data", state: "needs_input", detail: "Security controls not stated" },
];
const register = buildSectionQuestionRegister({
  rows,
  evidence: [{ id: "existing-network", sectionKey: "current_estate", text: "Existing network", answer: "MPLS" }],
  openQuestions: [],
  customQuestions: [{ id: "custom:resilience", sectionKey: "resilience_availability", text: question }],
});
const progress = questionProgressBySection(rows, register);

expect(register.current_estate.filter((item) => item.status === "required").length === 0, "confirmed sections never regain hidden required questions");
expect(register.current_estate.filter((item) => item.status === "suggested").length === 2, "extra detail in a confirmed section is visibly optional");
expect(register.resilience_availability.some((item) => item.status === "completed" && item.answer === "Dual failover required"), "a confirmed failover section always shows the evidence that completed it");
expect(progress.resilience_availability.answered === 1 && progress.resilience_availability.required === 0, "section navigation and checklist share the same completed state");
expect(register.security_identity_data.some((item) => item.status === "required"), "an incomplete section always exposes at least one core question");
expect(progress.resilience_availability.optional === 1, "buyer-added supplier questions are counted separately from completion");

console.log("\nALL PASS");
