/**
 * P3.4: the earned-question engine (spec v1.5 sections 13.14 and 13.16,
 * Robert's go, 23 July 2026). "The world's procurement experience becomes
 * part of the desk": the questions buyers repeatedly ask AI engines become
 * questions the desk asks, under the EARNED-QUESTION LAW: a question
 * surfaces only when something the buyer contributed summons it, and the
 * desk asks the minimum necessary to improve certainty. No trigger, no
 * question, ever. An unearned question is noise wearing a question mark.
 *
 * THE ROOT-FACT EXCEPTION (named, ruled by Robert, 28 Jul 2026): a small
 * closed set of root facts, sector and technology scope, may be asked
 * ONCE, unprompted, because nothing a buyer says summons them while the
 * answers change what suppliers are asked: the sector selects its own
 * question pack and the scope selects the question sets. The exception
 * is bounded. Root questions still wait until the position has taken
 * shape, are asked at most once, are dismissable forever, and no other
 * question joins this set without a ruling. Everything else remains
 * earned. This is the law amended in the open, not breached quietly.
 *
 * ONE TRUTH, THREE DOORS: this same set serves the buyer on the desk, AI
 * engines through /workspace/questions.json and llms.txt, and agents
 * through the workspace_cycle MCP tool. Every question carries its own
 * provenance (the furniture has receipts): the real grounding query that
 * earned its place, with citation counts where we genuinely hold them.
 *
 * Evidence sources, honestly tiered:
 *  - bing_ai_live: Bing Webmaster AI Performance, read 23 Jul 2026 (90-day
 *    window to 20 Jul: 75.8K citations, 1,034 grounding queries), counts
 *    verbatim from the report.
 *  - bing_ai_2107: the 21 Jul evidence round recorded in the llms.txt
 *    commit (1,016 grounding queries; security-worded counts).
 *  - buyer_archetype: recurring buyer questions Robert catalogued from AI
 *    conversations (22 Jul brief), no counts claimed.
 *
 * PURE: no I/O, no React. The desk and the MCP tool call the same
 * function and read the same earned list (Article 17).
 */

import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import type { BuyingId } from "@/lib/workspace/extract";
import { PACK_QUESTIONS } from "@/lib/sector/packs";
import { QUESTION_BANK } from "@/lib/rfp-question-bank";

/* The pack-count range for the root sector question is computed from the
 * bank, never typed (rule 16: counted claims are counted). */
const PACK_SIZES = Object.values(QUESTION_BANK.sector_packs).map((p) => p.count);
const MIN_PACK = Math.min(...PACK_SIZES);
const MAX_PACK = Math.max(...PACK_SIZES);

export type QuestionEvidence =
  | { source: "bing_ai_live"; query: string; citations: number; note?: string }
  | { source: "bing_ai_2107"; query: string; citations: number }
  | { source: "buyer_archetype"; query: string }
  /** Sector query families read from Robert's consoles, 24 Jul 2026
   *  (healthcare strongest); counts not claimed because none were recorded. */
  | { source: "console_sector_2407"; query: string };

/** What answering a chip does: land existing taxonomy items (real facts or
 *  noted wants, through the desk's own click machinery), or record a
 *  stated note verbatim. "dismiss" answers the question in the negative. */
export type QuestionAnswer =
  | { kind: "items"; itemIds: string[] }
  | { kind: "note"; text: string }
  | { kind: "path"; path: "constraints.timeline" | "organisation.sector"; control: "text"; placeholder: string }
  | { kind: "dismiss" };

export type EarnedQuestion = {
  id: string;
  question: string;
  /** Taxonomy section the question renders inside (in place, 13.6). */
  section: string;
  /** Priority when more questions are earned than the cap shows. */
  weight: number;
  options: Array<{ label: string; answer: QuestionAnswer }>;
  evidence: QuestionEvidence[];
};

type Ctx = {
  requirement: SecurityRequirementInput;
  buying: BuyingId | null;
  opModel: string | null;
  notedIds: string[];
  dismissed: string[];
  /** The buyer's own words (quotes, receipts, title), for pack flavour
   *  detection only. Optional and conservative: empty means no flavour. */
  corpus: string;
};

