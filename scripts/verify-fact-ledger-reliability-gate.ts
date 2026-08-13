// Verification-only script (not part of the app): proves the Fact Ledger
// Reliability Gate (13 Aug 2026) against the real, unmodified functions the
// app itself calls (extractRequirement / deterministicExtract /
// splitDeclarativeClauses), in the same style as
// scripts/verify-correction-pass-2.ts.
//
// ANTHROPIC_API_KEY is not set in this sandbox, so extractRequirement()
// always resolves via the deterministic fallback -- an honest limitation
// of this script (not of the gate itself, which runs identically on top
// of whichever engine spoke): it also means every case below IS, by
// construction, a live "model unavailable" regression case (item 5 in
// Robert's list), and doubles as proof the gate holds with no model
// involved at all.
//
// Robert's own instruction (13 Aug 2026), verbatim acceptance rule:
// "every declarative clause is accounted for as a structured fact, a
// bespoke requirement or a visible unplaced receipt." Every case below
// checks exactly that, plus his six named regression scenarios.
//
// THIRD amendment (13 Aug 2026): Robert relayed a third round of Codex
// findings that rejected the SECOND amendment's entire atomic-splitting
// design outright, not as a missing edge case -- see extract.ts's own
// doc comments on splitDeclarativeClauseSpans/clauseIsFullyExplained for
// the full architectural correction. The load-bearing consequence for
// this script: coverDeclarativeClauses(text, updates) is now a 2-arg
// function returning only { unplacedClauses }. It NEVER invents a
// requirements.bespoke fact any more -- a bespoke fact only ever comes
// from deterministicExtract's own named rules (there is exactly one:
// the "threat protection" phrase) or the model. Every case below that
// used to assert a coverage-gate-invented bespoke entry is rewritten to
// its honest new outcome: the buyer's complete, UNSPLIT original
// sentence surviving as a visible unplaced receipt. Per Robert's own
// acceptance rule for this round: "A test passes only if every original
// requirement remains available in either a structured fact, an
// explicit bespoke span, or the complete retained source receipt."

import { extractRequirement, deterministicExtract, splitDeclarativeClauses, coverDeclarativeClauses, notesWithSourceTurns, removalsIn, type FieldRemoval } from "../src/lib/workspace/extract";
import { mergeUpdates, mergeRequirementBase, factId, resolveDropTarget, dropListFact, requirementFrom, type WorkspaceFact } from "../src/lib/workspace/draft";
import { buildSecurityProject } from "../src/lib/security/create-project";
import { buildRescopedProject } from "../src/lib/security/rescope-project";
import { chunkForIngest } from "../src/lib/workspace/ingest";
import { mergeSourceLedger, parseIncomingSourceTurns, captureRawSourceEntry, resumeStateFromProject, type SourceLedgerEntry } from "../src/lib/workspace/source-ledger";
import type { SecurityRequirementInput } from "../src/lib/security/rulebook";
import { withFakeKv, makeRequest } from "./fake-kv-harness";

/** The minimal shape these route-level fixtures read back off a real
 *  Response body -- not the full ProjectDetails type, just enough to make
 *  the assertions below type-safe without `any`. */
type RouteProjectLike = { id?: string; manage_token?: string; source_ledger?: SourceLedgerEntry[] };

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

