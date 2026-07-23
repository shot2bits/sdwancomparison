/**
 * Fixtures for the Continuation derivation rulebook: success AND failure
 * per family (Robert's brief, 23 Jul 2026). The failure cases assert
 * exact null, because null is the law: downstream, null means no UI, no
 * assistant lane, no JSON-LD and no twin entry (the component and the
 * twin routes early-return on null; walked in production verification).
 *
 * Run: npx tsx -e "import('./src/lib/continuation/fixtures.ts').then(m=>m.runContinuationTests()).then(r=>console.log(r))"
 * Also gated into every build via scripts/validate-continuations.ts.
 */

import type { Vendor } from "@data/schema";
import { CONTINUATIONS_VERSION, FAMILY_LABELS, continuationForTwin, continuationJsonLd, continuationUrl } from "./types";
import {
  deriveContinuation,
  deriveContinuationComparison,
  deriveContinuationCost,
  deriveContinuationQuestion,
  deriveContinuationSampleRfp,
  deriveContinuationSector,
  deriveContinuationTool,
  deriveContinuationVendor,
} from "./derive";

export interface ContinuationTestResult { pass: number; fail: number; failures: string[] }

/** A minimal evaluated vendor, shaped only as far as the derivers read. */
function evaluatedVendor(slug = "cato-networks", name = "Cato Networks", category = "Single-vendor SASE platform"): Vendor {
  return {
    slug,
    name,
    category,
    last_verified: "2026-07-13",
    capabilities: { ztna: { grade: "yes" } },
  } as unknown as Vendor;
}

