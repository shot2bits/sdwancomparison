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
 * SCOPE: chosen answers only (`source === "answer"` facts, `own` noted
 * items). Typed sentences are deliberately excluded — the buyer can see
 * their own typing in the transcript directly above, and the complaint
 * being answered here is specifically about CLICKING.
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
};

export type NotedShape = { id: string; label: string; section: string; own?: boolean };

export function buildAnsweredLog(input: {
  facts: ReadonlyArray<WorkspaceFact>;
  noted: ReadonlyArray<NotedShape>;
}): AnsweredEntry[] {
  const out: AnsweredEntry[] = [];
  /* `standing` drops struck facts — a removed answer must vanish from
     here the moment it vanishes from the document, or this panel becomes
     the one surface that lies about what will be published. */
  for (const f of standing(input.facts as WorkspaceFact[])) {
    if (f.source !== "answer") continue;
    out.push({
      key: f.id,
      label: PATH_LABELS[f.path] ?? f.path,
      answer: factLabel(f),
      kind: "fact",
    });
  }
  for (const n of input.noted) {
    if (!n.own) continue;
    out.push({ key: n.id, label: "Noted for suppliers", answer: n.label, kind: "note" });
  }
  return out;
}