const sectorIs = (r: SecurityRequirementInput, re: RegExp) => re.test(String(r.organisation?.sector ?? ""));
const hasCloud = (r: SecurityRequirementInput, c: string) => (r.estate?.cloud ?? []).includes(c);
const hasNet = (r: SecurityRequirementInput, n: string) => (r.estate?.existingNetwork ?? []).includes(n);
const hasCompliance = (r: SecurityRequirementInput, c: string) => (r.constraints?.complianceRequirements ?? []).includes(c);
const networkBuying = (b: BuyingId | null) => b === "sase" || b === "sdwan" || b === "sse";

/** The set. Every entry names its trigger in `earnedBy` and its suppressor
 *  in the guard: minimum questions necessary, never duplicated against a
 *  fact that already stands or a rulebook gap that already asks. */
const QUESTIONS: Array<EarnedQuestion & { earnedBy: (c: Ctx) => boolean }> = [
  /* ---- The root facts (the named exception in the law above). Wording
          PROVISIONAL pending Harry Yelland's copy pass; the pack-count
          range is computed, never typed. Each asks once, when the
          position has taken shape, and dismisses forever. ---- */
  {
    id: "q-root-sector",
    question: `Which sector are you in? It changes the questions we put to vendors: your sector adds between ${MIN_PACK} and ${MAX_PACK} of its own.`,
    section: "organisation",
    weight: 95,
    earnedBy: (c) => !c.requirement.organisation?.sector && c.buying !== null,
    options: [
      { label: "type it", answer: { kind: "path", path: "organisation.sector", control: "text", placeholder: "e.g. Healthcare, Retail, Financial services" } },
      { label: "Prefer not to say", answer: { kind: "dismiss" } },
    ],
    evidence: [{ source: "buyer_archetype", query: "Which sector is the buyer in? The sector selects its vendor question pack." }],
  },
  {
    id: "q-root-scope",
    question: "Are you buying SASE, SD-WAN or SSE? The technology scope selects which question sets vendors answer.",
    section: "objectives",
    weight: 93,
    earnedBy: (c) =>
      c.buying === null &&
      (Boolean(c.requirement.organisation?.sector) ||
        typeof c.requirement.estate?.sites === "number" ||
        (c.requirement.organisation?.regions ?? []).length > 0 ||
        (c.requirement.constraints?.complianceRequirements ?? []).length > 0),
    options: [
      { label: "SASE", answer: { kind: "items", itemIds: ["buy-sase"] } },
      { label: "SD-WAN", answer: { kind: "items", itemIds: ["buy-sdwan"] } },
      { label: "SSE", answer: { kind: "items", itemIds: ["buy-sse"] } },
      { label: "Managed security", answer: { kind: "items", itemIds: ["buy-sec"] } },
      { label: "Not sure yet", answer: { kind: "dismiss" } },
    ],
    evidence: [{ source: "buyer_archetype", query: "What technology scope is being bought? The scope selects the vendor question sets." }],
  },
  {
    id: "q-fca",
    question: "Financial services often brings FCA obligations. Do they apply to this service?",
    section: "compliance",
    weight: 90,
    earnedBy: (c) => sectorIs(c.requirement, /financial/i) && !hasCompliance(c.requirement, "fca"),
    options: [
      { label: "FCA applies", answer: { kind: "items", itemIds: ["c-fca"] } },
      { label: "Not applicable", answer: { kind: "dismiss" } },
    ],
    evidence: [{ source: "bing_ai_live", query: "secure SD-WAN vendors for financial institutions", citations: 1200 }],
  },
  {
    id: "q-dspt",
    question: "Healthcare usually means NHS DSPT. Does it apply here?",
    section: "compliance",
    weight: 90,
    earnedBy: (c) => sectorIs(c.requirement, /health|pharma/i) && !hasCompliance(c.requirement, "nhs_dspt"),
    options: [
      { label: "NHS DSPT applies", answer: { kind: "items", itemIds: ["c-dspt"] } },
      { label: "Not applicable", answer: { kind: "dismiss" } },
    ],
    evidence: [{ source: "bing_ai_live", query: "top SD-WAN vendors healthcare industry", citations: 550 }],
  },
  {
    id: "q-azure-vwan",
    question: "You run Azure. Is Azure Virtual WAN integration in scope?",
    section: "estate",
    weight: 80,
    earnedBy: (c) => hasCloud(c.requirement, "azure"),
    options: [
      { label: "In scope", answer: { kind: "note", text: "Azure Virtual WAN integration in scope" } },
      { label: "Not in scope", answer: { kind: "dismiss" } },
    ],
    evidence: [{ source: "buyer_archetype", query: "Does the vendor support Azure Virtual WAN?" }],
  },
  {
    id: "q-mpls-keep",
    question: "You run MPLS today. Keep some circuits through migration, or full replacement?",
    section: "estate",
    weight: 85,
    earnedBy: (c) => hasNet(c.requirement, "mpls") && networkBuying(c.buying),
    options: [
      { label: "Keep some circuits", answer: { kind: "note", text: "Some MPLS circuits retained through migration" } },
      { label: "Full replacement", answer: { kind: "note", text: "Full MPLS replacement" } },
    ],
    evidence: [
      { source: "buyer_archetype", query: "Can I keep existing circuits?" },
      { source: "bing_ai_live", query: "leading SD-WAN providers unified SASE deployments", citations: 380 },
    ],
  },
  {
    id: "q-residency",
    question: "Sites beyond the UK: is in-country breakout and data residency required?",
    section: "estate",
    weight: 82,
    earnedBy: (c) => (c.requirement.organisation?.regions ?? []).some((r) => r !== "uk" && r !== "ie"),
    options: [
      { label: "Required", answer: { kind: "note", text: "In-country breakout and data residency required" } },
      { label: "Not required", answer: { kind: "dismiss" } },
    ],
    evidence: [
      { source: "bing_ai_live", query: "scalable SASE providers for multinational organizations", citations: 879 },
      { source: "bing_ai_live", query: "affordable SASE providers for global enterprise networks", citations: 992 },
    ],
  },
  {
    id: "q-support",
    question: "Fully managed usually raises support cover. What does good look like?",
    section: "support",
    weight: 75,
    earnedBy: (c) => c.opModel === "managed" && !c.notedIds.includes("s-247") && !c.notedIds.includes("s-uk"),
    options: [
      { label: "24x7", answer: { kind: "items", itemIds: ["s-247"] } },
      { label: "24x7 with a UK desk", answer: { kind: "items", itemIds: ["s-247", "s-uk"] } },
      { label: "Standard hours are fine", answer: { kind: "dismiss" } },
    ],
    evidence: [
      { source: "buyer_archetype", query: "Which vendors offer 24x7 UK support?" },
      { source: "bing_ai_2107", query: "MSSP UK", citations: 60 },
    ],
  },
  {
    id: "q-sse-scope",
    question: "Full SASE covers several security controls. Which are in scope for you?",
    section: "security",
    weight: 88,
    earnedBy: (c) => c.buying === "sase" && !c.notedIds.some((n) => n.startsWith("sse-")),
    options: [
      { label: "ZTNA", answer: { kind: "items", itemIds: ["sse-ztna"] } },
      { label: "SWG", answer: { kind: "items", itemIds: ["sse-swg"] } },
      { label: "CASB", answer: { kind: "items", itemIds: ["sse-casb"] } },
      { label: "DLP", answer: { kind: "items", itemIds: ["sse-dlp"] } },
      /* FWaaS joined the quick answers (Harry's Section 1 ask, 28 Jul
       * 2026): it is one of the controls the question is about, and a
       * one-tap answer beats retyping it. Nothing pre-ticks: consented
       * stated facts only. */
      { label: "FWaaS / NGFW", answer: { kind: "items", itemIds: ["sse-fwaas"] } },
    ],
    evidence: [
      { source: "bing_ai_2107", query: "zero trust network access providers", citations: 178 },
      { source: "bing_ai_live", query: "trusted SASE vendors hybrid work environments", citations: 510 },
    ],
  },
  {
    id: "q-sase-shape",
    question: "One platform or best-of-breed: which shape of SASE are you buying?",
    section: "objectives",
    weight: 89,
    earnedBy: (c) => c.buying === "sase" && !c.notedIds.includes("obj-unified") && !c.notedIds.includes("obj-bob"),
    options: [
      { label: "Single-vendor platform", answer: { kind: "items", itemIds: ["obj-unified"] } },
      { label: "Best-of-breed stack", answer: { kind: "items", itemIds: ["obj-bob"] } },
      { label: "Undecided, ask the market", answer: { kind: "dismiss" } },
    ],
    evidence: [
      { source: "bing_ai_live", query: "Aryaka Networks vs Cato Networks SASE SD-WAN comparison", citations: 663, note: "platform-choice research; 55 to 63 percent citation share across the comparison family" },
      { source: "bing_ai_live", query: "leading SASE products SD-WAN cloud security", citations: 420 },
    ],
  },
  {
    id: "q-contract-end",
    question: "When do you need this live, or when does the current contract end?",
    section: "commercial",
    /* 92, raised from 84 on 30 Jul 2026. The desk shows the top TWO earned
     * questions by weight, so at 84 this sat below FCA (90), DSPT (90),
     * SASE shape (89) and SSE scope (88) and was crowded out of every
     * session, Harry's included. A detail that BLOCKS PUBLICATION (R7)
     * must outrank a refinement that improves an answer, which is the same
     * principle that already puts sector at 95 and scope at 93. It stays
     * below those two so the opening questions do not change. */
    weight: 92,
    /* Timeline is one of the five details a notice cannot publish without
     * (R7), and until 30 Jul 2026 this question was only earned when the
     * drivers already named a renewal. Everyone else was never asked, and
     * the deterministic rail does not read dates, so the only route in was
     * mentioning timing unprompted. It is now earned by any project that
     * has said something real and still has no timeline. */
    earnedBy: (c) => !c.requirement.constraints?.timeline,
    options: [{ label: "type it", answer: { kind: "path", path: "constraints.timeline", control: "text", placeholder: "e.g. March 2027" } }],
    evidence: [{ source: "buyer_archetype", query: "Our contract renews soon, which providers can migrate in time?" }],
  },
  {
    id: "q-resilience",
    question: "At your site count, is dual-circuit resilience per site required?",
    section: "estate",
    weight: 70,
    earnedBy: (c) => (c.requirement.estate?.sites ?? 0) >= 10 && networkBuying(c.buying),
    options: [
      { label: "Required", answer: { kind: "note", text: "Dual-circuit resilience per site required" } },
      { label: "Critical sites only", answer: { kind: "note", text: "Dual-circuit resilience at critical sites only" } },
      { label: "Not required", answer: { kind: "dismiss" } },
    ],
    evidence: [{ source: "buyer_archetype", query: "Which providers support dual-carrier resilience?" }],
  },
];

