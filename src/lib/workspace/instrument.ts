/**
 * The instrument ladder (the consolidation; wave one 23 Jul, wave two
 * "KEEP GOING" the same night). One desk, three instruments: the buyer
 * never chooses a document type at the door; the position's own state
 * derives what it holds and what each formality still needs.
 *
 * THE LAW, EXECUTABLE: no derivation, no rendering. A desk with no
 * started position derives null and the rail simply does not exist.
 * Every note is a statement of fact about THIS position, never a promise
 * about the platform's roadmap.
 *
 * Wave two makes the RFI and the full RFP earnable:
 * - The RFI earns when the position's open questions have landed and its
 *   covered areas summon a real question set from the curated bank
 *   (deriveRfiQuestionSet below: bank v2026.1, 386 analyst-written
 *   questions; canonical categories earn per covered section, the sector
 *   pack joins when the buyer's own stated sector matches one).
 * - The full RFP earns on top of a ready RFI when the buyer has weighted
 *   scoring priorities and the position holds a commercial claim.
 * Nothing here invents a question or a weight: the bank is the source,
 * the buyer weights, the position earns.
 */

import { QUESTION_BANK, BANK_VERSION, type BankCanonicalQuestion } from "@/lib/rfp-question-bank";

/* ------------------------------------------------------------------ */
/* The RFI question set: derived from the covered areas + the bank      */
/* ------------------------------------------------------------------ */

export interface RfiQuestionSet {
  /** The bank version that produced this set. */
  version: string;
  canonical: { category: string; questions: BankCanonicalQuestion[] }[];
  canonicalCount: number;
  sectorPack: { key: string; label: string; count: number; sections: string[] } | null;
  total: number;
}

/** Which desk sections earn each canonical category. A category joins the
 *  set when any of its sections holds a standing claim; Vendor Evidence
 *  joins whenever the set is otherwise non-empty (evidence questions are
 *  universal to a real procurement). A rulebook, fixtured like every
 *  other one. */
const CATEGORY_EARN: Record<string, string[]> = {
  "SD-WAN Integration": ["estate", "drivers", "model"],
  "Deployment": ["estate", "change"],
  "Identity / ZTNA": ["security"],
  "SWG / CASB / DLP": ["security"],
  "FWaaS / Threat": ["security"],
  "Logging / SIEM": ["security", "support"],
  "Data Residency": ["compliance", "organisation"],
  "Service Model": ["model", "support", "services"],
  "Commercials": ["commercial"],
};

/** Stated-sector text to bank pack key; absent match, no pack, never a
 *  guess. */
const PACK_MATCHERS: Array<[RegExp, string]> = [
  [/(healthcare|nhs|clinic|hospital|pharma)/i, "healthcare"],
  [/(retail|e-?commerce|stores)/i, "retail_ecommerce"],
  [/(manufactur|industrial|plant)/i, "manufacturing"],
  [/(financ|bank|insur|fintech|trading)/i, "financial_services"],
];

export function deriveRfiQuestionSet(src: {
  coveredSections: string[];
  sector?: string | null;
}): RfiQuestionSet | null {
  const covered = new Set(src.coveredSections);
  const byCat = new Map<string, BankCanonicalQuestion[]>();
  for (const q of QUESTION_BANK.canonical) {
    const earn = CATEGORY_EARN[q.category];
    if (!earn) continue;
    if (earn.some((s) => covered.has(s))) byCat.set(q.category, [...(byCat.get(q.category) ?? []), q]);
  }
  if (byCat.size === 0) return null;
  const canonical = [...byCat.entries()].map(([category, questions]) => ({ category, questions }));
  const evidence = QUESTION_BANK.canonical.filter((q) => q.category === "Vendor Evidence");
  if (evidence.length > 0) canonical.push({ category: "Vendor Evidence", questions: evidence });
  const packKey = src.sector ? PACK_MATCHERS.find(([re]) => re.test(src.sector as string))?.[1] ?? null : null;
  const pack = packKey ? QUESTION_BANK.sector_packs[packKey] : undefined;
  const sectorPack = pack && packKey
    ? { key: packKey, label: pack.label, count: pack.count, sections: pack.sections.map((s) => s.title) }
    : null;
  const canonicalCount = canonical.reduce((n, c) => n + c.questions.length, 0);
  return { version: BANK_VERSION, canonical, canonicalCount, sectorPack, total: canonicalCount + (sectorPack?.count ?? 0) };
}

