// Verification-only script (not part of the app): proves the six
// correction-pass-2 fixes against the exact inputs the correction brief
// specified, by calling the REAL, unmodified functions the app itself
// calls (extractRequirement / deterministicExtract / vetModelProposals /
// classifyTurnEntry / isDualCircuitNotRequiredAnswer). Nothing here is
// written to, or part of, the app bundle.
//
// ANTHROPIC_API_KEY is not set in this sandbox, so extractRequirement()
// always resolves via the deterministic fallback (see modelExtract's own
// early-return on a missing key) — that's an honest limitation of this
// script, not a gap in the fix: the model path for Priority 1 and the
// vetModelProposals() half of Priority 2 is proved separately below by
// calling vetModelProposals() directly with synthetic model proposals that
// reproduce the EXACT live-evidence shape reported earlier this engagement
// ("-5 sites" -> {value:5, quote:"5 sites"}), and is proved end-to-end
// against the real deployed API in the live browser/API test pass.

import {
  extractRequirement,
  deterministicExtract,
  vetModelProposals,
  QUANTITY_NOT_RECORDED_PREFIX,
} from "../src/lib/workspace/extract";
import type { SecurityRequirementInput } from "../src/lib/security/rulebook";
import { explanationForInput } from "../src/lib/workspace/explanations";
import {
  classifyTurnEntry,
  isDualCircuitNotRequiredAnswer,
  RESILIENCE_ANSWER_EXPLANATION,
  isRetractionRequest,
  RETRACTION_FALLBACK_EXPLANATION,
} from "../src/components/preview/QuickSorWorkspace";
import { mergeUpdates } from "../src/lib/workspace/draft";
import { computeSessionChanges } from "../src/components/preview/session-diff";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

