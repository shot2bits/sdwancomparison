/**
 * The typed command boundary (ProjectDesk.tsx's send()): recognises a
 * closed set of short, single-purpose instructions ("who fits", "publish
 * it", "drop Azure"...) before anything is treated as buyer procurement
 * content. Moved out of ProjectDesk.tsx (Phase 1 checkpoint correction,
 * item 3, Robert's review of 13 Aug 2026) into its own pure module for the
 * same reason resolveDropTarget() already lives in draft.ts rather than
 * inline in the component: so a fixture can call the EXACT function
 * ProjectDesk.tsx's send() calls, not a hand-rolled approximation that
 * could silently drift from what production actually runs.
 * verify-fact-ledger-reliability-gate.ts's own "Regression 6c" comment
 * named this exact gap ("parseCommand()... not exported as a pure
 * function, so the live flow is not unit-testable from this script") --
 * this move closes it; that file's Round 10 section now calls this
 * function directly.
 *
 * THE BUG THIS MOVE FIXES (Robert's Phase 1 checkpoint review, item 3): at
 * the baseline this module was extracted from, the dropName/keepName
 * regex `^(?:drop|remove|untick) (.+)$` (and `^(?:keep|re-?add|tick)
 * (.+)$`) is GREEDY against the WHOLE normalised line. Any message
 * beginning "remove "/"drop "/"untick "/"keep " was classified as a
 * single-target command, even a full multi-clause correction such as the
 * Living Procurement Canvas brief's own Section 16.2 acceptance prompt:
 * "Remove DLP. Make the service co-managed instead of fully managed, but
 * keep 24/7 incident support." The entire remainder of the sentence
 * became the drop target's `name`, resolveDropTarget() (correctly) found
 * no match for that whole run-on string, and send() returned right there
 * inside handleCommand() -- the correction never reached keepSourceTurn()
 * or runCycle() at all. The buyer's words were neither preserved in the
 * source ledger nor extracted: a genuine Canvas integration regression
 * (Section 13.2's own carve-out for touching this boundary).
 *
 * isSingleCommandTarget() below is the smallest fix that keeps a real
 * single-target command ("drop Azure", "remove MPLS", "untick the DLP
 * requirement", "remove the circuit note") working exactly as before,
 * while any multi-sentence or overlong candidate falls through --
 * parseCommand() returns null, and send() then treats the WHOLE message
 * as ordinary procurement content: kept verbatim in the source ledger and
 * run through extraction, exactly like every other buyer statement.
 */

export type Command =
  | { kind: "whoFits" }
  | { kind: "publish" }
  | { kind: "sheet"; open: boolean }
  | { kind: "reset" }
  | { kind: "back" }
  | { kind: "closeEdit" }
  | { kind: "missing" }
  | { kind: "cost" }
  | { kind: "dropPartner" }
  | { kind: "dropName"; name: string }
  | { kind: "keepName"; name: string }
  | { kind: "why"; name: string };

/** A drop/remove/untick/keep candidate is a single short target -- a
 *  vendor name, a fact label, a note -- never a multi-sentence
 *  correction. Two independent, deliberately conservative signals, either
 *  one enough to reject the whole line as a command:
 *
 *   1. An INTERNAL sentence terminator. parseCommand()'s caller has
 *      already stripped exactly one TRAILING run of `.`/`!`/`?`
 *      (`raw.trim().toLowerCase().replace(/[?.!]+$/, "")`), so any
 *      `.`/`!`/`?` still present in the candidate marks a sentence
 *      boundary in the MIDDLE of the message -- e.g. "dlp. make the
 *      service co-managed...".
 *   2. Length. A real target name is a handful of words (every existing
 *      command fixture and every example in this codebase's own UI copy
 *      is well under this); a full correction reads as a sentence.
 *
 *  Either signal alone is enough to fall through to ordinary extraction --
 *  this function never tries to guess which PART of a long message is
 *  "the real target", it only decides whether the WHOLE candidate is
 *  plausibly one. */
function isSingleCommandTarget(candidate: string): boolean {
  if (/[.!?]/.test(candidate)) return false;
  const words = candidate.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 8;
}

export function parseCommand(raw: string): Command | null {
  const t = raw.trim().toLowerCase().replace(/[?.!]+$/, "").replace(/\s+/g, " ");
  if (!t) return null;
  if (/^(show me )?who fits$/.test(t)) return { kind: "whoFits" };
  if (/^(publish( it| this| to the board)?|generate and publish)$/.test(t)) return { kind: "publish" };
  if (/^(see|show( me)?|open) the requirement( sheet)?$/.test(t) || t === "open the sheet") return { kind: "sheet", open: true };
  if (/^close the (requirement( sheet)?|sheet)$/.test(t)) return { kind: "sheet", open: false };
  if (/^(start (again|over|afresh)|reset)$/.test(t)) return { kind: "reset" };
  if (/^back( to the (conversation|project))?$/.test(t)) return { kind: "back" };
  if (/^(not sure( yet)?|skip( it| this( one)?)?)$/.test(t)) return { kind: "closeEdit" };
  if (/^what( am i| are we)? ?(am i |are we )?(still )?(missing|left|outstanding)$/.test(t) || /^what are you still missing$/.test(t)) return { kind: "missing" };
  if (/^what (will|would) (this|it) cost$/.test(t) || /^(price|cost)( it| this)?$/.test(t)) return { kind: "cost" };
  if (/^drop (the ones|anyone|those) (that need|needing) a partner$/.test(t)) return { kind: "dropPartner" };
  const drop = /^(?:drop|remove|untick) (.+)$/.exec(t);
  if (drop && isSingleCommandTarget(drop[1]) && !/guess|inference/.test(drop[1])) return { kind: "dropName", name: drop[1] };
  const keep = /^(?:keep|re-?add|tick) (.+)$/.exec(t);
  if (keep && isSingleCommandTarget(keep[1])) return { kind: "keepName", name: keep[1] };
  const why = /^why is (.+?) (?:first|top|ranked (?:first|top|where it is)|there)$/.exec(t) ?? /^why (.+?) first$/.exec(t);
  if (why) return { kind: "why", name: why[1] };
  return null;
}