/* ------------------------------------------------------------------ */
/* The ladder                                                          */
/* ------------------------------------------------------------------ */

export interface InstrumentLadder {
  /** The living document the desk builds. Live by definition once derived. */
  sor: { state: "live" };
  rfi: { state: "horizon" | "ready"; note: string };
  rfp: { state: "horizon" | "ready"; note: string };
}

export type EarnedInstrument = "sor" | "rfi" | "rfp";

export function deriveInstrumentLadder(src: {
  started: boolean;
  claims: number;
  openQuestions: number;
  /** Total questions the position's own areas summon (0 when none). */
  rfiQuestions: number;
  /** Sections the buyer has weighted high for scoring. */
  prioritiesSet: number;
  /** Standing claims in the commercial section. */
  commercialClaims: number;
}): InstrumentLadder | null {
  if (!src.started || src.claims <= 0) return null;
  const rfiReady = src.openQuestions === 0 && src.rfiQuestions > 0;
  const rfi = rfiReady
    ? { state: "ready" as const, note: `ready · ${src.rfiQuestions} questions from your position` }
    : src.openQuestions > 0
      ? { state: "horizon" as const, note: "ready when your open questions land" }
      : { state: "horizon" as const, note: "your areas summon their questions as you describe" };
  const missing: string[] = [];
  if (src.prioritiesSet === 0) missing.push("scoring priorities");
  if (src.commercialClaims === 0) missing.push("a commercial claim (budget, term or timeline)");
  const rfp = !rfiReady
    ? { state: "horizon" as const, note: "needs scoring priorities and commercials" }
    : missing.length > 0
      ? { state: "horizon" as const, note: `needs ${missing.join(" and ")}` }
      : { state: "ready" as const, note: `weighted on ${src.prioritiesSet} priorit${src.prioritiesSet === 1 ? "y" : "ies"}` };
  return { sor: { state: "live" }, rfi, rfp };
}

/** The highest earned instrument: what the publish verb may truthfully
 *  name, because the issued brief declares it (the instrument line rides
 *  the created requirement's notes verbatim). */
export function earnedInstrument(ladder: InstrumentLadder | null): EarnedInstrument {
  if (!ladder) return "sor";
  if (ladder.rfp.state === "ready") return "rfp";
  if (ladder.rfi.state === "ready") return "rfi";
  return "sor";
}

/** The supplier-facing declaration for the created requirement's notes:
 *  compact, factual, nothing invented. Null for a plain SoR (today's
 *  behaviour, unchanged). */
export function instrumentNotesLine(src: {
  instrument: EarnedInstrument;
  set: RfiQuestionSet | null;
  weightedHigh: string[];
  commercialClaims: number;
}): string | null {
  if (src.instrument === "sor" || !src.set) return null;
  const cats = src.set.canonical.map((c) => c.category).join(", ");
  const pack = src.set.sectorPack ? ` plus the ${src.set.sectorPack.label} pack (${src.set.sectorPack.count})` : "";
  const base = `Instrument: ${src.instrument.toUpperCase()}. Question set: ${src.set.canonicalCount} canonical questions (${cats})${pack} · bank v${src.set.version}.`;
  if (src.instrument === "rfi") return base;
  return `${base} Priorities weighted high: ${src.weightedHigh.join(", ")}. Commercial position stated (${src.commercialClaims} claim${src.commercialClaims === 1 ? "" : "s"}).`;
}
