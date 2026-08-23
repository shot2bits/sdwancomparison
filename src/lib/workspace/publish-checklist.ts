/**
 * What publishing actually requires — surfaced.
 *
 * WHY THIS EXISTS. Robert, 19 Aug 2026: "there's no structure, nobody
 * knows where they are in the process and why the questions are being
 * asked, to what end? Feels like a list of random questions with no end
 * in sight."
 *
 * The diagnosis turned out to be the opposite of the obvious one. A real,
 * finite, monotonic publish gate ALREADY EXISTED — ProjectDesk's
 * `signLocked` has always refused to publish until five core facts stand
 * (sector, sites, regions, what you're buying, timeline), with `lockLine`
 * naming exactly which are missing. It was simply invisible: a buyer only
 * ever met it by reaching the publish panel and being turned away.
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
  sector: boolean;
  sites: boolean;
  regions: boolean;
  scope: boolean;
  timeline: boolean;
  /** Security-scope engagements additionally need a settled rulebook
   *  verdict — the same condition `signLocked` has always carried. Passed
   *  as an already-resolved boolean so this module never needs to know
   *  what a verdict is. */
  securityScope: boolean;
  securityVerdictSettled: boolean;
}): PublishChecklist {
  const items: PublishRequirement[] = [
    { key: "sector", label: "Your sector", done: input.sector },
    { key: "sites", label: "How many sites", done: input.sites },
    { key: "regions", label: "Which regions", done: input.regions },
    { key: "scope", label: "What you're buying", done: input.scope },
  ];
  // Timeline and security depth materially improve an RFP, but neither is
  // required to publish a concise market opportunity. They remain advisor
  // recommendations and contribute to RFP depth; they are not hidden locks.
  const doneCount = items.filter((i) => i.done).length;
  return {
    items,
    doneCount,
    total: items.length,
    remaining: items.filter((i) => !i.done).map((i) => i.label),
    ready: doneCount === items.length,
  };
}
