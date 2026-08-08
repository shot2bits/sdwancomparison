/**
 * Milestone 1, Commit 11C: the single authoritative source for bounded,
 * human-reviewed glossary explanations in the isolated Quick Understanding
 * preview (Article 17: one truth — glossary copy is defined here once,
 * never duplicated inside a component or a validation script).
 *
 * This is NOT a chatbot, NOT general question answering, and NOT
 * model-generated text. It is a small fixed lookup table of reviewed
 * definitions for a closed, approved term set, plus a narrow, deterministic
 * recognition function that matches a small set of glossary-style question
 * phrasings ("What is X?", "What does X mean?", "Explain X.", "Can you
 * explain X?") against that fixed term set. Anything that is not an exact
 * match — including a substantive project statement that merely happens to
 * contain a glossary term ("We need SASE across 50 sites.", "Suppliers must
 * explain their SASE design.") — returns null. There is no substring
 * matching, no keyword scan, no stemming, and no model call: recognition is
 * a plain lookup against a precomputed Set of accepted normalised phrases,
 * the same technique QuickSorWorkspace.tsx's own
 * isNarrowClarificationMessage() already uses for the five narrow
 * clarification phrases.
 *
 * Scope, explicitly bounded per the Commit 11C instructions: this module
 * does not explain WHY Netify asked any particular question (EarnedQuestion
 * currently has no authoritative buyer-facing rationale — inventing one
 * here would violate that), does not select or rank a current
 * EarnedQuestion, does not read the fact ledger, does not call any API or
 * model, and does not implement a Next Step policy. It answers exactly one
 * question: "does this input, read literally, ask what a term from the
 * approved list means — and if so, what is the reviewed definition?"
 *
 * Definitions are the approved starting copy given in the Commit 11C
 * instructions verbatim — no existing canonical buyer-facing glossary
 * sentence set was found elsewhere in this repository to reuse instead
 * (searched for the ten approved terms' defining sentences across src/;
 * every existing mention is either a short UI label/help string or
 * embedded in unrelated prose, not a reviewed glossary definition — see
 * the Commit 11C report for the search that was run before writing this
 * file, per the stop-condition requiring a check for a conflicting
 * canonical source first).
 */

export type WorkspaceExplanation = {
  term: string;
  question: string;
  explanation: string;
};

type GlossaryTerm = {
  /** Canonical display form, exactly as approved. */
  term: string;
  definition: string;
};

/**
 * The single authoritative glossary table. Ten approved terms only — no
 * term is added, removed or reworded without a separate approval, per the
 * Commit 11C "Approved glossary scope" section.
 */
const GLOSSARY: readonly GlossaryTerm[] = [
  {
    term: "SASE",
    definition:
      "Secure Access Service Edge combines networking and security capabilities in a cloud-delivered architecture, commonly bringing together SD-WAN, secure web access, private application access and related security controls.",
  },
  {
    term: "SD-WAN",
    definition:
      "Software-Defined Wide Area Networking manages connectivity between sites, users and cloud services using software-defined policies across one or more network connections.",
  },
  {
    term: "SSE",
    definition:
      "Security Service Edge is the security-focused part of SASE, commonly covering secure web access, private application access, cloud access controls and related security services.",
  },
  {
    term: "PCI DSS",
    definition:
      "The Payment Card Industry Data Security Standard defines security requirements for organisations that store, process or transmit payment-card data.",
  },
  {
    term: "Zero Trust",
    definition:
      "Zero Trust is a security approach in which access is continually verified using identity, device, context and policy rather than assumed because a user or device is already inside a network.",
  },
  {
    term: "MDR",
    definition:
      "Managed Detection and Response is a managed security service that monitors for threats, investigates suspicious activity and helps contain or respond to confirmed incidents.",
  },
  {
    term: "SOC",
    definition:
      "A Security Operations Centre is the people, processes and technology used to monitor, investigate and respond to security events.",
  },
  {
    term: "RFI",
    definition:
      "A Request for Information is used to gather structured information from potential suppliers before a formal buying decision or detailed proposal stage.",
  },
  {
    term: "RFP",
    definition:
      "A Request for Proposal asks selected suppliers to respond to a defined requirement with their proposed solution, delivery approach, evidence and commercial terms.",
  },
  {
    term: "Statement of Requirements",
    definition:
      "A Statement of Requirements describes what the buyer needs, the current environment, constraints, desired outcomes and the questions suppliers must address.",
  },
] as const;

/**
 * Narrow, deterministic normalisation — identical philosophy to
 * QuickSorWorkspace.tsx's normaliseForClarificationCheck(): trim, lowercase,
 * collapse ordinary/typographic apostrophe variants to a plain apostrophe,
 * strip trailing punctuation, and collapse repeated whitespace to one
 * space. No stemming, no word removal, no synonym expansion.
 */
function normalise(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[\s.?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Precomputed lookup: every accepted normalised glossary-question phrasing
 * for every approved term, mapped to that term's GlossaryTerm entry. Built
 * once at module load, not per call. Exactly four recognised question
 * shapes per term, matching the Commit 11C "Input recognition" list:
 *   "what is <term>", "what does <term> mean", "explain <term>",
 *   "can you explain <term>"
 * Nothing else is accepted — a message needs extra words, different word
 * order, or missing words to fail every one of these, which is exactly why
 * "Suppliers must explain their SASE design." and "We need SASE across 50
 * sites." both correctly miss every entry below.
 */
const RECOGNISED_QUESTIONS: ReadonlyMap<string, GlossaryTerm> = (() => {
  const map = new Map<string, GlossaryTerm>();
  for (const entry of GLOSSARY) {
    const t = entry.term.toLowerCase();
    const phrasings = [`what is ${t}`, `what does ${t} mean`, `explain ${t}`, `can you explain ${t}`];
    for (const p of phrasings) map.set(p, entry);
  }
  return map;
})();

/**
 * Returns the fixed, reviewed explanation for `input` if — and only if —
 * `input`, once narrowly normalised, is an exact match for one of the
 * recognised glossary-question phrasings above. Returns null for anything
 * else: unknown terms, substantive statements that merely mention an
 * approved term, and any input this module was not told to recognise.
 *
 * Pure: no I/O, no fetch, no model call, no ledger read. `question` is the
 * caller's original text, trimmed only (never rewritten or canonicalised),
 * so a genuine buyer question is shown back to them exactly as they typed
 * it, per the Commit 11C presentation requirement ("the buyer's question
 * when available").
 */
export function explanationForInput(input: string): WorkspaceExplanation | null {
  const normalised = normalise(input);
  const entry = RECOGNISED_QUESTIONS.get(normalised);
  if (!entry) return null;
  return {
    term: entry.term,
    question: input.trim(),
    explanation: entry.definition,
  };
}