/** The earned list for the current position, weight-ordered, dismissals
 *  honoured. The CAP is applied by the caller (the desk shows at most two
 *  at once; agents may read the full list). */
export function earnedQuestions(
  requirement: SecurityRequirementInput,
  buying: BuyingId | null,
  opModel: string | null,
  notedIds: string[],
  dismissed: string[],
  corpus = "",
): EarnedQuestion[] {
  const ctx: Ctx = { requirement, buying, opModel, notedIds, dismissed, corpus };
  const packEarned = PACK_QUESTIONS.filter(
    (q) => !dismissed.includes(q.id) && q.earnedBy({ requirement, buying, opModel, notedIds, corpus }),
  ).map(({ earnedBy: _e, earnedByProse: _p, ...q }) => q);
  return [
    ...QUESTIONS.filter((q) => !dismissed.includes(q.id) && q.earnedBy(ctx)).map(({ earnedBy: _e, ...q }) => q),
    ...packEarned,
  ].sort((a, b) => b.weight - a.weight);
}

/** The full published set (triggers described in prose, for the machine
 *  feeds): what the desk asks and why each question earned its place. */
export function publishedQuestionSet() {
  const pack = PACK_QUESTIONS.map(({ earnedBy: _e, earnedByProse, ...q }) => ({ ...q, earned_by: earnedByProse }));
  return [...QUESTIONS.map(({ earnedBy: _e, ...q }) => ({
    ...q,
    earned_by:
      q.id === "q-fca" ? "the buyer's sector is financial services" :
      q.id === "q-dspt" ? "the buyer's sector is healthcare" :
      q.id === "q-azure-vwan" ? "Azure stands in the stated estate" :
      q.id === "q-mpls-keep" ? "MPLS stands in the stated estate and a network service is being bought" :
      q.id === "q-residency" ? "stated regions extend beyond the UK and Ireland" :
      q.id === "q-support" ? "a fully managed operating model is stated" :
      q.id === "q-sse-scope" ? "SASE is being bought and no SSE control is selected yet" :
      q.id === "q-sase-shape" ? "SASE is being bought and neither platform shape is selected yet" :
      q.id === "q-contract-end" ? "a contract renewal is a stated driver" :
      "dual-circuit resilience: ten or more sites and a network service",
  })), ...pack];
}
