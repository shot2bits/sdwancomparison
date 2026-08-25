import { POST as validateRoute } from "../src/app/api/workspace/validate-rfp/route";
import { validateRfpText } from "../src/lib/workspace/rfp-validator";
import { QUESTION_BANK } from "../src/lib/rfp-question-bank";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function expect(condition: boolean, message: string, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`PASS  ${message}${detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
  } else {
    fail++;
    failures.push(message);
    console.log(`FAIL  ${message}${detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
  }
}

const detailedRfp = `
SASE and SD-WAN procurement for a UK healthcare organisation operating 30 sites, 4,000 users and devices across three UK regions. Our objective is resilient access to Microsoft 365, Azure and clinical SaaS applications.

The current estate uses MPLS, leased lines and broadband underlay with legacy firewalls, Active Directory and SIEM monitoring. The required scope includes SD-WAN, SSE, ZTNA, CASB, secure web gateway, DLP, FWaaS and DNS security.

Suppliers must describe an architecture providing 99.99% availability, diverse dual circuits and automatic failover. Explain how latency, jitter, packet loss and application-aware path selection are measured.

Describe identity integration with Entra ID, MFA, least privilege and device posture. Provide evidence for threat prevention, TLS inspection, logging to our SIEM, GDPR compliance, UK data residency, ISO 27001 certification and current audit reports.

We require a fully managed service with a 24/7 service desk, NOC and SOC. Explain incident, problem and change management, escalation, governance, reporting, quarterly service reviews, roles and RACI responsibilities.

Provide a phased implementation and migration plan with milestones over six months. Include pilot sites, cutover, rollback, training, knowledge transfer and handover.

Provide transparent per-site and per-user pricing, five-year TCO, licensing assumptions, a three-year contract term, renewal and indexation. State termination, liability, service-credit and data-return protections.

Response format: complete a compliance matrix and pricing table. Mandatory requirements are pass/fail; remaining responses will be scored using published evaluation criteria and weightings.

1. Describe the proposed architecture and integrations?
2. Explain how service availability will be evidenced?
3. Provide your implementation plan and named dependencies?
4. Confirm the managed support model and escalation paths?
5. Demonstrate compliance using dated certificates and customer references?
6. State all commercial assumptions, exclusions and optional costs?
`;

const shallowRfp = `We need SASE for our business. Please describe your solution and provide pricing. What support do you offer?`;

async function main() {
  const strong = validateRfpText(detailedRfp);
  expect(strong.validBaseline, "a detailed RFP satisfies the governed baseline", strong.score);
  expect(strong.score >= 80, "a detailed, comparable and evidenced RFP scores strongly", strong.score);
  expect(strong.sections.length === 8, "all eight procurement sections are assessed", strong.sections.length);
  expect(strong.questionCount >= 6, "supplier questions are counted", strong.questionCount);
  expect(strong.bank.totalQuestions === 386, "the report is wired to the 386-question governed bank", strong.bank);
  expect(strong.bank.extendedQuestions === 43, "the extended question bank is represented", strong.bank);

  const shallow = validateRfpText(shallowRfp);
  expect(!shallow.validBaseline, "a shallow prompt cannot be treated as a publishable RFP", shallow.score);
  expect(shallow.score < strong.score, "the shallow RFP scores below the detailed RFP", { shallow: shallow.score, strong: strong.score });
  expect(shallow.gaps.some((gap) => /evidence/i.test(gap)), "missing evidence is reported as a gap", shallow.gaps);
  expect(shallow.gaps.some((gap) => /scoring|evaluation/i.test(gap)), "missing evaluation criteria are reported as a gap", shallow.gaps);
  expect(shallow.recommendedQuestions.length > 0, "weak coverage produces governed bank recommendations");
  const canonicalIds = new Set(QUESTION_BANK.canonical.map((question) => question.id));
  expect(shallow.recommendedQuestions.every((question) => canonicalIds.has(question.id)), "recommendations are canonical bank questions", shallow.recommendedQuestions.map((q) => q.id));

  const emptyRes = await validateRoute(new Request("https://example.test/sase/api/workspace/validate-rfp", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "" }),
  }));
  expect(emptyRes.status === 400, "the API rejects an empty RFP", emptyRes.status);

  const oversizedRes = await validateRoute(new Request("https://example.test/sase/api/workspace/validate-rfp", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x".repeat(200_001) }),
  }));
  expect(oversizedRes.status === 413, "the API enforces its 200,000-character limit", oversizedRes.status);

  const validRes = await validateRoute(new Request("https://example.test/sase/api/workspace/validate-rfp", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: detailedRfp }),
  }));
  const validBody = (await validRes.json()) as { report?: ReturnType<typeof validateRfpText> };
  expect(validRes.status === 200, "the API validates a real RFP", validRes.status);
  expect(validBody.report?.validBaseline === true, "the API returns the same baseline decision as the pure validator");

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail) {
    console.log("\nFailures:");
    failures.forEach((failure) => console.log(` - ${failure}`));
    process.exit(1);
  }
  console.log("\nALL PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
