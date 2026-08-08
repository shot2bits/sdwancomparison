/**
 * Build gate for src/lib/workspace/explanations.ts (Milestone 1, Commit
 * 11C): the single authoritative bounded glossary source used by the
 * isolated Quick Understanding preview. Proves the fixed glossary is
 * complete, non-empty, unique and free of supplier/ranking language, and
 * that explanationForInput()'s narrow recognition grammar accepts exactly
 * the approved question shapes for the approved term set and rejects
 * everything else — including substantive project statements that merely
 * mention an approved term.
 *
 * TOOLING LIMITATION: none applicable here — explanationForInput() and the
 * glossary table are plain, pure, non-React functions/data, so this script
 * calls them directly with no workaround needed (unlike the React
 * component validation scripts in this repository).
 *
 * Not yet wired into `npm run validate` — consistent with every other
 * validation script in this repository so far.
 */

import { readFileSync } from "node:fs";
import { explanationForInput, type WorkspaceExplanation } from "../src/lib/workspace/explanations";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const APPROVED_TERMS = [
  "SASE",
  "SD-WAN",
  "SSE",
  "PCI DSS",
  "Zero Trust",
  "MDR",
  "SOC",
  "RFI",
  "RFP",
  "Statement of Requirements",
];

const explanationsSrc = readFileSync(new URL("../src/lib/workspace/explanations.ts", import.meta.url), "utf8");
const explanationsCode = codeOnly(explanationsSrc);

/* 1. Every approved glossary term has one definition. ---------------------- */
{
  for (const term of APPROVED_TERMS) {
    const result = explanationForInput(`What is ${term}?`);
    expect(result !== null, `[1] expected "What is ${term}?" to resolve to a definition, got null`);
    expect(result?.term === term, `[1] expected canonical term "${term}", got "${result?.term}"`);
  }
}

/* 2. Definitions are non-empty and unique. ---------------------------------- */
{
  const defs = APPROVED_TERMS.map((term) => explanationForInput(`What is ${term}?`)?.explanation ?? "");
  for (let i = 0; i < APPROVED_TERMS.length; i++) {
    expect(defs[i]!.trim().length > 0, `[2] definition for "${APPROVED_TERMS[i]}" is empty`);
  }
  const uniqueDefs = new Set(defs);
  expect(uniqueDefs.size === APPROVED_TERMS.length, `[2] expected ${APPROVED_TERMS.length} unique definitions, found ${uniqueDefs.size}`);
}

/* 3. Definitions contain no supplier recommendation or ranking. ------------ */
{
  const forbidden = [
    "netify recommends",
    "we recommend",
    "best provider",
    "top vendor",
    "top provider",
    "market leader",
    "leading vendor",
    "leading provider",
    "ranked",
    "ranking",
    "#1",
    "cisco",
    "palo alto",
    "zscaler",
    "fortinet",
    "cato",
    "netskope",
    "versa",
  ];
  for (const term of APPROVED_TERMS) {
    const def = (explanationForInput(`What is ${term}?`)?.explanation ?? "").toLowerCase();
    for (const bad of forbidden) {
      expect(!def.includes(bad), `[3] definition for "${term}" contains forbidden supplier/ranking term "${bad}": ${def}`);
    }
  }
}

/* 4. "What is SASE?" matches SASE. ------------------------------------------ */
{
  const result = explanationForInput("What is SASE?");
  expect(result !== null && result.term === "SASE", `[4] expected "What is SASE?" to match SASE, got ${JSON.stringify(result)}`);
}

/* 5. "What does SD-WAN mean?" matches SD-WAN. ------------------------------- */
{
  const result = explanationForInput("What does SD-WAN mean?");
  expect(result !== null && result.term === "SD-WAN", `[5] expected "What does SD-WAN mean?" to match SD-WAN, got ${JSON.stringify(result)}`);
}

/* 6. "Can you explain PCI DSS?" matches PCI DSS. ---------------------------- */
{
  const result = explanationForInput("Can you explain PCI DSS?");
  expect(result !== null && result.term === "PCI DSS", `[6] expected "Can you explain PCI DSS?" to match PCI DSS, got ${JSON.stringify(result)}`);
}

/* 7. Case and trailing punctuation variants match. -------------------------- */
{
  const variants = [
    "what is sase",
    "WHAT IS SASE?",
    "  What Is SASE?  ",
    "What is SASE",
    "what is sase???",
    "What is SASE!",
    "Explain SASE.",
    "explain sase",
    "Explain   SASE.", // repeated whitespace
  ];
  for (const v of variants) {
    const result = explanationForInput(v);
    expect(result !== null && result.term === "SASE", `[7] expected "${v}" to match SASE, got ${JSON.stringify(result)}`);
  }
}