async function main() {
  console.log("\n=== Priority 1: glossary questions must never mutate Understanding ===\n");

  const glossaryInputs = [
    "What is SASE?",
    "What is SD-WAN?",
    "What is SSE?",
    "What is PCI DSS?",
    "What is MDR?",
    "what is sase",
    "  What   is   MDR ??  ",
  ];
  for (const text of glossaryInputs) {
    const base: SecurityRequirementInput = {};
    const result = await extractRequirement(text, base);
    const noUpdates = result.updates.length === 0;
    const requirementUnchanged = JSON.stringify(result.requirement) === JSON.stringify(base);
    const engineOk = result.engine === "deterministic_fallback";
    const hasGlossaryNote = result.notes.some((n) => n.includes("Recognised as a glossary question"));
    const glossary = explanationForInput(text);
    const glossaryRecognised = Boolean(glossary);
    const entry = classifyTurnEntry(1, [], text, result.notes);
    const entryIsClarificationGlossary = entry.kind === "clarification" && entry.clarification?.kind === "glossary";
    const ok = noUpdates && requirementUnchanged && engineOk && hasGlossaryNote && glossaryRecognised && entryIsClarificationGlossary;
    record(
      ok,
      `Glossary question: "${text}"`,
      `updates=${result.updates.length} requirementUnchanged=${requirementUnchanged} engine=${result.engine} glossaryTerm=${glossary?.term ?? "none"} entryKind=${entry.kind}/${entry.clarification?.kind}`,
    );
  }

  console.log("\n--- Regression: substantive statements mentioning the same terms must still extract ---\n");
  const substantiveCases: Array<{ text: string; expectPath: string }> = [
    { text: "We need SASE across 50 sites.", expectPath: "estate.sites" },
    { text: "PCI DSS applies to our payment environment.", expectPath: "constraints.complianceRequirements" },
    { text: "We require an MDR service.", expectPath: "procurement.buying" },
    { text: "Suppliers must explain their SD-WAN design.", expectPath: "procurement.buying" },
  ];
  for (const c of substantiveCases) {
    const result = await extractRequirement(c.text, {});
    const glossarySkipped = result.notes.some((n) => n.includes("Recognised as a glossary question"));
    const hasExpectedPath = result.updates.some((u) => u.path === c.expectPath);
    const ok = !glossarySkipped && hasExpectedPath;
    record(ok, `Substantive statement still extracts: "${c.text}"`, `updates=${JSON.stringify(result.updates.map((u) => u.path))} glossarySkipped=${glossarySkipped}`);
  }

  console.log("\n=== Priority 2: validate model output before it can corrupt quantities ===\n");

  // Deterministic path (Harry's regression battery, extended per the brief).
  const detCases: Array<{ text: string; path: "estate.sites" | "estate.users"; expect: number | null }> = [
    { text: "We need SASE across -5 sites.", path: "estate.sites", expect: null },
    { text: "We need SASE across 12.5 sites.", path: "estate.sites", expect: null },
    { text: "We operate 0 sites.", path: "estate.sites", expect: null },
    { text: "We operate 1 site.", path: "estate.sites", expect: 1 },
    { text: "We operate 15 sites.", path: "estate.sites", expect: 15 },
    { text: "We operate 20,000 sites.", path: "estate.sites", expect: 20000 },
    { text: "We operate 20,001 sites.", path: "estate.sites", expect: null },
    { text: "We have 45 staff across 15 sites.", path: "estate.sites", expect: 15 },
  ];
  for (const c of detCases) {
    const updates = deterministicExtract(c.text);
    const found = updates.find((u) => u.path === c.path)?.value ?? null;
    record(found === c.expect, `Deterministic: "${c.text}" [${c.path}]`, `-> ${JSON.stringify(found)} (expected ${JSON.stringify(c.expect)})`);
  }
  {
    const updates = deterministicExtract("We have 45 staff across 15 sites.");
    const usersFound = updates.find((u) => u.path === "estate.users")?.value ?? null;
    record(usersFound === 45, `Deterministic: "We have 45 staff across 15 sites." [estate.users]`, `-> ${JSON.stringify(usersFound)} (expected 45)`);
  }

  // Model path: synthetic ModelProposal objects reproducing the exact
  // live-evidence sanitisation the model performs on its OWN quote, so this
  // proves validate()'s new rawBuyerText check (the actual Tests 70/71 fix)
  // without needing a live network call.
  console.log("\n--- Model path (synthetic proposals, mirroring live-observed model sanitisation) ---\n");
  const modelCases: Array<{ label: string; text: string; fields: Array<{ path: string; value: unknown; quote?: string | null; reason?: string | null }>; path: string; expect: number | null }> = [
    {
      label: "Model already stripped the sign: '-5 sites' -> {value:5, quote:\"5 sites\"}",
      text: "We need SASE across -5 sites.",
      fields: [{ path: "estate.sites", value: 5, quote: "5 sites", reason: null }],
      path: "estate.sites",
      expect: null,
    },
    {
      label: "Model rounded the decimal: '12.5 sites' -> {value:13, quote:\"12.5 sites\"}",
      text: "We need SASE across 12.5 sites.",
      fields: [{ path: "estate.sites", value: 13, quote: "12.5 sites", reason: null }],
      path: "estate.sites",
      expect: null,
    },
    {
      label: "Model stripped BOTH value and quote: '12.5 sites' -> {value:13, quote:\"13 sites\"}",
      text: "We need SASE across 12.5 sites.",
      fields: [{ path: "estate.sites", value: 13, quote: "13 sites", reason: null }],
      path: "estate.sites",
      expect: null,
    },
    {
      label: "Ordinary whole positive count still passes",
      text: "We operate 45 sites.",
      fields: [{ path: "estate.sites", value: 45, quote: "45 sites", reason: null }],
      path: "estate.sites",
      expect: 45,
    },
  ];
  for (const c of modelCases) {
    const notes: string[] = [];
    const updates = vetModelProposals(c.fields, c.text, notes);
    const found = updates.find((u) => u.path === c.path)?.value ?? null;
    const ok = found === c.expect;
    record(ok, c.label, `-> ${JSON.stringify(found)} (expected ${JSON.stringify(c.expect)}); notes=${JSON.stringify(notes)}`);
  }

  console.log("\n=== Priority 3: surface rejected quantities as a visible activity entry ===\n");

  // Test 72 ("50000000 sites"): 8 raw digits, no comma separator. Runs the
  // deterministic path end-to-end (NUM's digit cap was widened this pass
  // specifically so this reaches validate() instead of matching nothing at
  // all -- see this file's own comment on that fix), and must ALSO
  // preserve the sentence's other valid intent (the SASE mention).
  {
    const text = "We need SASE across 50000000 sites.";
    const result = await extractRequirement(text, {});
    const sitesUpdate = result.updates.find((u) => u.path === "estate.sites");
    const droppedNote = result.notes.find((n) => n.startsWith(QUANTITY_NOT_RECORDED_PREFIX));
    const entry = classifyTurnEntry(1, [], text, result.notes);
    const entryShowsNote = entry.droppedQuantityNote === droppedNote && Boolean(droppedNote);
    const buyingPreserved = result.updates.some((u) => u.path === "procurement.buying");
    const ok = !sitesUpdate && Boolean(droppedNote) && entryShowsNote && buyingPreserved;
    record(
      ok,
      `Test 72 (implausibly large count): "${text}"`,
      `sitesUpdate=${JSON.stringify(sitesUpdate)} droppedNote=${JSON.stringify(droppedNote)} entryDroppedNote=${JSON.stringify(entry.droppedQuantityNote)} buyingPreserved=${buyingPreserved}`,
    );
  }

  // Test 73 ("quite a few sites, maybe a dozen or so"): no digits anywhere
  // in the sentence, so the deterministic path never proposes a site count
  // at all (nothing to invent -- that half is a trivial pass), but the
  // requirement is really about the MODEL path: a model resolving "a dozen
  // or so" to a clean integer would be inventing precision the buyer
  // explicitly hedged away. Proved directly against vetModelProposals()
  // with a synthetic proposal reproducing that plausible model reading,
  // same technique as the Priority 2 synthetic model-path cases above.
  {
    const text = "We need SASE across quite a few sites, maybe a dozen or so.";
    const detResult = await extractRequirement(text, {});
    const detNoSiteCount = !detResult.updates.some((u) => u.path === "estate.sites");
    const detBuyingPreserved = detResult.updates.some((u) => u.path === "procurement.buying");
    record(
      detNoSiteCount && detBuyingPreserved,
      `Test 73, deterministic path (no digits -- nothing to invent, SASE intent preserved): "${text}"`,
      `updates=${JSON.stringify(detResult.updates.map((u) => u.path))}`,
    );

    const notes: string[] = [];
    const modelUpdates = vetModelProposals(
      [{ path: "estate.sites", value: 12, quote: "a dozen or so", reason: null }],
      text,
      notes,
    );
    const modelSitesUpdate = modelUpdates.find((u) => u.path === "estate.sites");
    const modelDroppedNote = notes.find((n) => n.startsWith(QUANTITY_NOT_RECORDED_PREFIX));
    const entry = classifyTurnEntry(1, [], text, notes);
    const entryShowsNote = entry.droppedQuantityNote === modelDroppedNote && Boolean(modelDroppedNote);
    record(
      !modelSitesUpdate && Boolean(modelDroppedNote) && entryShowsNote,
      `Test 73, model path (synthetic proposal: "a dozen or so" -> value 12): "${text}"`,
      `modelSitesUpdate=${JSON.stringify(modelSitesUpdate)} droppedNote=${JSON.stringify(modelDroppedNote)} entryDroppedNote=${JSON.stringify(entry.droppedQuantityNote)}`,
    );
  }

  console.log("\n=== Priority 5a: 'in 3 months' relative timeline ===\n");
  {
    const text = "We need this live in 3 months.";
    const updates = deterministicExtract(text);
    const timeline = updates.find((u) => u.path === "constraints.timeline")?.value ?? null;
    const looksRelativeNotAbsolute = typeof timeline === "string" && /3\s*months?/i.test(timeline) && !/\b20\d\d\b/.test(timeline);
    record(Boolean(timeline) && looksRelativeNotAbsolute, `Deterministic: "${text}" [procurement.timeline]`, `-> ${JSON.stringify(timeline)}`);
  }

  console.log("\n=== Priority 5b: dual-circuit resilience answer ===\n");
  {
    const text = "No, dual-circuit isn't required.";
    const recognised = isDualCircuitNotRequiredAnswer(text);
    const entry = classifyTurnEntry(1, [], text, [], true);
    const entryOk = entry.kind === "clarification" && entry.clarification?.kind === "resilience_answer" && entry.clarification?.explanation === RESILIENCE_ANSWER_EXPLANATION;
    const entryInactiveNoQuestion = classifyTurnEntry(1, [], text, [], false);
    // With no q-resilience question currently active, this exact phrase
    // must NOT be misread as a resilience answer (it should fall through
    // to no_change / another classifier) — the recognition is scoped to
    // "this question is currently on screen", not to the words alone.
    const inactiveOk = entryInactiveNoQuestion.clarification?.kind !== "resilience_answer";
    record(recognised && entryOk && inactiveOk, `Dual-circuit answer: "${text}"`, `recognised=${recognised} entryKind=${entry.kind}/${entry.clarification?.kind} inactiveKind=${entryInactiveNoQuestion.kind}/${entryInactiveNoQuestion.clarification?.kind}`);
  }

  console.log("\n=== Priority 6: retraction wording + correction sequence (Test 16 extended) ===\n");
  {
    // isRetractionRequest() in isolation, on the brief's own exact phrase —
    // this is the check that was FAILING before this pass's fix (see this
    // file's own comment on RETRACTION_SELF_REFERENCE): "i just said" sat
    // one filler word outside the old "i said"/"we said" pattern.
    const msg2 = "Ignore what I just said, forget the 15 sites.";
    const recognised = isRetractionRequest(msg2);
    record(recognised, `isRetractionRequest recognises the brief's exact phrase: "${msg2}"`, `-> ${recognised}`);

    // Full three-message sequence through the REAL pipeline this preview
    // itself runs (extractRequirement -> mergeUpdates -> computeSessionChanges
    // -> classifyTurnEntry), proving: (1) the earlier fact is retained, (2)
    // the honest retraction wording is shown instead of a bare no-op, and
    // (3) a later correction still updates the ledger to 12.
    let facts: Array<Record<string, unknown>> = [];
    let cycle = 0;

    const turn = async (text: string) => {
      cycle++;
      const before = facts as never;
      const result = await extractRequirement(text, {});
      const merged = mergeUpdates(before, result.updates, cycle, "extract");
      const changes = computeSessionChanges(before, merged.facts, result.updates, cycle);
      facts = merged.facts as never;
      return { entry: classifyTurnEntry(cycle, changes, text, result.notes), facts };
    };

    const t1 = await turn("We need a SASE service for 15 sites.");
    const sitesAfter1 = (t1.facts.find((f) => (f as { path?: string }).path === "estate.sites") as { value?: unknown } | undefined)?.value;
    record(sitesAfter1 === 15, "Turn 1: 'We need a SASE service for 15 sites.' records 15", `estate.sites=${JSON.stringify(sitesAfter1)}`);

    const t2 = await turn(msg2);
    const sitesAfter2 = (t2.facts.find((f) => (f as { path?: string }).path === "estate.sites") as { value?: unknown } | undefined)?.value;
    const retractionShown =
      t2.entry.kind === "clarification" &&
      t2.entry.clarification?.kind === "retraction" &&
      t2.entry.clarification?.explanation === RETRACTION_FALLBACK_EXPLANATION;
    record(
      sitesAfter2 === 15 && retractionShown,
      "Turn 2: retraction acknowledged honestly, earlier fact (15) retained",
      `estate.sites=${JSON.stringify(sitesAfter2)} entryKind=${t2.entry.kind}/${t2.entry.clarification?.kind} explanationMatches=${t2.entry.clarification?.explanation === RETRACTION_FALLBACK_EXPLANATION}`,
    );

    const t3 = await turn("We actually have 12 sites.");
    const sitesAfter3 = (t3.facts.find((f) => (f as { path?: string }).path === "estate.sites") as { value?: unknown } | undefined)?.value;
    record(sitesAfter3 === 12, "Turn 3: correction updates the ledger to 12, not 15", `estate.sites=${JSON.stringify(sitesAfter3)}`);
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
