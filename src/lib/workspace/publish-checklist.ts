/**
 * What publishing actually requires — surfaced.
 *
 * WHY THIS EXISTS. Robert, 19 Aug 2026: "there's no structure, nobody
 * knows where they are in the process and why the questions are being
 * asked, to what end? Feels like a list of random questions with no end
 * in sight."
 *
 * The gate is the canonical essential-section projection already shown in
 * the builder. A section marked Needs input or Needs decision cannot be
 * described as ready in one place while a four-fact shortcut unlocks
 * publishing somewhere else.
 *
 * Meanwhile the surface a buyer DID see — the ranked open decisions — was
 * labelled "N decisions before this can be published" and "Blocking
 * decisions remaining", and gates nothing at all. Worse, that set is
 * GENERATIVE: answering one can earn another (measured live, 19 Aug:
 * answering "NHS DSPT applies" moved the count from 8 to 8). So the
 * product showed an endless advisory stream as if it were the gate, and
 * hid the actual gate, which is short and shrinks. That is the whole of
 * "no end in sight".
 *
 * This module makes the real gate the thing on screen. It is deliberately
 * the SINGLE source for both the checklist a buyer reads and the
 * `signLocked` boolean that enforces it, so the two cannot drift — the
 * class of bug this codebase has repeatedly had to fix by hand (see the
 * rail-badge-vs-station-cards mismatch of the same day).
 *
 * MONOTONIC BY CONSTRUCTION. Every item is a single standing fact or a
 * settled scope judgement. Nothing here can be added by answering
 * something else, which is exactly what makes it an end a buyer can see
 * from the first screen.
 *
 * PURE: no React, no I/O (Article 17).
 */

export type PublishRequirement = {
  key: string;
  /** Buyer-facing, and deliberately the SAME wording `missingCore`
   *  already used in the lock line, so a buyer who meets both reads one
   *  vocabulary rather than two. */
  label: string;
  done: boolean;
};

export type PublishChecklist = {
  items: PublishRequirement[];
  doneCount: number;
  total: number;
  remaining: string[];
  /** True when every requirement stands. `signLocked` is built from this,
   *  never from a parallel re-derivation. */
  ready: boolean;
};

export function buildPublishChecklist(input: {
  /** The required rows from the canonical section outline. Rows already
   *  classified as Later are deliberately excluded by the caller. */
  essentialSections: Array<{ key: string; label: string; done: boolean }>;
}): PublishChecklist {
  const items: PublishRequirement[] = input.essentialSections.map((section) => ({
    key: section.key,
    label: section.label,
    done: section.done,
  }));
  const doneCount = items.filter((i) => i.done).length;
  return {
    items,
    doneCount,
    total: items.length,
    remaining: items.filter((i) => !i.done).map((i) => i.label),
    ready: doneCount === items.length,
  };
}