export async function runContinuationTests(): Promise<ContinuationTestResult> {
  const r: ContinuationTestResult = { pass: 0, fail: 0, failures: [] };
  const ok = (name: string, fn: () => void) => {
    try { fn(); r.pass += 1; } catch (e) { r.fail += 1; r.failures.push(`${name}: ${(e as Error).message}`); }
  };
  const expect = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

  /* ---- Vendor ---- */
  ok("evaluated vendor with capabilities derives", () => {
    const c = deriveContinuationVendor(evaluatedVendor());
    expect(c !== null, "should derive");
    expect(c!.version === CONTINUATIONS_VERSION, "version stamp");
    expect(c!.label === FAMILY_LABELS.vendor, "label from the family map");
    expect(!/workspace/i.test(c!.label), "label law: the product name never leads");
    expect(c!.stamp.includes("Cato Networks") && c!.stamp.includes("13 Jul 2026"), "stamp carries name and evaluation date");
    expect(c!.pins.length === 1 && c!.pins[0] === "cato-networks", "vendor arrives pinned");
    expect(c!.sentence.includes("Cato Networks"), "sentence speaks the vendor");
  });
  ok("managed provider category shapes the sentence honestly", () => {
    const c = deriveContinuationVendor(evaluatedVendor("orange-business", "Orange Business", "Managed SASE provider"));
    expect(c !== null && c.sentence.includes("managed provider"), "provider phrasing derives from category");
  });
  ok("unevaluated vendor derives nothing", () => {
    const v = { ...evaluatedVendor(), last_verified: undefined } as unknown as Vendor;
    expect(deriveContinuationVendor(v) === null, "no evaluation date, no entry");
  });
  ok("vendor without graded capabilities derives nothing", () => {
    const v = { ...evaluatedVendor(), capabilities: {} } as unknown as Vendor;
    expect(deriveContinuationVendor(v) === null, "context without sufficiency is null");
  });

  /* ---- Comparison ---- */
  ok("both vendors derive: the pair derives with both pinned", () => {
    const c = deriveContinuationComparison(evaluatedVendor(), evaluatedVendor("zscaler", "Zscaler"));
    expect(c !== null, "should derive");
    expect(c!.pins.join(",") === "cato-networks,zscaler", "both pinned in order");
    expect(c!.sentence.includes("Cato Networks") && c!.sentence.includes("Zscaler"), "sentence names both");
  });
  ok("either side null: the pair derives nothing", () => {
    const bad = { ...evaluatedVendor("zscaler", "Zscaler"), last_verified: undefined } as unknown as Vendor;
    expect(deriveContinuationComparison(evaluatedVendor(), bad) === null, "one insufficient side nulls the pair");
    expect(deriveContinuationComparison(null, evaluatedVendor()) === null, "a missing side nulls the pair");
  });

  /* ---- Sector (the Bridge, carried over) ---- */
  ok("healthcare sector derives with the pack-held deep claim", () => {
    const c = deriveContinuationSector({ sectorKey: "healthcare", sectorLabel: "Healthcare", pageTitle: "Best SASE for healthcare", pins: ["cato-networks"] });
    expect(c !== null, "should derive");
    expect(c!.sentence.includes("healthcare provider"), "the shipped Bridge prefill survives verbatim");
    expect(Boolean(c!.deepClaim && c!.deepClaim.includes("HSCN")), "deep claim only where the pack holds it");
  });
  ok("unmapped sector falls back to the true-everywhere sentence, no deep claim", () => {
    const c = deriveContinuationSector({ sectorKey: "space-mining", sectorLabel: "Space mining", pageTitle: "A page" });
    expect(c !== null && c.sentence.includes("replacing legacy connectivity"), "generic sentence");
    expect(c!.deepClaim === undefined, "no invented sector claims");
  });
  ok("a sector source without a page title derives nothing", () => {
    expect(deriveContinuationSector({ sectorKey: "healthcare", pageTitle: "" }) === null, "null");
  });

  /* ---- Shortlist tool ---- */
  ok("populated shortlist derives with pins capped at five", () => {
    const c = deriveContinuationTool({
      names: ["Cato Networks", "Zscaler", "Netskope", "Versa Networks", "Fortinet", "Palo Alto"],
      slugs: ["cato-networks", "zscaler", "netskope", "versa-networks", "fortinet", "palo-alto-networks"],
      considered: 30,
    });
    expect(c !== null, "should derive");
    expect(c!.pins.length === 5, "pins capped at five");
    expect(c!.sentence.includes("Cato Networks") && !c!.sentence.includes("Palo Alto"), "sentence names the top four only");
  });
  ok("empty shortlist derives nothing", () => {
    expect(deriveContinuationTool({ names: [], slugs: [], considered: 30 }) === null, "empty tool, no entry");
  });

  /* ---- Cost tool ---- */
  ok("a produced estimate derives from the buyer's own numbers", () => {
    const c = deriveContinuationCost({ hasEstimate: true, users: 1200, sites: 45, managed: true });
    expect(c !== null && c.sentence.includes("45 sites") && c.sentence.includes("1,200"), "their numbers, no invention");
  });
  ok("the pristine calculator derives nothing", () => {
    expect(deriveContinuationCost({ hasEstimate: false, users: 1000, sites: 20, managed: true }) === null, "no estimate, no entry");
  });

  /* ---- Question bank and sample RFP ---- */
  ok("a populated question bank derives", () => {
    const c = deriveContinuationQuestion({ packCount: 3, questionCount: 115 });
    expect(c !== null && c.stamp.includes("115"), "stamp carries the real count");
  });
  ok("an empty bank derives nothing", () => {
    expect(deriveContinuationQuestion({ packCount: 0, questionCount: 0 }) === null, "null");
  });
  ok("the sample RFP derives; an untitled sample derives nothing", () => {
    expect(deriveContinuationSampleRfp({ sampleTitle: "UK retailer SD-WAN" }) !== null, "derives");
    expect(deriveContinuationSampleRfp({ sampleTitle: "" }) === null, "null");
  });

  /* ---- The dispatcher and the machine lanes ---- */
  ok("the dispatcher routes every family", () => {
    expect(deriveContinuation({ kind: "vendor", vendor: evaluatedVendor() }) !== null, "vendor route");
    expect(deriveContinuation({ kind: "question", packCount: 1, questionCount: 10 }) !== null, "question route");
  });
  ok("the workspace URL carries the words and the pins, human links untagged", () => {
    const url = continuationUrl("We are evaluating Cato Networks.", ["cato-networks"]);
    expect(url.startsWith("https://netify.co.uk/?"), "one door");
    expect(url.includes("vendors=cato-networks"), "pins travel");
    expect(!url.includes("utm_"), "page-served human links carry no attribution tag");
  });
  ok("twin serialisation carries version and the tagged action link", () => {
    const c = deriveContinuationVendor(evaluatedVendor())!;
    const t = continuationForTwin(c);
    expect(t.version === CONTINUATIONS_VERSION, "version in the twin");
    expect(t.action.url.includes("utm_medium=twin"), "twin action links carry attribution");
    expect(t.opens === "Your procurement on Netify", "provenance line in the twin");
  });
  ok("JSON-LD names the rules that produced it", () => {
    const c = deriveContinuationVendor(evaluatedVendor())!;
    const ld = continuationJsonLd(c, "https://netify.co.uk/sase/vendors/cato-networks") as { identifier: string; description: string };
    expect(ld.identifier === CONTINUATIONS_VERSION, "version is the identifier");
    expect(ld.description.includes("vendor:cato-networks"), "source named");
  });

  /* ---- v2026.2, the consolidation respeak (Robert, 23 Jul evening) ---- */
  ok("the document families speak their instruments", () => {
    expect(FAMILY_LABELS.sample_rfp === "Start your own RFP", "sample label");
    expect(FAMILY_LABELS.question === "Build your RFI from these questions", "question label");
    expect(CONTINUATIONS_VERSION === "continuations v2026.2", "rulebook version bumped");
  });
  ok("comparison and sector reassurances carry the ladder, never the old noun", () => {
    const comp = deriveContinuationComparison(evaluatedVendor(), evaluatedVendor("zscaler", "Zscaler"))!;
    expect(comp.reassurance.includes("RFI or a full RFP"), "comparison ladder clause");
    const sector = deriveContinuationSector({ pageTitle: "SASE for healthcare" , sectorKey: "healthcare", sectorLabel: "Healthcare" })!;
    expect(sector.reassurance.includes("curated marketplace"), "sector speaks the marketplace");
    for (const c of [comp, sector]) expect(!/workspace recommends/i.test(c.reassurance), "old mechanic gone");
  });

  return r;
}