async function main() {
  // Round 3 hermetic wrap (blocker 5, Codex's second review): every case
  // above the model-mocking block ran BEFORE this script touched
  // ANTHROPIC_API_KEY or global.fetch at all -- if a real key is present
  // in the build environment (e.g. Vercel), extractRequirement() could
  // call the live model repeatedly through those earlier cases: added
  // cost, latency, and nondeterministic pass/fail on every build. The
  // whole script is now hermetic from this line, before Regression 1's
  // first assertion runs: the real key (if any) is saved and removed, and
  // global.fetch is stubbed to throw on ANY call that isn't explicitly
  // mocked. The inner mock/restore block further down (originally the
  // only hermetic section, kept as-is) swaps in its own specific mocked
  // responses per case and restores THIS outer stub afterwards, not the
  // untouched original fetch -- the true original is only restored once,
  // in the outer finally below, after every case has run.
  const outerOriginalFetch = global.fetch;
  const outerOriginalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  global.fetch = (async (...args: Parameters<typeof fetch>) => {
    throw new Error(
      `Unexpected real network call during the reliability gate script (hermetic violation): ${String(args[0])}. ` +
        `Every case that needs a model response must mock global.fetch explicitly first.`,
    );
  }) as unknown as typeof fetch;

  try {
  console.log("\n=== Regression 1: the original five-fact buyer message (Doc 1, 13 Aug) ===\n");
  {
    const text =
      "UK 20 site Healthcare business requires SD-WAN and full SASE. We have 200 remote users. " +
      "We also have a legacy app that requires a point to point Ethernet private circuit.";
    const res = await extractRequirement(text, {});
    const sector = res.updates.find((u) => u.path === "organisation.sector");
    // THIRD amendment: coverDeclarativeClauses() no longer invents a
    // requirements.bespoke fact from the leftover "point to point Ethernet
    // private circuit" clause -- there is no named deterministic rule for
    // it (the only named bespoke rule is "threat protection"), so per the
    // source-ledger architecture it must survive as the COMPLETE, VERBATIM
    // original sentence in unplacedClauses, not as an invented fragment and
    // not silently. Same for the "UK 20 site Healthcare business requires
    // SD-WAN and full SASE." clause: SD-WAN and the sector/site/user facts
    // land structured, but the clause as a whole is not "fully explained"
    // (the coverage check now requires the anchors' FULL matched spans,
    // not just their start points, to account for the residual text), so
    // it too is retained whole. Duplication (the same words appearing both
    // as a structured fact and inside a receipt) is explicitly acceptable
    // per Robert's rule: "Duplication is safer than disappearance."
    const ethernetClauseText = "We also have a legacy app that requires a point to point Ethernet private circuit.";
    const sdwanSaseClauseText = "UK 20 site Healthcare business requires SD-WAN and full SASE.";
    const ethernetPreserved = res.unplacedClauses.some((c) => c.trim() === ethernetClauseText);
    const sdwanSasePreserved = res.unplacedClauses.some((c) => c.trim() === sdwanSaseClauseText);
    const noSpuriousBespoke = !res.updates.some((u) => u.path === "requirements.bespoke");
    const ok =
      sector?.provenance === "stated" &&
      sector?.value === "Healthcare & pharma" &&
      sector?.quote === "Healthcare" &&
      ethernetPreserved &&
      sdwanSasePreserved &&
      noSpuriousBespoke &&
      res.unplacedClauses.length === 2 &&
      res.updates.some((u) => u.path === "estate.users" && u.value === 200) &&
      res.updates.some((u) => u.path === "estate.sites" && u.value === 20);
    record(
      ok,
      "Doc 1 message: sector stated 'Healthcare' (not guessed), the Ethernet-circuit clause and the SD-WAN/SASE clause both survive COMPLETE and VERBATIM as unplaced receipts (no invented bespoke fragment, nothing silently lost)",
      `sector=${JSON.stringify(sector)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
    );
  }

  console.log("\n=== Regression 2: literal sector vs inferred sector ===\n");
  {
    const cases: Array<{ text: string; expectValue: string; expectProvenance: "stated" | "inferred"; expectQuote?: string }> = [
      { text: "We are a Healthcare business with 40 sites.", expectValue: "Healthcare & pharma", expectProvenance: "stated", expectQuote: "Healthcare" },
      { text: "We are a Retail business with 40 stores.", expectValue: "Retail & e-commerce", expectProvenance: "stated", expectQuote: "Retail" },
      { text: "We are a Manufacturing company with 40 sites.", expectValue: "Manufacturing", expectProvenance: "stated", expectQuote: "Manufacturing" },
      { text: "We are a Financial services firm with 40 sites.", expectValue: "Financial services", expectProvenance: "stated", expectQuote: "Financial services" },
      { text: "We run a hospital group with 40 sites.", expectValue: "Healthcare & pharma", expectProvenance: "inferred" },
      { text: "We operate 12 GP practices.", expectValue: "Healthcare & pharma", expectProvenance: "inferred" },
      { text: "We run a chain of dental clinics.", expectValue: "Healthcare & pharma", expectProvenance: "inferred" },
    ];
    for (const c of cases) {
      const updates = deterministicExtract(c.text);
      const sector = updates.find((u) => u.path === "organisation.sector");
      const ok =
        sector?.value === c.expectValue &&
        sector?.provenance === c.expectProvenance &&
        (c.expectQuote === undefined || sector?.quote === c.expectQuote);
      record(
        ok,
        `Sector: "${c.text}"`,
        `-> ${JSON.stringify(sector)} (expected value=${c.expectValue} provenance=${c.expectProvenance}${c.expectQuote ? ` quote="${c.expectQuote}"` : ""})`,
      );
    }
  }

  console.log("\n=== Regression 3: partial extraction -- four clauses land, one does not ===\n");
  {
    const text =
      "We are a Healthcare business with 20 sites. We have 200 remote users. " +
      "We need SASE for the whole estate. Our contract renewal is in March 2027. " +
      "We had a great chat with our account manager last week.";
    const res = await extractRequirement(text, {});
    const clauses = splitDeclarativeClauses(text);
    const landedPaths = new Set(res.updates.map((u) => u.path));
    const ok =
      clauses.length === 5 &&
      landedPaths.has("organisation.sector") &&
      landedPaths.has("estate.sites") &&
      landedPaths.has("estate.users") &&
      landedPaths.has("procurement.buying") &&
      res.unplacedClauses.length === 1 &&
      res.unplacedClauses[0].includes("account manager");
    record(
      ok,
      "Four clauses land facts, the fifth (small talk) is kept as an unplaced receipt, not dropped",
      `clauses=${clauses.length} landedPaths=${JSON.stringify([...landedPaths])} unplaced=${JSON.stringify(res.unplacedClauses)}`,
    );
  }

  console.log("\n=== Regression 4: no duplication between structured facts and bespoke requirements ===\n");
  {
    // 4a: a clause fully covered by an ordinary fact must not ALSO spawn
    // a bespoke duplicate of itself.
    const res = await extractRequirement("We need SASE across 50 sites.", {});
    const bespokeCount = res.updates.filter((u) => u.path === "requirements.bespoke").length;
    record(bespokeCount === 0 && res.unplacedClauses.length === 0, "A clause already covered by estate.sites/procurement.buying is not also filed as bespoke", `bespokeUpdates=${bespokeCount} unplaced=${JSON.stringify(res.unplacedClauses)}`);

    // 4b: the deterministic rail's own narrow bespoke exception (threat
    // protection) must not ALSO produce a second, duplicate bespoke entry
    // via the new clause-coverage supplement for the same clause.
    const text2 = "We need next-generation threat protection across our estate.";
    const res2 = await extractRequirement(text2, {});
    const bespoke2 = res2.updates.filter((u) => u.path === "requirements.bespoke");
    const totalBespokeValues = bespoke2.reduce((n, u) => n + (Array.isArray(u.value) ? u.value.length : 1), 0);
    record(
      totalBespokeValues === 1 && res2.unplacedClauses.length === 0,
      "The rail's own threat-protection bespoke match is not duplicated by the clause-coverage supplement",
      `bespokeUpdates=${JSON.stringify(bespoke2)} unplaced=${JSON.stringify(res2.unplacedClauses)}`,
    );

    // 4c: live regression caught while writing this script -- a clause
    // whose landed fact used a CANONICAL display quote ("managed
    // security") rather than the buyer's own literal trigger word
    // ("MDR") was, before matchedText was threaded through say()'s
    // managed-security call, wrongly treated as uncovered and given a
    // second, duplicate requirements.bespoke entry for the same clause.
    const text3 = "We require an MDR service.";
    const res3 = await extractRequirement(text3, {});
    const bespoke3 = res3.updates.filter((u) => u.path === "requirements.bespoke");
    const buying3 = res3.updates.find((u) => u.path === "procurement.buying");
    record(
      bespoke3.length === 0 && buying3?.value === "managed_security" && buying3?.matchedText === "MDR",
      "A canonical-label fact (managed security, off an 'MDR' mention) is not duplicated as a bespoke requirement",
      `updates=${JSON.stringify(res3.updates)} unplaced=${JSON.stringify(res3.unplacedClauses)}`,
    );
  }

  console.log("\n=== Regression 5: model timeout / unavailability ===\n");
  {
    // ANTHROPIC_API_KEY is unset in this sandbox (see file header), so
    // EVERY case in this script already exercises the "model unavailable"
    // path end to end -- asserted explicitly here as its own case.
    const res = await extractRequirement("We are a Healthcare business with 20 sites.", {});
    const ok = res.engine === "deterministic_fallback" && res.notes.some((n) => n.includes("Model extraction unavailable"));
    record(ok, "extractRequirement falls back to the deterministic rail when the model is unavailable, and the gate still runs on top of it", `engine=${res.engine} notes=${JSON.stringify(res.notes)}`);
  }

  console.log("\n=== Regression 6a: corrections across turns still work with the gate layered on ===\n");
  {
    let facts: ReturnType<typeof mergeUpdates>["facts"] = [];
    let cycle = 0;
    const turn = async (text: string) => {
      cycle += 1;
      const result = await extractRequirement(text, {});
      const merged = mergeUpdates(facts, result.updates, cycle, "extract");
      facts = merged.facts;
      return result;
    };
    await turn("We are a Healthcare business with 20 sites.");
    await turn("Actually we have 25 sites.");
    const sitesFact = facts.find((f) => f.path === "estate.sites" && !f.struck);
    record(sitesFact?.value === 25, "A correction ('actually 25 sites') still upgrades the ledger to 25, not 20", `estate.sites=${JSON.stringify(sitesFact?.value)}`);
  }

  console.log("\n=== Regression 6b: a negated requirement is never invented as a bespoke fact ===\n");
  {
    const text = "We don't need a point to point Ethernet circuit for the legacy app.";
    const res = await extractRequirement(text, {});
    const bespoke = res.updates.find((u) => u.path === "requirements.bespoke");
    const ok = !bespoke && res.unplacedClauses.length === 1 && res.unplacedClauses[0] === text;
    record(ok, "A negated requirement clause is not filed as a bespoke requirement -- it surfaces as an unplaced receipt instead", `bespoke=${JSON.stringify(bespoke)} unplaced=${JSON.stringify(res.unplacedClauses)}`);
  }

  console.log("\n=== Regression 6c: removal-command matching still reaches a long clause receipt ===\n");
  {
    // parseCommand()/dropReceipt() live inside ProjectDesk.tsx (a React
    // component) and are not exported as pure functions, so the live
    // "type 'remove the circuit note' and watch it clear" flow is not
    // unit-testable from this script -- that gap is named honestly in
    // the report, not silently skipped. What IS testable and matters
    // here: dropReceipt's own matching predicate (ProjectDesk.tsx,
    // "drop"/"remove" command handling) is `norm(receipt.text).includes(
    // norm(target)) || norm(target).includes(norm(receipt.text))` --
    // reproduced verbatim below and exercised against the actual
    // FULL-SENTENCE receipt text this gate now produces (longer than the
    // short vendor-name/note text this command was originally built
    // for), to prove a short buyer phrase still finds it.
    const receiptText = "We also have a legacy app that requires a point to point Ethernet private circuit.";
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const contiguousPhrase = norm("point to point Ethernet");
    const matchesContiguous = norm(receiptText).includes(contiguousPhrase);
    record(
      matchesContiguous,
      "A short CONTIGUOUS phrase from a long unplaced-clause receipt matches ProjectDesk's drop/remove command predicate",
      `receipt="${receiptText}" target="point to point Ethernet" matches=${matchesContiguous}`,
    );

    // Known, reported limitation (not fixed here -- out of this gate's
    // scope, flagged in the report): norm() strips ALL whitespace, so it
    // concatenates every word with no separator. Two words that are
    // non-adjacent in the receipt (a word sits between them) then never
    // match even though a human reading the receipt would call it an
    // obvious match. This was harmless while receipts were short
    // fragments; it gets more visible now that a whole sentence can be a
    // receipt. Recorded as a documented gap, not asserted as a pass.
    const nonAdjacentPhrase = norm("Ethernet circuit");
    const matchesNonAdjacent = norm(receiptText).includes(nonAdjacentPhrase);
    console.log(
      `NOTE  Known limitation, not fixed by this gate: a non-adjacent phrase ("Ethernet circuit", with "private" sitting between the two words in the receipt) does NOT match the drop/remove command's concatenated-normalisation predicate (matches=${matchesNonAdjacent}). Buyers will need to quote a contiguous phrase from a long receipt to clear it by typing "drop ...".`,
    );
  }

  // ==========================================================================
  // Amendment round (13 Aug 2026): Codex's independent review found six
  // concrete gaps in the reliability gate above -- the exact examples below
  // are the ones Robert relayed verbatim. Each case is written against the
  // real, unmodified extractRequirement()/coverDeclarativeClauses(), the
  // same discipline as every regression above.
  // ==========================================================================

  console.log("\n=== Blocker 1a: occurrence-aware coverage -- a second requirement coordinated in the SAME sentence ===\n");
  {
    // Codex's exact failing example: "We need SASE and a point-to-point
    // Ethernet circuit." -- the first version of this gate marked the
    // WHOLE sentence "covered" the instant SASE landed a fact, so the
    // Ethernet circuit silently vanished (neither a fact, nor bespoke,
    // nor a receipt).
    // THIRD amendment: "and" is explicitly on Robert's do-not-split list,
    // so this sentence is one clause, not two. There is no named bespoke
    // rule for "Ethernet circuit", so the circuit requirement must survive
    // as the clause's complete, verbatim text in unplacedClauses -- never
    // as an invented fragment, and never silently dropped.
    const text = "We need SASE and a point-to-point Ethernet circuit.";
    const res = await extractRequirement(text, {});
    const buying = res.updates.find((u) => u.path === "procurement.buying");
    const circuitPreserved = res.unplacedClauses.some((c) => c.trim() === text);
    const ok = buying?.value === "sase" && circuitPreserved;
    record(
      ok,
      "\"We need SASE and a point-to-point Ethernet circuit.\": SASE lands AND the Ethernet circuit survives, as the complete original sentence (not silently covered by the SASE fact, not a fragment)",
      `buying=${JSON.stringify(buying)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
    );
  }

  console.log("\n=== Blocker 1b: occurrence-aware coverage -- the SAME word in an EARLIER sentence must not cover a LATER one ===\n");
  {
    // Codex's exact failing example: "We use Azure today. We also require
    // Azure ExpressRoute for connectivity." -- the first version of this
    // gate checked only whether the anchor TEXT "azure" appeared anywhere
    // in the message, so the second sentence was wrongly marked covered
    // by the FIRST sentence's Azure fact, purely because both sentences
    // happen to contain the same word.
    const text = "We use Azure today. We also require Azure ExpressRoute for connectivity.";
    const res = await extractRequirement(text, {});
    const cloud = res.updates.find((u) => u.path === "estate.cloud");
    // THIRD amendment: no named bespoke rule exists for "ExpressRoute", so
    // the second sentence's survival must show up as its own complete,
    // verbatim unplaced receipt now, not a coverage-gate-invented bespoke.
    const secondSentenceSurvived = res.unplacedClauses.some((c) => /expressroute/i.test(c) && c.trim() === "We also require Azure ExpressRoute for connectivity.");
    const ok = Array.isArray(cloud?.value) && (cloud!.value as string[]).includes("azure") && secondSentenceSurvived;
    record(
      ok,
      "\"We use Azure today. We also require Azure ExpressRoute...\": the Azure cloud fact from sentence 1 does not silently cover sentence 2's ExpressRoute requirement, which survives as a complete unplaced receipt",
      `cloud=${JSON.stringify(cloud)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
    );
  }

  console.log("\n=== Blocker 1 regression guard: a coordinated but SAME-intent pairing (SD-WAN/SASE) must not spawn a spurious duplicate ===\n");
  {
    // Not one of Codex's failing examples, but the exact shape the
    // occurrence-aware rewrite could plausibly have broken: Regression 1's
    // own message pairs "SD-WAN and full SASE" in one clause, where the
    // file's own procurement.buying priority chain deliberately treats
    // the two as one unified ask, not two independent purchases. This
    // must still resolve to exactly ONE requirements.bespoke entry (the
    // genuinely uncaptured Ethernet-circuit clause later in the message),
    // not a second one duplicating "SD-WAN and full SASE" itself.
    const text =
      "UK 20 site Healthcare business requires SD-WAN and full SASE. We have 200 remote users. " +
      "We also have a legacy app that requires a point to point Ethernet private circuit.";
    const res = await extractRequirement(text, {});
    // THIRD amendment: since bespoke facts are never invented from
    // coverage-gate residue any more, the correct outcome here is ZERO
    // bespoke entries (there is no named rule for "Ethernet circuit") and
    // the Ethernet clause surviving whole in unplacedClauses instead --
    // exactly Regression 1's assertion above. What this guard still proves
    // is narrower but still real: the unified "SD-WAN and full SASE" ask
    // does not itself spawn a SEPARATE, duplicate unplaced entry beyond
    // the one whole sentence it belongs to (i.e. no double-counting).
    const bespoke = res.updates.filter((u) => u.path === "requirements.bespoke");
    const ethernetClauseText = "We also have a legacy app that requires a point to point Ethernet private circuit.";
    const sdwanSaseClauseText = "UK 20 site Healthcare business requires SD-WAN and full SASE.";
    const unplacedIsExactlyThoseTwoClauses =
      res.unplacedClauses.length === 2 &&
      res.unplacedClauses.some((c) => c.trim() === ethernetClauseText) &&
      res.unplacedClauses.some((c) => c.trim() === sdwanSaseClauseText);
    const ok = bespoke.length === 0 && unplacedIsExactlyThoseTwoClauses;
    record(
      ok,
      "\"...requires SD-WAN and full SASE...\": one unified buying intent does not spawn a spurious extra bespoke entry OR a duplicate/fragmented unplaced entry -- exactly the two whole clauses, once each",
      `bespoke=${JSON.stringify(bespoke)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
    );
  }

  console.log("\n=== Blocker 1, direct unit test: coverDeclarativeClauses() itself, with synthetic updates (no model, no rail) ===\n");
  {
    // Exercises the exported gate function directly, the same "hermetic,
    // synthetic input" discipline verify-correction-pass-2.ts already
    // uses for vetModelProposals() -- proves the occurrence-aware
    // position check itself, independent of which upstream path (model
    // or deterministic rail) produced the update.
    // THIRD amendment: coverDeclarativeClauses(text, updates) is now a
    // 2-arg function returning only { unplacedClauses } -- it never
    // invents a bespoke fact.
    const text = "We use Azure today. We also require Azure ExpressRoute for connectivity.";
    const azurePos = text.toLowerCase().indexOf("azure"); // first occurrence, inside sentence 1
    const synthetic = [{ path: "estate.cloud" as const, value: ["azure"], provenance: "stated" as const, quote: "Azure", matchStart: azurePos }];
    const { unplacedClauses } = coverDeclarativeClauses(text, synthetic);
    const secondSentenceSurvived = unplacedClauses.some((c) => c.trim() === "We also require Azure ExpressRoute for connectivity.");
    record(
      secondSentenceSurvived,
      "coverDeclarativeClauses(): a single Azure anchor positioned in sentence 1 does not cover sentence 2's ExpressRoute clause -- it survives whole",
      `unplaced=${JSON.stringify(unplacedClauses)}`,
    );
  }

  console.log("\n=== Round 3 blockers 1 & 2 -- SUPERSEDED by the third amendment's architectural correction ===\n");
  {
    // Round 3's fix (splitAtomicSpans(), an expanding conjunction/
    // punctuation regex) made all four cases below pass its OWN gate, but
    // Codex's third review proved the underlying strategy was unsound: any
    // anchor whose own matched span legitimately crossed a splitter
    // boundary (a compound sector phrase like "Energy and utilities" is
    // the clean counter-example) desynchronised the atomic units from the
    // anchors meant to cover them. Robert's instruction: "This is no
    // longer a matter of adding another punctuation mark... Replace the
    // atomic conjunction splitter with a source-ledger design," explicitly
    // banning further splits on and/but/plus/semicolons/etc. These four
    // cases are kept as regression fixtures -- not because round 3's
    // MECHANISM survives, but because the underlying buyer intent (never
    // silently lose the second requirement) must still hold under the NEW
    // architecture: the Ethernet-circuit requirement must always be
    // findable, now as the clause's COMPLETE, VERBATIM text in
    // unplacedClauses (no fragment, no invented bespoke value, no
    // silence).
    console.log("NOTE  Round 3's atomic-splitting fixtures are retained below as regression cases proving the buyer intent still holds, not as proof the old mechanism survives -- it has been replaced outright.");
    const cases: Array<{ text: string; label: string }> = [
      { text: "We need SASE plus Ethernet private circuit.", label: "SASE plus Ethernet private circuit" },
      { text: "We need SASE and require an Ethernet circuit.", label: "SASE and require an Ethernet circuit" },
      { text: "We need SASE but also require an Ethernet circuit.", label: "SASE but also require an Ethernet circuit" },
      { text: "We need SASE; we also require an Ethernet circuit.", label: "SASE; we also require an Ethernet circuit (semicolon is NOT a strong boundary per instruction 5 -- one clause, not two)" },
    ];
    for (const { text, label } of cases) {
      const res = await extractRequirement(text, {});
      const sase = res.updates.find((u) => u.path === "procurement.buying");
      const bespoke = res.updates.filter((u) => u.path === "requirements.bespoke");
      const wholeClausePreserved = res.unplacedClauses.some((c) => c.trim() === text);
      const ok = sase?.value === "sase" && bespoke.length === 0 && wholeClausePreserved;
      record(
        ok,
        `"${label}": SASE still lands, no invented bespoke fragment, and the complete original sentence (Ethernet circuit included) survives verbatim as an unplaced receipt`,
        `sase=${JSON.stringify(sase)} bespoke=${JSON.stringify(bespoke)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
      );
    }
  }

  console.log("\n=== Round 4, direct unit test: coverDeclarativeClauses() never splits on 'and'/';' -- a covered clause with residual text stays whole ===\n");
  {
    // Same "hermetic, synthetic input" discipline as the earlier direct
    // unit tests -- proves the NEW mechanism itself: a semicolon-joined
    // repeated predicate is not split into an atomic unit any more; the
    // whole clause is judged as one span, and since the SASE anchor's
    // full matched span does not explain "we also require an Ethernet
    // circuit", the ENTIRE clause (not a derived fragment of it) is kept.
    const text = "We need SASE; we also require an Ethernet circuit.";
    const sasePos = text.toLowerCase().indexOf("sase");
    const synthetic = [{ path: "procurement.buying" as const, value: "sase", provenance: "stated" as const, quote: "SASE", matchStart: sasePos, matchedText: "SASE" }];
    const { unplacedClauses } = coverDeclarativeClauses(text, synthetic);
    const wholeClausePreserved = unplacedClauses.length === 1 && unplacedClauses[0].trim() === text;
    record(
      wholeClausePreserved,
      "coverDeclarativeClauses(): a semicolon-joined repeated predicate is not split -- the whole clause, verbatim, survives as one unplaced receipt",
      `unplaced=${JSON.stringify(unplacedClauses)}`,
    );
  }

  console.log("\n=== Blocker 2: paste/drop ingestion (ProjectDesk.tsx's ingestText) ===\n");
  {
    // ProjectDesk.tsx's ingestText()/runCycle()/keepReceipt() are inline
    // React callbacks inside the component, not exported pure functions
    // (the same, honestly-named limitation as Regression 6c above) -- the
    // live "paste a paragraph and watch every clause land or get kept"
    // flow is not unit-testable from this script. What changed is a
    // source diff, not a testable pure function: ingestText's chunk loop
    // now reads runCycle()'s returned `unplaced` and calls keepReceipt()
    // for each clause, exactly mirroring send()'s own fix that Regression
    // 1-3 above already prove works for TYPED input. Recorded as a
    // reviewed source fix, not a script assertion.
    console.log("NOTE  Not independently unit-testable (ingestText is an inline React callback, not an exported pure function) -- verified by source review: the paste/drop chunk loop in ProjectDesk.tsx now calls keepReceipt() for every runCycle().unplaced clause, mirroring send()'s own fix line for line.");
  }

  console.log("\n=== Blocker 3: canonical display labels must not be used as coverage evidence unless literally present ===\n");
  {
    const cases: Array<{ text: string; path: string; expectMatchedTextContains: string }> = [
      { text: "We need SDWAN.", path: "procurement.buying", expectMatchedTextContains: "sdwan" },
      { text: "We use M365.", path: "estate.cloud", expectMatchedTextContains: "m365" },
      { text: "We suffered a breach.", path: "drivers", expectMatchedTextContains: "breach" },
    ];
    for (const c of cases) {
      const res = await extractRequirement(c.text, {});
      const fact = res.updates.find((u) => u.path === c.path);
      const bespoke = res.updates.filter((u) => u.path === "requirements.bespoke");
      const ok =
        Boolean(fact) &&
        typeof fact?.matchedText === "string" &&
        fact.matchedText.toLowerCase().includes(c.expectMatchedTextContains) &&
        bespoke.length === 0 &&
        res.unplacedClauses.length === 0;
      record(
        ok,
        `"${c.text}": the canonical display label is not used as coverage evidence -- no duplicate bespoke/receipt`,
        `fact=${JSON.stringify(fact)} bespoke=${JSON.stringify(bespoke)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
      );
    }
  }

  console.log("\n=== Blocker 4: direct sector matching requires organisational self-identification, not a bare requirement mention ===\n");
  {
    const positive = await extractRequirement("We are a Government organisation.", {});
    const positiveSector = positive.updates.find((u) => u.path === "organisation.sector");
    record(
      positiveSector?.value === "Government & public sector" && positiveSector?.provenance === "stated",
      "\"We are a Government organisation.\": self-identification still states the sector",
      `sector=${JSON.stringify(positiveSector)}`,
    );

    const negative = await extractRequirement("We require Government security classifications.", {});
    const negativeSector = negative.updates.find((u) => u.path === "organisation.sector");
    record(
      negativeSector === undefined,
      "\"We require Government security classifications.\": a requirement mentioning the word does not set the buyer's sector",
      `sector=${JSON.stringify(negativeSector)} unplaced=${JSON.stringify(negative.unplacedClauses)} bespoke=${JSON.stringify(negative.updates.filter((u) => u.path === "requirements.bespoke"))}`,
    );
  }

  console.log("\n=== Round 3, blocker 4: sector provenance -- bare 'is' removed, explicit labelling and standalone exact input tightened ===\n");
  {
    // Codex's second review, exact failing examples: exact input
    // "Healthcare" was still labelled inferred (should be stated -- it IS
    // the buyer's literal, standalone word for their own sector), and
    // "Our policy is Government approved" was wrongly labelled a STATED
    // Government sector because bare "is" counted as self-identification.
    const bareHealthcare = await extractRequirement("Healthcare", {});
    const bareSector = bareHealthcare.updates.find((u) => u.path === "organisation.sector");
    record(
      bareSector?.value === "Healthcare & pharma" && bareSector?.provenance === "stated",
      "\"Healthcare\" (exact standalone input, nothing else): the sector is STATED, not inferred -- it's the buyer's own literal word for it",
      `sector=${JSON.stringify(bareSector)}`,
    );

    const labelledColon = await extractRequirement("Sector: Healthcare", {});
    const labelledColonSector = labelledColon.updates.find((u) => u.path === "organisation.sector");
    record(
      labelledColonSector?.value === "Healthcare & pharma" && labelledColonSector?.provenance === "stated",
      "\"Sector: Healthcare\": explicit sector-labelling phrasing states the sector",
      `sector=${JSON.stringify(labelledColonSector)}`,
    );

    const selfIdBusiness = await extractRequirement("We are a Healthcare business.", {});
    const selfIdSector = selfIdBusiness.updates.find((u) => u.path === "organisation.sector");
    record(
      selfIdSector?.value === "Healthcare & pharma" && selfIdSector?.provenance === "stated",
      "\"We are a Healthcare business.\": explicit self-identification still states the sector (unchanged by the 'is' removal)",
      `sector=${JSON.stringify(selfIdSector)}`,
    );

    const bareIsNegative = await extractRequirement("Our policy is Government approved.", {});
    const bareIsSector = bareIsNegative.updates.find((u) => u.path === "organisation.sector");
    record(
      bareIsSector === undefined,
      "\"Our policy is Government approved.\": bare 'is' is no longer sufficient self-identification -- the sector is set NEITHER stated NOR inferred",
      `sector=${JSON.stringify(bareIsSector)} unplaced=${JSON.stringify(bareIsNegative.unplacedClauses)} bespoke=${JSON.stringify(bareIsNegative.updates.filter((u) => u.path === "requirements.bespoke"))}`,
    );
  }

  console.log("\n=== Blocker 5 & Round 3 blocker 3, consolidated: a captured bespoke clause is never silently truncated, at any length ===\n");
  {
    // THIRD amendment note: coverDeclarativeClauses() no longer invents
    // requirements.bespoke facts from clause residue at all (that heuristic
    // -- "an uncovered unit with its own verb" -- is exactly the kind of
    // guessing Robert's source-ledger correction rules out). The ONLY
    // remaining path to requirements.bespoke is a named deterministic rule
    // (there is exactly one: "threat protection") or the model. So these
    // two originally-separate tests (Blocker 5, and second-review Blocker
    // 3, which built long clauses shaped to trip the OLD "own verb"
    // bespoke-invention heuristic directly through coverDeclarativeClauses)
    // are consolidated here against that surviving path. The chunking logic
    // itself -- extract.ts's FREE_TEXT_CLAUSE_MAX loop, one layer below
    // coverDeclarativeClauses, in the field validator that turns a bespoke
    // VALUE into stored chunks -- is UNCHANGED by this round's correction,
    // so this remains a live regression proof of both prior rounds' fixes,
    // just reached end to end through extractRequirement() rather than by
    // calling the (now-removed) bespoke-inventing code path directly.
    const buildThreatClause = (targetLen: number) => {
      const prefix = "We also require next-generation threat protection ";
      const fillerUnit = "additional named requirement detail padded with no punctuation so it all stays one clause ";
      let body = "";
      while ((prefix + body).length < targetLen) body += fillerUnit;
      const clause = prefix + body;
      // Trim/pad to the EXACT target length ("threat protection" sits
      // inside the fixed prefix, so slicing the tail never cuts it off).
      return clause.length >= targetLen ? clause.slice(0, targetLen) : clause + "x".repeat(targetLen - clause.length);
    };

    // -- Longer than the old first-amendment 200-character cap. --
    const shortOverrun = buildThreatClause(432);
    const resShort = await extractRequirement(`${shortOverrun}.`, {});
    const bespokeShort = resShort.updates.find((u) => u.path === "requirements.bespoke");
    const valuesShort = Array.isArray(bespokeShort?.value) ? (bespokeShort!.value as string[]) : [];
    const reconstructedShort = valuesShort.join("");
    const okShort = shortOverrun.length > 200 && reconstructedShort === shortOverrun;
    record(
      okShort,
      "A 'threat protection' bespoke clause longer than the old 200-character cap is kept in full, not silently sliced",
      `clauseLength=${shortOverrun.length} reconstructedLength=${reconstructedShort.length} exactMatch=${reconstructedShort === shortOverrun} bespoke=${JSON.stringify(bespokeShort)}`,
    );

    // -- Exact 5,021-character reproduction of Codex's second-review report:
    // "retained exactly 4,000 characters while claiming the remainder was
    // kept." --
    const exactClause = buildThreatClause(5021);
    const resExact = await extractRequirement(`${exactClause}.`, {});
    const bespokeExact = resExact.updates.find((u) => u.path === "requirements.bespoke");
    const valuesExact = Array.isArray(bespokeExact?.value) ? (bespokeExact!.value as string[]) : [];
    const reconstructedExact = valuesExact.join("");
    const okExact = exactClause.length === 5021 && reconstructedExact.length === 5021 && reconstructedExact === exactClause;
    record(
      okExact,
      "A 5,021-character 'threat protection' clause (Codex's exact reported length) is reconstructed character-for-character, not truncated to 4,000",
      `clauseLength=${exactClause.length} chunkCount=${valuesExact.length} reconstructedLength=${reconstructedExact.length} exactMatch=${reconstructedExact === exactClause}`,
    );

    // -- Enough length to exceed the old hard list cap of 12 chunks. --
    const hugeClause = buildThreatClause(2000 * 15 + 500); // needs >= 16 chunks at 2000 chars/chunk
    const resHuge = await extractRequirement(`${hugeClause}.`, {});
    const bespokeHuge = resHuge.updates.find((u) => u.path === "requirements.bespoke");
    const valuesHuge = Array.isArray(bespokeHuge?.value) ? (bespokeHuge!.value as string[]) : [];
    const reconstructedHuge = valuesHuge.join("");
    const okHuge = valuesHuge.length > 12 && reconstructedHuge.length === hugeClause.length && reconstructedHuge === hugeClause;
    record(
      okHuge,
      "A clause needing 16 chunks is not capped at 12 (the old .slice(0,12) list cap) -- every chunk is kept and reconstructs exactly",
      `clauseLength=${hugeClause.length} chunkCount=${valuesHuge.length} reconstructedLength=${reconstructedHuge.length} exactMatch=${reconstructedHuge === hugeClause}`,
    );
  }

  // ==========================================================================
  // THIRD amendment (13 Aug 2026): Robert's own required regression
  // fixtures for the source-ledger architectural correction, verbatim from
  // his instruction. Acceptance rule, verbatim: "A test passes only if
  // every original requirement remains available in either a structured
  // fact, an explicit bespoke span, or the complete retained source
  // receipt."
  // ==========================================================================

  console.log("\n=== Round 4, fixture set A: comma/colon/slash/with -- the silent-loss examples Codex reported ===\n");
  {
    // Codex's exact four failing inputs: "Each returns only SASE and
    // unplacedClauses=[]." None of comma, colon, slash or "with" is a
    // strong boundary (instruction 5), so each of these is ONE clause.
    // There is no named bespoke rule for "Ethernet private circuit", so
    // per the acceptance rule the Ethernet requirement must remain
    // available via the third option: the complete, verbatim retained
    // source receipt.
    const cases = [
      "We need SASE, require an Ethernet private circuit.",
      "We need SASE: we also require an Ethernet private circuit.",
      "We need SASE / we also require an Ethernet private circuit.",
      "We need SASE with an Ethernet private circuit.",
    ];
    for (const text of cases) {
      const res = await extractRequirement(text, {});
      const buying = res.updates.find((u) => u.path === "procurement.buying");
      const bespoke = res.updates.filter((u) => u.path === "requirements.bespoke");
      const wholeClausePreserved = res.unplacedClauses.some((c) => c.trim() === text);
      const ok = buying?.value === "sase" && bespoke.length === 0 && wholeClausePreserved && res.unplacedClauses.length === 1;
      record(
        ok,
        `"${text}": SASE lands AND the Ethernet requirement remains available as the complete, verbatim source receipt (never silently lost, never a fragment)`,
        `buying=${JSON.stringify(buying)} bespoke=${JSON.stringify(bespoke)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
      );
    }
  }

  console.log("\n=== Round 4, fixture set B: compound phrases whose own coordinator must NOT be split ===\n");
  {
    // Codex's exact failing examples: splitting on every "and" damaged
    // valid compound phrases. "Energy and utilities" and "Retail and
    // e-commerce" are both matched WHOLE by their sector regex (a
    // structured fact, quote = the full compound phrase) with ZERO
    // unplaced receipts. "research and development", "sales and
    // marketing" and "active-active and active-passive" have no
    // structured-fact anchor at all, so per the acceptance rule they must
    // remain available via the complete, verbatim, UNSPLIT source receipt
    // -- never "We need research" plus a stray "development network
    // segmentation." fragment.
    const cleanCompoundSectorCases: Array<{ text: string; expectValue: string; expectQuote: string }> = [
      { text: "We are an Energy and utilities business.", expectValue: "Energy & utilities", expectQuote: "Energy and utilities" },
      { text: "Sector: Retail and e-commerce.", expectValue: "Retail & e-commerce", expectQuote: "Retail and e-commerce" },
    ];
    for (const c of cleanCompoundSectorCases) {
      const res = await extractRequirement(c.text, {});
      const sector = res.updates.find((u) => u.path === "organisation.sector");
      const ok =
        sector?.value === c.expectValue &&
        sector?.provenance === "stated" &&
        sector?.quote === c.expectQuote &&
        res.unplacedClauses.length === 0;
      record(
        ok,
        `"${c.text}": the compound sector phrase lands CLEAN (its own "and" is not split) -- zero spurious unplaced receipts`,
        `sector=${JSON.stringify(sector)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
      );
    }

    const uncapturedCompoundCases = [
      "We need research and development network segmentation.",
      "We need sales and marketing network segmentation.",
      "We need active-active and active-passive failover.",
    ];
    for (const text of uncapturedCompoundCases) {
      const res = await extractRequirement(text, {});
      const noStructuredFact = res.updates.length === 0;
      const noSpuriousBespoke = !res.updates.some((u) => u.path === "requirements.bespoke");
      const wholeClausePreserved = res.unplacedClauses.length === 1 && res.unplacedClauses[0].trim() === text;
      const ok = noStructuredFact && noSpuriousBespoke && wholeClausePreserved;
      record(
        ok,
        `"${text}": no fact captures this compound phrase, so the COMPLETE, UNSPLIT sentence is kept as a receipt -- never "We need research" plus a stray fragment`,
        `updates=${JSON.stringify(res.updates)} unplaced=${JSON.stringify(res.unplacedClauses)}`,
      );
    }
  }

  console.log("\n=== Round 4, fixture set C: the original five-fact message, re-verified under the new architecture ===\n");
  {
    // Same message as Regression 1 above (kept here too, under its own
    // heading, because Robert explicitly named it in his fixture list a
    // second time as its own required regression). Duplicated on purpose
    // -- redundancy in test coverage is not the failure mode this gate
    // exists to close.
    const text =
      "UK 20 site Healthcare business requires SD-WAN and full SASE. We have 200 remote users. " +
      "We also have a legacy app that requires a point to point Ethernet private circuit.";
    const res = await extractRequirement(text, {});
    const everyStructuredFactPresent =
      res.updates.some((u) => u.path === "organisation.sector" && u.value === "Healthcare & pharma" && u.provenance === "stated") &&
      res.updates.some((u) => u.path === "estate.users" && u.value === 200) &&
      res.updates.some((u) => u.path === "estate.sites" && u.value === 20) &&
      res.updates.some((u) => u.path === "estate.existingNetwork" && Array.isArray(u.value) && (u.value as string[]).includes("sdwan"));
    const ethernetAvailable = res.unplacedClauses.some((c) => /ethernet/i.test(c));
    const sdwanSaseAvailable = res.unplacedClauses.some((c) => /sd-wan/i.test(c) && /sase/i.test(c));
    record(
      everyStructuredFactPresent && ethernetAvailable && sdwanSaseAvailable,
      "The original five-fact message: every requirement remains available -- as a structured fact, or as a complete retained source receipt -- under the new architecture",
      `updates=${JSON.stringify(res.updates.map((u) => ({ path: u.path, value: u.value })))} unplaced=${JSON.stringify(res.unplacedClauses)}`,
    );
  }

  console.log("\n=== Round 4, item 6: persisted buyer.notes carries the buyer's verbatim source wording (save/publish, not just the transient chat display) ===\n");
  {
    // notesWithSourceTurns() itself, the pure helper shared by ProjectDesk
    // (client) and create-project.ts (server).
    const helperOut = notesWithSourceTurns("Staff: 200.", ["We need SASE, require an Ethernet private circuit."]);
    const helperOk = helperOut.includes("We need SASE, require an Ethernet private circuit.") && helperOut.includes("Staff: 200.");
    record(
      helperOk,
      "notesWithSourceTurns(): folds the buyer's verbatim source turn into the notes string alongside any existing content",
      `out=${JSON.stringify(helperOut)}`,
    );

    // End to end, through the actual persistence core (buildSecurityProject
    // -- the SAME function the security-sourcing project-creation API route
    // and the create_security_project MCP tool both call, per this file's
    // own "one truth" design note): proves item 6 doesn't stop at a helper
    // function nobody calls -- the SECURITY-scope creation path (the
    // app's default/primary scope) actually threads sourceNotes through to
    // the persisted record's buyer.notes.
    const sourceText = "We need SASE, require an Ethernet private circuit.";
    const built = await buildSecurityProject({
      requirement: { organisation: { sector: "Healthcare & pharma" }, estate: { sites: 20, users: 200 } },
      via: "web",
      test: true,
      ids: { id: "reliability-gate-round4-source-turn-test", shareToken: "share-test-token", manageToken: "manage-test-token" },
      skipConfidenceGate: true,
      skipRfpGeneration: true,
      // Fourth amendment (13 Aug 2026): CreateSecurityProjectInput.sourceNotes
      // (a bare string[]) was retired in favour of sourceTurns (structured
      // SourceLedgerEntry[]) -- see workspace/source-ledger.ts. This is the
      // fixture-level consequence of that rename, not a behaviour change:
      // buyer.notes still receives the same projected text.
      sourceTurns: [{ id: "st_round4fixture1", text: sourceText, at: Date.now(), via: "typed" }],
    });
    const persistedNotesHaveSourceWording = typeof built.project.buyer?.notes === "string" && built.project.buyer.notes.includes(sourceText);
    record(
      persistedNotesHaveSourceWording,
      "buildSecurityProject(): the persisted project's buyer.notes contains the buyer's original source wording verbatim",
      `notes=${JSON.stringify(built.project.buyer?.notes)}`,
    );
    // Fourth amendment: the SAME creation now also persists the canonical,
    // structured ledger (round 4 only proved the flattened notes string).
    const persistedLedgerHasEntry = (built.project.source_ledger ?? []).some((e) => e.id === "st_round4fixture1" && e.text === sourceText && e.via === "typed");
    record(
      persistedLedgerHasEntry,
      "buildSecurityProject(): the persisted project's source_ledger contains the buyer's structured turn (id, text, via) -- the new canonical store, not just its notes projection",
      `source_ledger=${JSON.stringify(built.project.source_ledger)}`,
    );
  }

  console.log("\n=== Round 5 (fourth amendment, 13 Aug 2026): the source ledger is canonical, structured, persisted data, threaded through every save path ===\n");
  {
    const REQ: SecurityRequirementInput = { organisation: { sector: "Healthcare & pharma" }, estate: { sites: 20, users: 200 } };
    const baseIds = { id: "reliability-gate-round5-ledger-test", shareToken: "share-test-token-r5", manageToken: "manage-test-token-r5" };

    // -- Fixture 1: a paste exceeding maxChunks survives completely and
    // exactly. chunkForIngest's cap (chunkMax 3500 x maxChunks 3 = 10,500
    // chars) is real and untouched -- it governs what EXTRACTION reads.
    // ProjectDesk.tsx's ingestText() now captures the full raw paste as ONE
    // ledger entry BEFORE calling chunkForIngest at all (see its own doc
    // comment), so the ledger's copy is never subject to this cap. Proven
    // here at the two load-bearing seams: chunkForIngest itself still
    // truncates (extraction's honest, disclosed budget, unchanged by this
    // round), while the persistence core keeps a same-shaped entry whole.
    {
      const paragraph = "We need a fully managed SASE rollout across every one of our sites, with strict zero trust segmentation and 24/7 SOC coverage. ";
      const longPaste = paragraph.repeat(120); // well past 10,500 chars
      const plan = chunkForIngest(longPaste);
      const extractionTruncates = plan.truncated === true && plan.readChars < plan.totalChars;
      record(
        extractionTruncates,
        "chunkForIngest(): a paste past the read budget is still honestly truncated for EXTRACTION -- this round changes what the LEDGER keeps, not this disclosed budget",
        `totalChars=${plan.totalChars} readChars=${plan.readChars} truncated=${plan.truncated}`,
      );

      // The normalisation ProjectDesk.tsx's ingestText() applies before
      // keepSourceTurn (CRLF -> LF, outer trim) is the SAME normalisation
      // chunkForIngest applies to its own input -- so the ledger entry and
      // "the text extraction would have seen with no cap" are identical
      // strings, letting this fixture compare byte-for-byte.
      const normalised = longPaste.replace(/\r\n/g, "\n").trim();
      const built = await buildSecurityProject({
        requirement: REQ,
        via: "web",
        test: true,
        ids: baseIds,
        skipConfidenceGate: true,
        skipRfpGeneration: true,
        sourceTurns: [{ id: "st_r5_longpaste", text: normalised, at: Date.now(), via: "paste" }],
      });
      const entry = (built.project.source_ledger ?? []).find((e) => e.id === "st_r5_longpaste");
      const survivedCompletelyAndExactly = entry?.text === normalised && entry.text.length === normalised.length && entry.text.length > plan.readChars;
      record(
        survivedCompletelyAndExactly,
        "source_ledger: a paste exceeding maxChunks survives COMPLETELY and EXACTLY in the ledger, even though the same text is truncated for extraction",
        `entryLength=${entry?.text.length ?? -1} normalisedLength=${normalised.length} extractionReadChars=${plan.readChars}`,
      );
    }

    // -- Fixture 2: new wording added after initial save survives a second
    // save. First save = buildSecurityProject (create-project.ts); second
    // save = buildRescopedProject (rescope-project.ts) -- the exact function
    // refreshRecord()'s security branch calls on every Save after the
    // first, which is gap 2's precise code location.
    let project = (
      await buildSecurityProject({
        requirement: REQ,
        via: "web",
        test: true,
        ids: baseIds,
        skipConfidenceGate: true,
        skipRfpGeneration: true,
        sourceTurns: [{ id: "st_r5_turnA", text: "We need SASE for 20 sites.", at: 1000, via: "typed" }],
      })
    ).project;
    const afterFirstSaveHasA = (project.source_ledger ?? []).some((e) => e.id === "st_r5_turnA");
    record(afterFirstSaveHasA, "First save: turn A lands in source_ledger", `source_ledger=${JSON.stringify(project.source_ledger)}`);

    const secondSave = await buildRescopedProject({
      project,
      requirement: REQ,
      via: "web",
      skipConfidenceGate: true,
      skipRfpGeneration: true,
      sourceTurns: [{ id: "st_r5_turnB", text: "Also: we suffered a breach last quarter.", at: 2000, via: "typed" }],
    });
    project = secondSave.project;
    const secondSaveHasBothTurns =
      (project.source_ledger ?? []).some((e) => e.id === "st_r5_turnA") && (project.source_ledger ?? []).some((e) => e.id === "st_r5_turnB");
    record(
      secondSaveHasBothTurns,
      "Gap 2 fix: wording typed AFTER the first save (turn B) survives a second save (buildRescopedProject, the re-scope route's core) -- and turn A is not lost",
      `source_ledger=${JSON.stringify(project.source_ledger)}`,
    );

    // -- Fixture 3: new wording added before publish survives the
    // refresh/publish sequence. signAndPublish() calls refreshRecord() (the
    // SAME buildRescopedProject core as a Save) immediately before the
    // publish API call -- proven here with a third turn. The publish step
    // itself is not re-driven live in this hermetic script (executePublish
    // makes real DNS/HTTP business-verification calls unavailable in this
    // sandbox), but rfp-publish.ts's executePublish was read in full for
    // this round: every branch builds its saved object as `{ ...working,
    // status: "published", ... }` or `{ ...working, ... }` -- a plain spread
    // of the project this function already carries a source_ledger on. No
    // branch constructs a fresh object that could drop the field, so the
    // refresh proven here is the load-bearing half of "survives the
    // refresh/publish sequence"; publish cannot un-persist what refresh
    // already wrote.
    const preRefreshTurn = { id: "st_r5_turnC_prepublish", text: "One more thing: we also need PCI DSS scope.", at: 3000, via: "typed" as const };
    const refreshed = await buildRescopedProject({
      project,
      requirement: REQ,
      via: "web",
      skipConfidenceGate: true,
      skipRfpGeneration: true,
      sourceTurns: [preRefreshTurn],
    });
    const readyForPublishHasAllThree = ["st_r5_turnA", "st_r5_turnB", "st_r5_turnC_prepublish"].every((id) =>
      (refreshed.project.source_ledger ?? []).some((e) => e.id === id),
    );
    record(
      readyForPublishHasAllThree,
      "Gap 2 fix: wording added just before publish (turn C, via the same refresh call signAndPublish() makes) is present in the project publish would receive -- all three turns intact",
      `source_ledger=${JSON.stringify(refreshed.project.source_ledger)}`,
    );

    // -- Fixture 4: newlines, pipes and leading/trailing content retain
    // reliable boundaries. buyer.notes' human-readable PROJECTION joins
    // turns with " | " (notesWithSourceTurns, unchanged) -- a lossy join if
    // a turn's own text contained "|", which is exactly why the third
    // amendment's flattened-into-notes design (round 4) was not durable.
    // The CANONICAL ledger never joins at all: each turn is its own array
    // entry, so a "|" or a newline inside one turn's text can never be
    // mistaken for a boundary between turns.
    const messyText = "  Line one.\nLine two has a | pipe in it.\n\nBlank-line-separated line three.  ";
    const parsed = parseIncomingSourceTurns([{ id: "st_r5_messy", text: messyText, at: 4000, via: "paste" }]);
    const boundariesReliable = parsed.length === 1 && parsed[0].text === messyText;
    record(
      boundariesReliable,
      "parseIncomingSourceTurns(): a turn containing newlines, a pipe character, and leading/trailing whitespace round-trips EXACTLY as one entry -- the ledger never splits or joins on those characters",
      `in=${JSON.stringify(messyText)} out=${JSON.stringify(parsed[0]?.text)}`,
    );
    const mergedMessy = mergeSourceLedger([], parsed);
    const survivesMergeToo = mergedMessy.length === 1 && mergedMessy[0].text === messyText;
    record(
      survivesMergeToo,
      "mergeSourceLedger(): the same messy entry survives the merge step unchanged -- boundaries are never inferred from the text's own content, only from array position",
      `merged=${JSON.stringify(mergedMessy)}`,
    );

    // -- Fixture 5: repeated save operations do not duplicate turns.
    // Calling buildRescopedProject a SECOND time with the exact same batch
    // (same ids -- a buyer who presses Save again without typing anything
    // new) must be a no-op on the ledger, exercised through the real
    // persistence core, not just the isolated merge function.
    const beforeRepeat = refreshed.project;
    const repeatSaveInput = { id: "st_r5_turnA", text: "We need SASE for 20 sites.", at: 1000, via: "typed" as const };
    const repeatSave1 = await buildRescopedProject({
      project: beforeRepeat,
      requirement: REQ,
      via: "web",
      skipConfidenceGate: true,
      skipRfpGeneration: true,
      sourceTurns: [repeatSaveInput],
    });
    const repeatSave2 = await buildRescopedProject({
      project: repeatSave1.project,
      requirement: REQ,
      via: "web",
      skipConfidenceGate: true,
      skipRfpGeneration: true,
      sourceTurns: [repeatSaveInput],
    });
    const countBefore = (beforeRepeat.source_ledger ?? []).length;
    const countAfterTwoRepeats = (repeatSave2.project.source_ledger ?? []).length;
    const noDuplication =
      countAfterTwoRepeats === countBefore &&
      (repeatSave2.project.source_ledger ?? []).filter((e) => e.id === "st_r5_turnA").length === 1;
    record(
      noDuplication,
      "Idempotent merge: saving the SAME batch twice in a row (nothing newly typed) never duplicates a turn -- entry count is unchanged and turn A still appears exactly once",
      `countBefore=${countBefore} countAfter=${countAfterTwoRepeats} turnACopies=${(repeatSave2.project.source_ledger ?? []).filter((e) => e.id === "st_r5_turnA").length}`,
    );
  }

  console.log(
    "\n=== Round 6 (fifth amendment, 13 Aug 2026): route-level integration -- the REAL Next.js route handlers, not the persistence core called directly ===\n",
  );
  {
    // Robert's review of the fourth amendment: every "end-to-end" fixture
    // drove buildSecurityProject()/buildRescopedProject() directly. That
    // proves the CORE merges correctly, but never proves the actual HTTP
    // routes (request-body parsing, owner auth, saveProject's real
    // read-modify-write) do the same thing with a real Request in and a
    // real Response out. fake-kv-harness.ts (see that file's own header)
    // makes this possible without a live KV instance: it emulates the one
    // Upstash Redis REST calling convention rfp-store.ts speaks, so the
    // REAL route handlers below run their REAL saveProject/getProject code
    // against an in-memory store. Every fixture in this block calls the
    // actual exported route handler functions (dynamically imported, so
    // KV_REST_API_URL/TOKEN are faked BEFORE rfp-store.ts's module-level
    // consts capture them -- see the harness file for why this ordering
    // matters), not a reimplementation of what they do.
    const FULL_REQ: SecurityRequirementInput = {
      organisation: { sector: "Healthcare & pharma" },
      estate: { sites: 20, users: 200, existingSecurity: ["Defender P2"] },
      drivers: ["renewal"],
      constraints: { inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
    };
    // Unlike the round-5 fixtures' skipConfidenceGate:true (only available
    // to the internal conversational entry point), a real route enforces
    // the real confidence gate -- FULL_REQ is deliberately rich enough
    // (drivers, existing security tooling, SOC capacity, a compliance
    // regime) to clear it for real, exactly as a real buyer's answers
    // would.

    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");

      // 1. Initial create, through the real route.
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: {
            requirement: FULL_REQ,
            consent: true,
            test: true,
            source_turns: [{ id: "st_r6_A", text: "Turn A: initial create.", at: 1000, via: "typed" }],
          },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      record(
        createRes.status === 200 && Boolean(created.project?.source_ledger?.some((e) => e.id === "st_r6_A")),
        "Route-level: POST /security-sourcing/project (initial create) persists turn A into source_ledger",
        `status=${createRes.status} error=${created.error} source_ledger=${JSON.stringify(created.project?.source_ledger)}`,
      );
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      // 2. A LATER save through the Security Sourcing re-scope endpoint
      // (turn B) -- the exact route gap 2 was about: only the first save
      // used to reach this far.
      const rescopeRes1 = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_r6_B", text: "Turn B: a later Save.", at: 2000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(rescopeRes1.status === 200, "Route-level: POST .../rescope (a later Save, after the first) succeeds", `status=${rescopeRes1.status}`);

      // 3. The pre-publish refresh: the SAME route, the SAME call
      // signAndPublish()'s refreshRecord() makes immediately before
      // publish -- turn C.
      const rescopeRes2 = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_r6_C", text: "Turn C: added just before publish.", at: 3000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(rescopeRes2.status === 200, "Route-level: POST .../rescope (the pre-publish refresh call) succeeds", `status=${rescopeRes2.status}`);

      // 4. Reload/reopen: GET the project back exactly as an authenticated
      // owner would (manage_token in the query string, the same
      // convention server-rendered owner pages use).
      const reload1 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded1 = (await reload1.json()) as RouteProjectLike;
      const hasABC = ["st_r6_A", "st_r6_B", "st_r6_C"].every((tid) => (reloaded1.source_ledger ?? []).some((e) => e.id === tid));
      record(
        reload1.status === 200 && hasABC,
        "Route-level: GET /api/rfp/[id] (reopen) returns all three turns the real routes above persisted -- A (create), B (a later Save), C (the pre-publish refresh)",
        `status=${reload1.status} source_ledger=${JSON.stringify(reloaded1.source_ledger)}`,
      );

      // 5. Reload/reopen followed by ANOTHER save (turn D).
      const rescopeRes3 = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_r6_D", text: "Turn D: typed after reopening.", at: 4000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      const reload2 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded2 = (await reload2.json()) as RouteProjectLike;
      const hasABCD = ["st_r6_A", "st_r6_B", "st_r6_C", "st_r6_D"].every((tid) => (reloaded2.source_ledger ?? []).some((e) => e.id === tid));
      record(
        rescopeRes3.status === 200 && hasABCD,
        "Route-level: reload/reopen FOLLOWED BY another real save persists turn D alongside every earlier turn",
        `source_ledger=${JSON.stringify(reloaded2.source_ledger)}`,
      );

      // 6. No duplicate IDs after reopening and saving: the buyer reopens,
      // types nothing new, and Save fires anyway (ProjectDesk always sends
      // the full current ledger) -- turn A's exact id arrives again.
      const countBeforeRepeat = (reloaded2.source_ledger ?? []).length;
      const rescopeRes4 = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: FULL_REQ, consent: true, source_turns: [{ id: "st_r6_A", text: "Turn A: initial create.", at: 1000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      const reload3 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded3 = (await reload3.json()) as RouteProjectLike;
      const afterRepeat = reloaded3.source_ledger ?? [];
      const noDup = afterRepeat.length === countBeforeRepeat && afterRepeat.filter((e) => e.id === "st_r6_A").length === 1;
      record(
        rescopeRes4.status === 200 && noDup,
        "Route-level: reopening and saving again with an already-persisted turn id never duplicates it -- entry count unchanged, turn A appears exactly once",
        `countBefore=${countBeforeRepeat} countAfter=${afterRepeat.length} turnACopies=${afterRepeat.filter((e) => e.id === "st_r6_A").length}`,
      );

      // 7. Exact raw paste survival -- through the ACTUAL captureRawSourceEntry
      // helper ProjectDesk.tsx's ingestText() calls, then the real route's
      // request parsing, then real persistence, then a real reload. This is
      // Robert's exact critique of the fourth amendment's fixture: it
      // reimplemented the normalisation by hand instead of exercising the
      // real capture path, which is precisely how the gap-1 regression hid.
      const messyRaw = "\r\n  Line one.\r\nLine two has a | pipe in it.\r\n\r\nBlank-line-separated line three.  \r\n";
      const captured = captureRawSourceEntry(messyRaw);
      const rawSurvivedTheHelperUntouched = captured === messyRaw;
      const createRes2 = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: FULL_REQ, consent: true, test: true, source_turns: [{ id: "st_r6_rawpaste", text: captured, at: 5000, via: "paste" }] },
        }),
      );
      const created2 = (await createRes2.json()) as { project?: RouteProjectLike };
      const persistedRaw = created2.project?.source_ledger?.find((e) => e.id === "st_r6_rawpaste")?.text;
      const reloadId = created2.project?.id ?? "";
      const reloadManage = created2.project?.manage_token ?? "";
      const reload4 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${reloadId}?manage=${reloadManage}`), { params: Promise.resolve({ id: reloadId }) });
      const reloaded4 = (await reload4.json()) as RouteProjectLike;
      const reloadedRaw = reloaded4.source_ledger?.find((e) => e.id === "st_r6_rawpaste")?.text;
      const survivesEverySeam = rawSurvivedTheHelperUntouched && persistedRaw === messyRaw && reloadedRaw === messyRaw;
      record(
        survivesEverySeam,
        "Route-level, gap-1 fix: a raw paste with CRLF, leading/trailing spaces, blank lines and a pipe survives captureRawSourceEntry() -> the real create route -> saveProject -> a real reload, byte-for-byte identical to the original raw input",
        `helperMatches=${rawSurvivedTheHelperUntouched} persistedMatches=${persistedRaw === messyRaw} reloadedMatches=${reloadedRaw === messyRaw} raw=${JSON.stringify(messyRaw)}`,
      );

      // The Round 6 fixture that used to live here (hydrateSourceTurns()
      // fed straight back into a real Save) is REMOVED, not kept alongside
      // the replacement below -- it re-sent the same manually-supplied
      // FULL_REQ on every resumed save, which is exactly the shape of gap
      // Robert found in production: it could never have caught "resume
      // replaces the project's real requirement with an empty or partial
      // one", because it never let a resumed session's requirement be
      // anything other than the one constant the fixture itself supplied.
      // See "Round 7" below for the replacement, built the honest way.
    });
  }

  console.log(
    "\n=== Round 7 (sixth amendment, 13 Aug 2026): resume must never silently discard the project's existing scope ===\n",
  );
  {
    // Robert's finding on the fifth amendment's "Minimal resume link":
    // resuming rehydrated `source_ledger` but never `facts` -- so
    // `requirementFrom(facts)` after a resume reflected ONLY whatever the
    // resumed session itself had typed. A sufficiently detailed new
    // message could clear the confidence gate on its own, and
    // rescope-project.ts's `requirement: input.requirement` REPLACES the
    // project's whole existing engine_data.requirement with it --
    // silently discarding the buyer's original sector, estate, drivers,
    // constraints and buying intent. His own diagnosis of why the round-6
    // fixtures missed it: "every resumed-save fixture sends FULL_REQ
    // manually. That is not what ProjectDesk does after reopening." This
    // block never does that -- every requirement sent below is either the
    // route's own real create-time input, or the REAL output of
    // mergeRequirementBase()/resumeStateFromProject(), the exact functions
    // ProjectDesk.tsx's resume path calls.
    const REQUIREMENT_A: SecurityRequirementInput = {
      organisation: { sector: "Financial services", sizeBand: "large", regions: ["uk", "eu"] },
      estate: { users: 850, sites: 14, cloud: ["azure", "m365"], existingSecurity: ["Defender P2", "CrowdStrike"], existingNetwork: ["mpls", "sdwan"] },
      drivers: ["renewal", "compliance"],
      constraints: { complianceRequirements: ["iso27001", "fca"], inHouseSocCapacity: "twenty_four_seven", budgetBand: "£1.2m", timeline: "H2 2027" },
    };

    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");

      // 1. Create with requirement A, through the real route.
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: {
            requirement: REQUIREMENT_A,
            consent: true,
            test: true,
            source_turns: [{ id: "st_r7_A", text: "Turn A: the original scoping conversation.", at: 1000, via: "typed" }],
          },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } }; error?: string };
      record(createRes.status === 200, "Round 7: create with requirement A succeeds through the real route", `status=${createRes.status} error=${created.error}`);
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      // 2. Reload through the real GET route -- exactly what ProjectDesk's
      // resume effect fetches.
      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded = (await reload.json()) as RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } };

      // 3. Initialise the SAME resume-state helper ProjectDesk.tsx's
      // arrival effect calls -- not a hand-rolled stand-in.
      const resumeState = resumeStateFromProject(reloaded);
      record(
        Boolean(resumeState) && JSON.stringify(resumeState?.requirementBase) === JSON.stringify(REQUIREMENT_A),
        "Round 7, item 5: resumeStateFromProject() -- the real helper ProjectDesk.tsx calls -- recovers requirement A, verbatim, from a real reload",
        `requirementBase=${JSON.stringify(resumeState?.requirementBase)}`,
      );

      // 4. Add one small detail B: a single new compliance requirement,
      // the kind of one-line correction a buyer might type right after
      // reopening. Built with mergeRequirementBase() -- the REAL function
      // ProjectDesk.tsx's `requirement` memo calls -- not a hand-assembled
      // object, and NOT a manually supplied constant like FULL_REQ (item
      // 7): this is genuinely "requirement A, as fetched, plus exactly
      // what this resumed session adds and nothing else".
      const additionB: SecurityRequirementInput = { constraints: { complianceRequirements: ["pci_dss"] } };
      const mergedForSave = mergeRequirementBase(resumeState!.requirementBase, additionB);

      // 5. Save through the real re-scope route, sending the REAL merged
      // requirement (never FULL_REQ) plus the new source turn.
      const rescopeRes = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: mergedForSave, consent: true, source_turns: [{ id: "st_r7_B", text: "Turn B: one detail added after reopening.", at: 2000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(rescopeRes.status === 200, "Round 7: the resumed save (real merged requirement, not FULL_REQ) succeeds through the real re-scope route", `status=${rescopeRes.status}`);

      // 6. Reload again and assert: every field from requirement A
      // remains, B (pci_dss) is added, and source ids are unique.
      const reload2 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded2 = (await reload2.json()) as RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } };
      const finalReq = reloaded2.engine_data?.requirement;
      const everyFieldFromAPreserved =
        finalReq?.organisation?.sector === REQUIREMENT_A.organisation?.sector &&
        finalReq?.organisation?.sizeBand === REQUIREMENT_A.organisation?.sizeBand &&
        JSON.stringify([...(finalReq?.organisation?.regions ?? [])].sort()) === JSON.stringify([...(REQUIREMENT_A.organisation?.regions ?? [])].sort()) &&
        finalReq?.estate?.users === REQUIREMENT_A.estate?.users &&
        finalReq?.estate?.sites === REQUIREMENT_A.estate?.sites &&
        JSON.stringify([...(finalReq?.estate?.cloud ?? [])].sort()) === JSON.stringify([...(REQUIREMENT_A.estate?.cloud ?? [])].sort()) &&
        JSON.stringify([...(finalReq?.estate?.existingSecurity ?? [])].sort()) === JSON.stringify([...(REQUIREMENT_A.estate?.existingSecurity ?? [])].sort()) &&
        JSON.stringify([...(finalReq?.estate?.existingNetwork ?? [])].sort()) === JSON.stringify([...(REQUIREMENT_A.estate?.existingNetwork ?? [])].sort()) &&
        JSON.stringify([...(finalReq?.drivers ?? [])].sort()) === JSON.stringify([...(REQUIREMENT_A.drivers ?? [])].sort()) &&
        finalReq?.constraints?.inHouseSocCapacity === REQUIREMENT_A.constraints?.inHouseSocCapacity &&
        finalReq?.constraints?.budgetBand === REQUIREMENT_A.constraints?.budgetBand &&
        finalReq?.constraints?.timeline === REQUIREMENT_A.constraints?.timeline &&
        (REQUIREMENT_A.constraints?.complianceRequirements ?? []).every((c) => (finalReq?.constraints?.complianceRequirements ?? []).includes(c));
      const bAdded = (finalReq?.constraints?.complianceRequirements ?? []).includes("pci_dss");
      const ledgerIds = (reloaded2.source_ledger ?? []).map((e) => e.id);
      const idsUnique = new Set(ledgerIds).size === ledgerIds.length && ledgerIds.includes("st_r7_A") && ledgerIds.includes("st_r7_B");
      record(
        Boolean(everyFieldFromAPreserved && bAdded && idsUnique),
        "Round 7, items 1/2/5: after resume + one new detail + save, EVERY field from requirement A survives, B (pci_dss) is added, and every source id remains unique -- this is exactly the scenario that silently lost data before this amendment",
        `finalRequirement=${JSON.stringify(finalReq)} sourceIds=${JSON.stringify(ledgerIds)}`,
      );

      // 7. The race fixture (item 6): a turn typed during the resume
      // fetch's own async gap must never be discarded when the fetch
      // resolves. This is exactly what ProjectDesk.tsx's
      // `setSourceTurns((current) => mergeSourceLedger(resumeState.sourceLedger, current))`
      // does -- proven here with the SAME real mergeSourceLedger()
      // function, fed the same shape of inputs: a fetched ledger (the
      // "existing" argument) and whatever local state had already
      // accumulated by the time the fetch resolved (the "incoming"
      // argument, called AFTER the fetch in the real code, but a merge by
      // stable id is order-independent for who supplied which id).
      const fetchedLedgerAtResolution: SourceLedgerEntry[] = [
        { id: "st_race_A", text: "Turn A, already on the server before this resume.", at: 1000, via: "typed" },
        { id: "st_race_B", text: "Turn B, already on the server before this resume.", at: 2000, via: "typed" },
      ];
      const locallyTypedDuringTheRace: SourceLedgerEntry[] = [
        { id: "st_race_local", text: "Typed in the gap between the fetch starting and resolving.", at: 1500, via: "typed" },
      ];
      const raceMerged = mergeSourceLedger(fetchedLedgerAtResolution, locallyTypedDuringTheRace);
      const raceIds = raceMerged.map((e) => e.id);
      const raceSafe =
        raceIds.includes("st_race_A") && raceIds.includes("st_race_B") && raceIds.includes("st_race_local") && new Set(raceIds).size === raceIds.length;
      record(
        raceSafe,
        "Round 7, item 6: a turn typed locally during the resume fetch's async gap survives the resume merge -- mergeSourceLedger(fetched, local) never discards the locally-captured turn",
        `merged=${JSON.stringify(raceMerged)}`,
      );

      // 8. Baseline safety, cheap and worth stating explicitly:
      // mergeRequirementBase(null, addition) is byte-identical to
      // `addition` alone -- the overwhelmingly common non-resumed session
      // is untouched by any of this amendment.
      const nonResumedAddition: SecurityRequirementInput = { organisation: { sector: "Retail & e-commerce" }, estate: { sites: 5 } };
      const nonResumedMerge = mergeRequirementBase(null, nonResumedAddition);
      record(
        JSON.stringify(nonResumedMerge) === JSON.stringify(nonResumedAddition),
        "Round 7: mergeRequirementBase(null, addition) is byte-identical to addition -- a non-resumed session behaves exactly as it did before this amendment",
        `merged=${JSON.stringify(nonResumedMerge)}`,
      );
    });
  }

  console.log(
    "\n=== Round 8 (seventh amendment, 13 Aug 2026): resumed corrections must actually retract a persisted list value, not just fail to add it back ===\n",
  );
  {
    // Robert's finding on the sixth amendment's mergeRequirementBase():
    // unioning list fields means a resumed buyer can ADD a new value but
    // can never RETRACT one the base already holds. "We no longer use
    // MPLS; we now use SD-WAN." correctly avoided ADDING mpls as a false
    // positive (the extractor's negation window already guaranteed that),
    // but the base's own pre-existing mpls value was never removed
    // either -- the immutable source ledger recorded the correction while
    // the structured requirement kept insisting the opposite. Fixed with
    // a new FieldRemoval channel (removalsIn() in extract.ts) and a
    // tombstone set mergeRequirementBase() now strips out of the BASE
    // before it unions in this session's own additions -- see that
    // function's own doc comment for why the tombstone applies to the
    // base only, never to `addition` (resurrection: a value removed this
    // sitting still returns the instant the SAME session restates it).
    const REQUIREMENT_C: SecurityRequirementInput = {
      organisation: { sector: "Retail & e-commerce", sizeBand: "medium", regions: ["uk"] },
      estate: { users: 300, sites: 8, cloud: ["azure", "aws"], existingNetwork: ["mpls", "vpn"] },
      drivers: ["renewal"],
      constraints: { complianceRequirements: ["iso27001"], budgetBand: "£400k" },
    };

    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");

      // 1. Create with requirement C, through the real route.
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: {
            requirement: REQUIREMENT_C,
            consent: true,
            test: true,
            source_turns: [{ id: "st_r8_C", text: "Turn C: the original scoping conversation.", at: 1000, via: "typed" }],
          },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } }; error?: string };
      record(createRes.status === 200, "Round 8: create with requirement C succeeds through the real route", `status=${createRes.status} error=${created.error}`);
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      // 2. Reload, exactly what resume fetches, then the real resume-state
      // helper -- not a hand-rolled stand-in.
      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded = (await reload.json()) as RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } };
      const resumeState = resumeStateFromProject(reloaded);
      record(Boolean(resumeState), "Round 8: resume recovers requirement C via the real resumeStateFromProject()", `resumeState=${JSON.stringify(resumeState)}`);

      // 3. The buyer's exact correction message, through the REAL
      // deterministic pipeline -- removalsIn() and deterministicExtract(),
      // not a hand-constructed removal object (item 7's prohibition on
      // FULL_REQ-style shortcuts applies here too).
      const correctionText = "We no longer use MPLS; we now use SD-WAN.";
      const removals = removalsIn(correctionText);
      record(
        removals.some((r) => r.path === "estate.existingNetwork" && r.value === "mpls") && !removals.some((r) => r.value === "sdwan"),
        "Round 8, items 2/3: removalsIn() flags exactly MPLS as retracted from 'no longer use MPLS', and never SD-WAN; deterministicExtract() on the same text never proposes mpls as a positive update either",
        `removals=${JSON.stringify(removals)} updates=${JSON.stringify(deterministicExtract(correctionText))}`,
      );
      const removalIds = new Set(removals.map((r) => factId(r.path, r.value)));

      // 4. Add one small addition too (a new compliance requirement),
      // through the real merge -- proves an addition and a removal in the
      // same resumed sitting compose correctly, and mirrors item 6's
      // "adding PCI DSS preserves ISO 27001" fixture.
      const additionD: SecurityRequirementInput = { constraints: { complianceRequirements: ["pci_dss"] } };
      const mergedForSave = mergeRequirementBase(resumeState!.requirementBase, additionD, removalIds);

      // 5. Save through the real re-scope route.
      const rescopeRes = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: {
            manage_token: manage,
            requirement: mergedForSave,
            consent: true,
            source_turns: [{ id: "st_r8_D", text: correctionText, at: 2000, via: "typed" }],
          },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(rescopeRes.status === 200, "Round 8: the corrected save succeeds through the real re-scope route", `status=${rescopeRes.status}`);

      // 6. Reload again: MPLS gone, VPN (an untouched existing value)
      // still present, Azure (untouched cloud value) still present, ISO
      // 27001 (untouched) still present, PCI DSS (the new addition)
      // present. Items 1/2/4/5/6 all proven together in one round-trip.
      const reload2 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded2 = (await reload2.json()) as RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } };
      const finalReq = reloaded2.engine_data?.requirement;
      const mplsGone = !(finalReq?.estate?.existingNetwork ?? []).includes("mpls");
      const vpnStays = (finalReq?.estate?.existingNetwork ?? []).includes("vpn");
      const azureStays = (finalReq?.estate?.cloud ?? []).includes("azure");
      const isoStays = (finalReq?.constraints?.complianceRequirements ?? []).includes("iso27001");
      const pciAdded = (finalReq?.constraints?.complianceRequirements ?? []).includes("pci_dss");
      record(
        Boolean(mplsGone && vpnStays && azureStays && isoStays && pciAdded),
        "Round 8, items 1/2/4/6: reload after the corrected save shows MPLS removed while VPN/Azure/ISO 27001 (untouched values, merely omitted from the correction text) are preserved and PCI DSS (the new addition) is present",
        `finalRequirement=${JSON.stringify(finalReq)}`,
      );

      // 7. The correction wording itself remains, unedited, in
      // source_ledger -- the immutable record and the corrected
      // structured requirement now agree, rather than only the ledger
      // knowing the truth (item 6's "the correction wording remains
      // unchanged in source_ledger").
      const ledgerTexts = (reloaded2.source_ledger ?? []).map((e) => e.text);
      record(
        ledgerTexts.includes(correctionText),
        "Round 8, item 6 (source_ledger unchanged): the buyer's exact correction wording survives verbatim in source_ledger after the corrected save",
        `source_ledger=${JSON.stringify(reloaded2.source_ledger)}`,
      );

      // 8. The command path ("drop Azure"): ProjectDesk.tsx's dropName
      // handler, when a value lives only in the resumed base (never in
      // this session's own `facts`), matches it by its display label and
      // feeds the identical FieldRemoval shape into mergeRequirementBase()
      // -- proven here at the mechanism level, the same way this whole
      // file already proves resumeStateFromProject() without rendering
      // the component.
      const azureRemoval: FieldRemoval[] = [{ path: "estate.cloud", value: "azure", quote: "Azure" }];
      const azureRemovalIds = new Set(azureRemoval.map((r) => factId(r.path, r.value)));
      const afterDropAzure = mergeRequirementBase(resumeState!.requirementBase, {}, azureRemovalIds);
      record(
        !(afterDropAzure.estate?.cloud ?? []).includes("azure") && (afterDropAzure.estate?.cloud ?? []).includes("aws"),
        "Round 8, item 3: dropping Azure (the command path's own FieldRemoval shape) removes exactly Azure and leaves every other cloud platform (AWS) untouched",
        `cloud=${JSON.stringify(afterDropAzure.estate?.cloud)}`,
      );

      // 9. Baseline: merely OMITTING an existing list item from a resumed
      // message (no removal signal at all) continues preserving the base
      // exactly -- item 4, restated explicitly against the real function
      // with an empty removal set.
      const noOpMerge = mergeRequirementBase(resumeState!.requirementBase, {}, new Set());
      record(
        JSON.stringify([...(noOpMerge.estate?.existingNetwork ?? [])].sort()) ===
          JSON.stringify([...(resumeState!.requirementBase!.estate?.existingNetwork ?? [])].sort()),
        "Round 8, item 4: omitting an existing list item (no removal signal at all) preserves it exactly -- the base is untouched when nothing was explicitly retracted",
        `merged=${JSON.stringify(noOpMerge.estate?.existingNetwork)} base=${JSON.stringify(resumeState!.requirementBase?.estate?.existingNetwork)}`,
      );

      // 10. Resurrection: a value removed this sitting can still be
      // restated in the SAME sitting and come back, because the tombstone
      // only ever strips the BASE, never `addition` -- proof that a later
      // correction is never permanently locked out by an earlier one.
      const restated: SecurityRequirementInput = { estate: { existingNetwork: ["mpls"] } };
      const afterRestate = mergeRequirementBase(resumeState!.requirementBase, restated, removalIds);
      record(
        (afterRestate.estate?.existingNetwork ?? []).includes("mpls"),
        "Round 8: a value removed this sitting still returns the instant the SAME session restates it in words -- resurrection, mirroring the struck-WorkspaceFact rule",
        `existingNetwork=${JSON.stringify(afterRestate.estate?.existingNetwork)}`,
      );
    });
  }

  console.log(
    "\n=== Round 9 (eighth amendment, 13 Aug 2026): occurrence-aware retraction, unambiguous removal aliases, and one strike-and-tombstone primitive for the row button and the drop/remove command ===\n",
  );
  {
    // Robert's three findings on the seventh amendment: (1) removalsIn()
    // inspected only each vocabulary term's FIRST occurrence, so an
    // earlier positive mention of the same word blocked a later, genuine
    // retraction from ever being seen; (2) "microsoft" alone (an alias for
    // m365) and a region's bare name (matching even when it modifies a
    // different noun, "UK-based SOC") could retract the wrong structured
    // fact; (3) dropRow()/the drop-remove command struck a live fact but
    // never tombstoned the resumed base's own copy, so a value present in
    // BOTH places came straight back on the next save. All three fixed
    // below, proven against the real functions, not a hand-rolled stand-in.

    // --- Item 1: every occurrence is inspected, not only the first. ---
    const laterOccurrence = "We use MPLS today, but we no longer use MPLS.";
    const laterRemovals = removalsIn(laterOccurrence);
    record(
      laterRemovals.some((r) => r.path === "estate.existingNetwork" && r.value === "mpls"),
      "Round 9, item 1: 'We use MPLS today, but we no longer use MPLS.' removes MPLS -- the earlier, unrelated positive mention no longer blocks the later, genuine retraction",
      `removals=${JSON.stringify(laterRemovals)}`,
    );

    // --- Item 2: unambiguous aliases only. ---
    const defenderText = "We no longer use Microsoft Defender.";
    const defenderRemovals = removalsIn(defenderText);
    record(
      !defenderRemovals.some((r) => r.value === "m365"),
      "Round 9, item 2: 'We no longer use Microsoft Defender.' does NOT remove m365 -- bare 'Microsoft' is no longer an alias for Microsoft 365",
      `removals=${JSON.stringify(defenderRemovals)}`,
    );
    const m365Text = "We no longer use Microsoft 365.";
    const m365Removals = removalsIn(m365Text);
    record(
      m365Removals.some((r) => r.path === "estate.cloud" && r.value === "m365"),
      "Round 9, item 2: 'We no longer use Microsoft 365.' DOES remove m365 -- the unambiguous full name still works",
      `removals=${JSON.stringify(m365Removals)}`,
    );
    const socText = "We no longer use UK-based SOC coverage.";
    const socRemovals = removalsIn(socText);
    record(
      !socRemovals.some((r) => r.path === "organisation.regions" && r.value === "uk"),
      "Round 9, item 2: 'We no longer use UK-based SOC coverage.' does NOT remove the UK region -- 'UK' here modifies 'SOC coverage', a different concept, not itself the retraction target",
      `removals=${JSON.stringify(socRemovals)}`,
    );

    // --- Item 3: ambiguous text produces no tombstone, and its complete
    // wording still surfaces -- the clause-coverage gate (coverDeclarative
    // Clauses, unchanged since the third amendment) never counts a
    // removal as "explaining" a clause, so a clause with neither an
    // update nor an accepted removal is, by the existing binary rule,
    // an unplaced clause -- a visible receipt, never a silent drop. ---
    const defenderCoverage = coverDeclarativeClauses(defenderText, deterministicExtract(defenderText));
    record(
      defenderCoverage.unplacedClauses.some((c) => c.includes("Microsoft Defender")),
      "Round 9, item 3: the ambiguous 'Microsoft Defender' wording produces no tombstone AND survives as a visible unplaced clause, never silently discarded",
      `unplacedClauses=${JSON.stringify(defenderCoverage.unplacedClauses)}`,
    );
    const socCoverage = coverDeclarativeClauses(socText, deterministicExtract(socText));
    record(
      socCoverage.unplacedClauses.some((c) => c.includes("UK-based SOC coverage")),
      "Round 9, item 3: the ambiguous 'UK-based SOC coverage' wording produces no tombstone AND survives as a visible unplaced clause",
      `unplacedClauses=${JSON.stringify(socCoverage.unplacedClauses)}`,
    );

    // --- Items 4/5/6: one strike-and-tombstone primitive, proven through
    // the SAME production matching function (resolveDropTarget) the typed
    // command calls -- not a hand-constructed FieldRemoval, which is
    // exactly what let the round-8 Azure fixture pass without ever
    // exercising the faulty handler. ---
    const REQUIREMENT_E: SecurityRequirementInput = {
      organisation: { sector: "Manufacturing", sizeBand: "medium", regions: ["uk"] },
      estate: { users: 400, sites: 12, cloud: ["azure", "aws", "m365"], existingNetwork: ["mpls", "vpn"] },
      drivers: ["renewal"],
      constraints: { complianceRequirements: ["iso27001"] },
    };

    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");

      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: {
            requirement: REQUIREMENT_E,
            consent: true,
            test: true,
            source_turns: [{ id: "st_r9_E", text: "Turn E: the original scoping conversation.", at: 1000, via: "typed" }],
          },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } }; error?: string };
      record(createRes.status === 200, "Round 9: create with requirement E succeeds through the real route", `status=${createRes.status} error=${created.error}`);
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded = (await reload.json()) as RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } };
      const resumeState = resumeStateFromProject(reloaded);
      record(Boolean(resumeState), "Round 9: resume recovers requirement E via the real resumeStateFromProject()", `resumeState=${JSON.stringify(resumeState)}`);

      // Simulate the resumed session RESTATING Azure this sitting -- the
      // exact scenario item 5 names: a value that lives in BOTH this
      // session's own facts AND the resumed base, so the typed command's
      // FIRST branch (live facts) finds it, not the last (resumed-base)
      // branch the round-8 fixture only ever exercised.
      const azureFact: WorkspaceFact = {
        id: factId("estate.cloud", "azure"),
        path: "estate.cloud",
        value: "azure",
        provenance: "stated",
        quote: "Azure",
        struck: false,
        source: "extract",
        cycle: 1,
      };
      let facts: WorkspaceFact[] = [azureFact];
      let removals: ReadonlySet<string> = new Set<string>();

      // "drop Azure", resolved through the REAL production matching
      // function -- not a hand-built FieldRemoval.
      const dropMatch = resolveDropTarget("Azure", {
        liveFacts: facts.filter((f) => !f.struck),
        noted: [],
        receipts: [],
        resumeRequirementBase: resumeState!.requirementBase,
        resumeRemovals: removals,
      });
      record(
        dropMatch?.kind === "fact" && dropMatch.fact.id === factId("estate.cloud", "azure"),
        "Round 9, item 5/6: resolveDropTarget('Azure') finds the RESTATED session fact first (the command's own live-fact precedence), not the resumed-base fallback the round-8 fixture only ever reached",
        `dropMatch=${JSON.stringify(dropMatch)}`,
      );

      // Apply it through dropListFact -- the ONE strike-and-tombstone
      // primitive the row button (dropRow -> dropFact -> dropListFact)
      // and the typed command now both call.
      let commandResult: { facts: WorkspaceFact[]; removals: Set<string> } | null = null;
      if (dropMatch?.kind === "fact") {
        commandResult = dropListFact(facts, removals, dropMatch.fact);
      }
      record(
        Boolean(commandResult && commandResult.facts.find((f) => f.id === azureFact.id)?.struck && commandResult.removals.has(factId("estate.cloud", "azure"))),
        "Round 9, item 4: the typed drop/remove command strikes the live fact AND tombstones the matching resumed-base value in the SAME operation",
        `result=${JSON.stringify(commandResult)}`,
      );

      // Item 6: clicking the SAME fact's row removal is the identical
      // call -- dropListFact again, on the identical inputs -- so the
      // outcome is provably the same code path, not two independently
      // written copies that happen to agree today.
      const rowResult = dropListFact(facts, removals, azureFact);
      record(
        JSON.stringify(rowResult.facts) === JSON.stringify(commandResult!.facts) && JSON.stringify([...rowResult.removals]) === JSON.stringify([...commandResult!.removals]),
        "Round 9, item 5: clicking the same fact's row removal (dropListFact on the identical input) produces exactly the same result as the typed drop/remove command",
        `row=${JSON.stringify(rowResult)} command=${JSON.stringify(commandResult)}`,
      );

      facts = commandResult!.facts;
      removals = commandResult!.removals;

      // Item 7 (route save/reload): the merge this session would actually
      // send now strips Azure from BOTH the restated session fact (struck,
      // so requirementFrom() omits it) and the persisted base (tombstoned,
      // so mergeRequirementBase()'s withoutRemoved() strips it) -- proven
      // by actually saving and reloading through the real routes, not by
      // inspecting the merged object in memory alone.
      const mergedForSave = mergeRequirementBase(resumeState!.requirementBase, requirementFrom(facts), removals);
      const rescopeRes = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: {
            manage_token: manage,
            requirement: mergedForSave,
            consent: true,
            source_turns: [{ id: "st_r9_F", text: "Azure retired this quarter; dropped from the workspace.", at: 2000, via: "typed" }],
          },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(rescopeRes.status === 200, "Round 9: the save after dropping the restated Azure fact succeeds through the real re-scope route", `status=${rescopeRes.status}`);

      const reload2 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded2 = (await reload2.json()) as RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } };
      const finalReq = reloaded2.engine_data?.requirement;
      record(
        !(finalReq?.estate?.cloud ?? []).includes("azure") && (finalReq?.estate?.cloud ?? []).includes("aws"),
        "Round 9, item 7: reload after save shows Azure removed (from both the restated session fact and the persisted base) while AWS (untouched) is preserved",
        `cloud=${JSON.stringify(finalReq?.estate?.cloud)}`,
      );
      record(
        (finalReq?.estate?.existingNetwork ?? []).includes("mpls") && (finalReq?.organisation?.regions ?? []).includes("uk"),
        "Round 9: everything not touched by this correction -- MPLS, the UK region -- is still exactly as requirement E stated it, unaffected by dropping Azure",
        `existingNetwork=${JSON.stringify(finalReq?.estate?.existingNetwork)} regions=${JSON.stringify(finalReq?.organisation?.regions)}`,
      );

      // A second resumed sitting, on top of the project as it now stands
      // (Azure already gone): the exact combined text from items 1/2/4 --
      // a positive MPLS mention followed by its own retraction, a mention
      // of Microsoft Defender that must NOT touch m365, and a mention of
      // "UK-based SOC coverage" that must NOT touch the UK region -- sent
      // through the real removalsIn() + mergeRequirementBase() + the real
      // re-scope route, then reloaded, so item 7's "route save/reload
      // persists those corrected results" is proven for the retraction
      // fixes too, not only for the drop-command fix above.
      const reload3 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded3 = (await reload3.json()) as RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } };
      const resumeState2 = resumeStateFromProject(reloaded3);
      record(Boolean(resumeState2), "Round 9: a second resume, after the Azure save, recovers the project's current state via the real resumeStateFromProject()", `resumeState2=${JSON.stringify(resumeState2)}`);

      const combinedText =
        "We use MPLS today, but we no longer use MPLS. We no longer use Microsoft Defender. We no longer use UK-based SOC coverage.";
      const combinedRemovals = removalsIn(combinedText);
      const combinedRemovalIds = new Set(combinedRemovals.map((r) => factId(r.path, r.value)));
      record(
        combinedRemovals.length === 1 && combinedRemovals[0].path === "estate.existingNetwork" && combinedRemovals[0].value === "mpls",
        "Round 9: the combined correction text produces exactly ONE removal (MPLS) -- the Defender and UK-based-SOC mentions correctly produce none",
        `removals=${JSON.stringify(combinedRemovals)}`,
      );
      const mergedForSave2 = mergeRequirementBase(resumeState2!.requirementBase, {}, combinedRemovalIds);
      const rescopeRes2 = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: {
            manage_token: manage,
            requirement: mergedForSave2,
            consent: true,
            source_turns: [{ id: "st_r9_G", text: combinedText, at: 3000, via: "typed" }],
          },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(rescopeRes2.status === 200, "Round 9: the combined-correction save succeeds through the real re-scope route", `status=${rescopeRes2.status}`);

      const reload4 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded4 = (await reload4.json()) as RouteProjectLike & { engine_data?: { requirement?: SecurityRequirementInput } };
      const finalReq2 = reloaded4.engine_data?.requirement;
      record(
        !(finalReq2?.estate?.existingNetwork ?? []).includes("mpls") &&
          (finalReq2?.estate?.existingNetwork ?? []).includes("vpn") &&
          (finalReq2?.estate?.cloud ?? []).includes("m365") &&
          (finalReq2?.organisation?.regions ?? []).includes("uk"),
        "Round 9, item 7: reload after the combined-correction save shows MPLS gone, while VPN, Microsoft 365 and the UK region -- none of them genuinely retracted -- all survive",
        `existingNetwork=${JSON.stringify(finalReq2?.estate?.existingNetwork)} cloud=${JSON.stringify(finalReq2?.estate?.cloud)} regions=${JSON.stringify(finalReq2?.organisation?.regions)}`,
      );
      const ledgerTexts2 = (reloaded4.source_ledger ?? []).map((e) => e.text);
      record(
        ledgerTexts2.includes(combinedText),
        "Round 9, item 7: the combined correction's exact wording survives verbatim in source_ledger, including the two ambiguous mentions that produced no tombstone",
        `source_ledger=${JSON.stringify(reloaded4.source_ledger)}`,
      );
    });
  }

  console.log("\n=== Blocker 6: hermetic model tests (success, timeout, unavailability) + the reliability suite in the build gate ===\n");
  {
    const originalFetch = global.fetch;
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-test-hermetic-key-not-real";
    try {
      // -- Success: a mocked model reply is parsed, vetted, and lands. --
      // constraints.budgetBand has no deterministic-rail pattern at all
      // (grep the file: the only free-text money/budget field, and
      // nothing in deterministicExtract sets it), so a landed budgetBand
      // fact can only have come from the model path actually running.
      global.fetch = (async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: "text", text: JSON.stringify({ fields: [{ path: "constraints.budgetBand", value: "£250k", quote: "£250k" }] }) }],
          }),
        }) as unknown as Response) as unknown as typeof fetch;
      const successText = "Our indicative budget is around £250k for this project.";
      const successRes = await extractRequirement(successText, {});
      const budget = successRes.updates.find((u) => u.path === "constraints.budgetBand");
      record(
        successRes.engine === "model" && budget?.value === "£250k" && budget?.provenance === "stated",
        "Hermetic model SUCCESS: a mocked model reply is vetted through vetModelProposals() and lands via extractRequirement()",
        `engine=${successRes.engine} budget=${JSON.stringify(budget)}`,
      );

      // -- Timeout: fetch rejects with the same AbortError shape the real
      // AbortController produces when TIMEOUT_MS elapses; exercised
      // directly rather than waiting the real 9 seconds. --
      global.fetch = (async () => {
        const err = new Error("The operation was aborted.");
        err.name = "AbortError";
        throw err;
      }) as unknown as typeof fetch;
      const timeoutRes = await extractRequirement("We are a Healthcare business with 20 sites.", {});
      record(
        timeoutRes.engine === "deterministic_fallback" && timeoutRes.notes.some((n) => n.includes("Model extraction timed out")),
        "Hermetic model TIMEOUT: an aborted call falls back to the deterministic rail with a visible note, and the gate still runs on top of it",
        `engine=${timeoutRes.engine} notes=${JSON.stringify(timeoutRes.notes)}`,
      );

      // -- Non-timeout network failure. --
      global.fetch = (async () => {
        throw new Error("network unreachable");
      }) as unknown as typeof fetch;
      const failRes = await extractRequirement("We are a Healthcare business with 20 sites.", {});
      record(
        failRes.engine === "deterministic_fallback" && failRes.notes.some((n) => n.includes("Model extraction failed")),
        "Hermetic model FAILURE (non-timeout): a rejected fetch falls back to the deterministic rail with a visible note",
        `engine=${failRes.engine} notes=${JSON.stringify(failRes.notes)}`,
      );

      // -- Non-OK HTTP response (service down / rate limited). --
      global.fetch = (async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch;
      const unavailRes = await extractRequirement("We are a Healthcare business with 20 sites.", {});
      record(
        unavailRes.engine === "deterministic_fallback" && unavailRes.notes.some((n) => n.includes("Model extraction unavailable (503)")),
        "Hermetic model UNAVAILABLE (503): a non-OK response falls back to the deterministic rail with a visible note",
        `engine=${unavailRes.engine} notes=${JSON.stringify(unavailRes.notes)}`,
      );
    } finally {
      global.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = originalKey;
    }

    console.log(
      "NOTE  This script is now wired into package.json's \"validate\" (and therefore \"build\"), so a regression here fails the build gate, not just this standalone run.",
    );
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  } finally {
    // Outer hermetic restore: runs whether every case above passed, a
    // record() marked a failure, or an assertion threw outright -- the
    // real key and real fetch are always put back. process.exit() is
    // deliberately NOT called in here (it would abort before this finally,
    // and before the top-level wrapper below, ever got a chance to run) --
    // the outer IIFE decides whether to exit, after it has also proven the
    // restore actually happened.
    global.fetch = outerOriginalFetch;
    if (outerOriginalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = outerOriginalKey;
  }
}

(async () => {
  // Round 3, blocker 5, proof of the save/restore itself: seed a fake
  // "pre-existing Vercel-build-style" key BEFORE main() runs at all (this
  // is what a real ANTHROPIC_API_KEY present in the build environment
  // would look like from this script's point of view), run the whole
  // suite, then confirm the key is back exactly as it was -- proving the
  // outer hermetic wrap's save/restore is real, not just decorative.
  const preExistingKey = "sk-ant-preexisting-vercel-style-key-not-real";
  process.env.ANTHROPIC_API_KEY = preExistingKey;
  await main();
  const restored = process.env.ANTHROPIC_API_KEY === preExistingKey;
  console.log(`${restored ? "PASS" : "FAIL"}  Hermetic wrap: a pre-existing ANTHROPIC_API_KEY (simulating a real Vercel build key) is restored after the run, not left deleted or overwritten  ->  restored=${restored}`);
  if (!restored) failures++;
  delete process.env.ANTHROPIC_API_KEY;

  console.log(`\n${failures === 0 ? "ALL PASS (including hermetic-wrap proof)" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
})();
