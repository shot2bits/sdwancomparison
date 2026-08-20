/**
 * "What have I actually answered?" — the projection behind the Decisions
 * station's Answered panel.
 *
 * WHY THIS EXISTS. Robert, 19 Aug 2026, on a live session: "when
 * selecting the options for sites, I cannot be sure if the system has
 * recorded it. It's not clear what I have answered or not."
 *
 * He was right, and the cause was placement, not persistence. Clicking an
 * option ALREADY lands a real, durable, governed record — a stated
 * WorkspaceFact with `source: "answer"`, or an `own` noted item — and
 * that record was already rendered, in "Project details", several screens
 * away from the card that had just been clicked, interleaved with
 * everything the buyer typed and everything Netify inferred. From the
 * decision card's own position on screen there was no evidence at all
 * that anything had happened.
 *
 * WHAT THIS IS NOT. It invents no new store and no new state. It is a
 * read-only projection over the two collections that ALREADY hold the
 * answer — the same `facts` the compiler reads and the same `noted` the
 * decision ledger replays on resume — so an entry can appear here only if
 * the document genuinely carries it. If this panel says a thing was
 * recorded, the published notice will carry it; that is the entire point.
 *
 * SCOPE: everything the buyer has STATED, however they stated it —
 * facts they chose from an option (`source: "answer"`) and facts
 * extracted from their own typed sentence (`provenance: "stated"`), plus
 * their own noted items. Facts Netify INFERRED are excluded, always: the
 * question this answers is "what have I told you", and an inference is
 * not something the buyer told anyone.
 *
 * Widened from chosen-only on 20 Aug 2026 after a live check. The
 * narrower version was empty for a buyer who had typed a full opening
 * sentence and clicked nothing — the exact moment they most need to see
 * that their words landed. Robert's own reference mockup lists the
 * typed-sentence extractions ("20 sites across the UK", "Healthcare
 * sector") in this list, and it is right to: they are in the document.
 * Each row carries HOW it was stated, so "you chose this" and "your
 * words" stay distinguishable — the same split "Project details" has
 * always drawn.
 *
 * ASSUMPTIONS ARE RETURNED TOO, AND NEVER AS ANSWERS. A live check on
 * 20 Aug 2026 found "manufacturing sites" landing
 * `organisation.sector: Manufacturing` with `provenance: "inferred"` —
 * a real fact, silently driving the sector pack and the document title,
 * that the buyer never stated and could see nowhere. Hiding it would be
 * worse than showing it, and folding it in with what they DID say would
 * be the "Netify decided this" failure this whole pass exists to end.
 * So `assumed` is a second, separately-labelled list: same shape, same
 * Edit affordance, so a buyer can confirm or correct an assumption
 * instead of discovering it at publication.
 *
 * PURE: no React, no I/O (Article 17).
 */

import { factLabel, standing, type WorkspaceFact } from "@/lib/workspace/draft";
import { PATH_LABELS } from "@/lib/workspace/labels";

export type AnsweredEntry = {
  /** Stable render key: the fact id or the noted id. */
  key: string;
  /** What was being decided ("How many sites"), never the raw path. */
  label: string;
  /** What the buyer chose, in the words the document now carries. */
  answer: string;
  kind: "fact" | "note";
  /** How this entered the document. Never collapsed into one label: a
   *  clicked option, a typed sentence and a Netify inference are three
   *  different kinds of evidence and this codebase distinguishes them
   *  everywhere else. */
  via: "chose" | "your words" | "netify assumed";
  /** The fact path, when this row came from a fact — the only thing a
   *  caller needs to offer an "Edit" affordance (SLOT_BY_PATH resolves it
   *  to the existing edit sheet). Absent for noted items, which have no
   *  slot to reopen. Returned rather than resolved here so this module
   *  stays free of component-local tables (Article 17). */
  path?: string;
};

export type NotedShape = { id: string; label: string; section: string; own?: boolean };

export function buildAnsweredLog(input: {
  facts: ReadonlyArray<WorkspaceFact>;
  noted: ReadonlyArray<NotedShape>;
}): { stated: AnsweredEntry[]; assumed: AnsweredEntry[] } {
  const out: AnsweredEntry[] = [];
  const assumed: AnsweredEntry[] = [];
  /* `standing` drops struck facts — a removed answer must vanish from
     here the moment it vanishes from the document, or this panel becomes
     the one surface that lies about what will be published. */
  for (const f of standing(input.facts as WorkspaceFact[])) {
    /* `provenance` is the gate, not `source`: it is the field this
       codebase proves rather than claims (extract.ts's truth rule 2), and
       it is exactly the buyer-said-it / Netify-guessed-it line. */
    const row: AnsweredEntry = {
      key: f.id,
      label: PATH_LABELS[f.path] ?? f.path,
      answer: factLabel(f),
      kind: "fact",
      via: f.provenance === "stated" ? (f.source === "answer" ? "chose" : "your words") : "netify assumed",
      path: f.path,
    };
    (f.provenance === "stated" ? out : assumed).push(row);
  }
  for (const n of input.noted) {
    if (!n.own) continue;
    out.push({ key: n.id, label: "Noted for suppliers", answer: n.label, kind: "note", via: "chose" });
  }
  return { stated: out, assumed };
}