/* 8. Substantive requirement statements do not match. ----------------------- */
{
  const substantive = [
    "We need SASE across 50 sites.",
    "PCI DSS applies to our payment environment.",
    "We need the provider to explain SD-WAN pricing.",
    "Our SOC operates 24/7.",
    "We are evaluating Zero Trust vendors for next year.",
    "The RFP closes on Friday.",
  ];
  for (const s of substantive) {
    const result = explanationForInput(s);
    expect(result === null, `[8] expected "${s}" NOT to match any glossary term, got ${JSON.stringify(result)}`);
  }
}

/* 9. "Suppliers must explain their SASE design" does not match. ------------- */
{
  const result = explanationForInput("Suppliers must explain their SASE design");
  expect(result === null, `[9] expected "Suppliers must explain their SASE design" NOT to match, got ${JSON.stringify(result)}`);
}

/* 10. Unknown terms return null. --------------------------------------------- */
{
  const unknown = ["What is XDR?", "Explain MPLS.", "What does CASB mean?", "Can you explain DLP?", "What is Netify?"];
  for (const u of unknown) {
    const result = explanationForInput(u);
    expect(result === null, `[10] expected "${u}" (unknown/unapproved term) to return null, got ${JSON.stringify(result)}`);
  }
}

/* 11. No API or model call exists in the explanation module. ---------------- */
{
  expect(!/\bfetch\s*\(/.test(explanationsCode), `[11] explanations.ts calls fetch()`);
  expect(!/from ["']@\/app\/api/.test(explanationsCode), `[11] explanations.ts imports from an API route`);
  expect(!/openai|anthropic|model\.generate|chat\.completions/i.test(explanationsCode), `[11] explanations.ts appears to reference a model/LLM call`);
  expect(!/\basync\s+function\b/.test(explanationsCode), `[11] explanations.ts declares an async function (would suggest I/O)`);
  expect(!/\bawait\b/.test(explanationsCode), `[11] explanations.ts uses "await" anywhere (would suggest I/O)`);
}

/* 12. No duplicate glossary table exists in components. --------------------- */
{
  const workspaceSrc = codeOnly(readFileSync(new URL("../src/components/preview/QuickSorWorkspace.tsx", import.meta.url), "utf8"));
  const clarificationSrc = codeOnly(readFileSync(new URL("../src/components/preview/ClarificationEntry.tsx", import.meta.url), "utf8"));
  // None of the ten approved definitions' distinctive text should appear
  // verbatim in either component — the definitions must live only in
  // explanations.ts, imported and used, never copy-pasted.
  const distinctiveFragments = [
    "combines networking and security capabilities in a cloud-delivered architecture",
    "manages connectivity between sites, users and cloud services",
    "the security-focused part of SASE",
    "Payment Card Industry Data Security Standard",
    "continually verified using identity, device, context and policy",
    "monitors for threats, investigates suspicious activity",
    "monitor, investigate and respond to security events",
    "gather structured information from potential suppliers",
    "proposed solution, delivery approach, evidence and commercial terms",
    "describes what the buyer needs, the current environment",
  ];
  for (const frag of distinctiveFragments) {
    expect(!workspaceSrc.includes(frag), `[12] QuickSorWorkspace.tsx duplicates glossary definition text: "${frag}"`);
    expect(!clarificationSrc.includes(frag), `[12] ClarificationEntry.tsx duplicates glossary definition text: "${frag}"`);
  }
  // Positive check: the definitions really do live in explanations.ts.
  for (const frag of distinctiveFragments) {
    expect(explanationsCode.includes(frag), `[12] expected explanations.ts to contain "${frag}"`);
  }
}

/* 13. explanationForInput() does not mutate any shared state across calls   */
/*     (pure function: same input always produces an equivalent, freshly     */
/*     built object). ----------------------------------------------------------*/
{
  const a = explanationForInput("What is SASE?");
  const b = explanationForInput("What is SASE?");
  expect(JSON.stringify(a) === JSON.stringify(b), `[13] explanationForInput() returned different results for the same input`);
  expect(a !== b, `[13] expected a freshly built object per call, not a shared/cached reference`);
}

/* 14. The returned object shape matches WorkspaceExplanation exactly        */
/*     (term, question, explanation — no extra fields). ------------------------*/
{
  const result: WorkspaceExplanation | null = explanationForInput("What is Zero Trust?");
  expect(result !== null, `[14] expected a result for "What is Zero Trust?"`);
  if (result) {
    const keys = Object.keys(result).sort();
    expect(JSON.stringify(keys) === JSON.stringify(["explanation", "question", "term"]), `[14] unexpected object shape, got keys: ${keys.join(", ")}`);
    expect(result.question === "What is Zero Trust?", `[14] expected the original question preserved verbatim, got "${result.question}"`);
  }
}

console.log(`workspace-explanations: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
