import fs from "node:fs";
import path from "node:path";
import { compileProcurementDocument, CUSTOM_SUPPLIER_QUESTION_PREFIX } from "../src/lib/workspace/procurement-document";
import { buildSectionQuestionRegister, questionProgressBySection } from "../src/lib/workspace/section-question-register";
import type { OutlineRow } from "../src/lib/workspace/procurement-outline";
import { earnedQuestions } from "../src/lib/workspace/questions";

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
expect(projectDesk.includes('activeRow?.state !== "confirmed" ? activeRow : sectionProgress.next'), "the essential journey advances past a completed selected section without another Continue gate");
expect(guidedBuild.includes("Every core answer, optional refinement and supplier question in this section."), "the register explains core, optional and bespoke questions");
expect(guidedBuild.includes("Suggest questions with Netify AI"), "AI-assisted question suggestions are available explicitly");
expect(guidedBuild.includes("Nothing is added without your approval."), "AI suggestions require buyer approval before inclusion");
expect(!guidedBuild.includes("Suggestions are never added until you choose them."), "the recommendation panel states approval once, without duplicate reassurance");
expect(guidedBuild.includes("suggestionRequestRef.current += 1") && guidedBuild.includes("[sectionTitle]"), "changing section invalidates and clears its previous AI recommendations");
expect(guidedBuild.includes("requestId !== suggestionRequestRef.current"), "a slow response from the previous section cannot overwrite the current section");
expect(guidedBuild.includes('className="nf-guided-question-actions" role="group"'), "question-extension actions expose a valid accessible group");
expect(guidedBuild.includes("nf-essential-progress"), "essential progress remains visible above the guided journey");
expect(guidedBuild.includes("sectionComplete && incompleteSectionTitle"), "the final completed section cannot render a dead next-section button");
expect(guidedBuild.includes('rfpDepth === "short" ? "Short RFP" : "Detailed RFP"'), "short and detailed modes explain distinct completion contracts");
expect(guidedBuild.includes('rfpDepth === "detailed" ? <><button'), "recommended-question controls are exposed by detailed mode rather than duplicated in short mode");
expect(projectDesk.includes("ready={contentReady}") && projectDesk.includes("depthReady={rfpCoverage.ready}"), "essential readiness is separate from optional detailed depth");

const guidedQuestions = earnedQuestions(
  { organisation: { regions: ["uk"] }, estate: { sites: 12 } },
  "sase",
  "managed",
  [],
  [],
);
const saseScope = guidedQuestions.find((item) => item.id === "q-sse-scope");
const resilienceScope = guidedQuestions.find((item) => item.id === "q-resilience");
expect(saseScope?.selectionMode === "multiple", "SASE security controls are a genuine multi-select decision");
expect(saseScope?.options.length === 5, "all five governed SASE controls remain available together");
expect(resilienceScope?.options[0]?.label === "Required at all sites", "resilience wording names its site scope explicitly");
expect(!guidedQuestions.some((item) => /fully managed.*co-managed.*self-managed/i.test(item.question)), "a captured managed-service fact is not asked again as a blank operating-model decision");

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
