"use client";

/**
 * UnderstandingGroup (Milestone 1, Commit 5): renders one buyer-facing
 * Understanding group — a title plus the BriefBlock[] already assigned to
 * it by groupBriefBlocks() (Commit 4) — by walking each block's own
 * `paras: Seg[][]` directly. No new state, no orchestration, no data
 * fetching: this is a pure rendering of exactly the structure it is
 * handed, matching Ruling 8's resolution (a Seg of kind "fact" already
 * carries its WorkspaceFact inline, so no fact/prose matching is needed
 * or performed here).
 *
 * This is not the full Understanding document — no page chrome, no
 * document title, no "Working assumptions" section, no session activity,
 * no clarification UI, no route. It renders one group, given its blocks.
 *
 * Seg rendering:
 * - "text": seg.text rendered exactly as supplied, in a plain span.
 * - "fact": seg.text rendered as the visible sentence fragment (styled
 *   per provenance/struck-state, the same solid-underline/dotted-
 *   underline/strike-through convention StatementOfRequirements.tsx
 *   already uses), wrapped in a native <details>/<summary> disclosure so
 *   a buyer can click to inspect the fact's full detail via
 *   FactInspector — seg.fact is passed straight through, unmodified, as
 *   FactInspector's only data prop. <details> is plain HTML with its own
 *   browser-native open/closed state; nothing here is React state.
 * - "gap": the question rendered plainly as unresolved (italic, muted —
 *   the same convention StatementOfRequirements.tsx already uses for
 *   gaps), with whyItMatters shown when present and a short, purely
 *   descriptive note of the expected answer shape (number / a choice
 *   among named options / free text). No input, control, or answer
 *   mutation is rendered — describing the shape is not the same as
 *   offering it, and Revision 3 explicitly reserves building an actual
 *   control for a later commit.
 *
 * Order is preserved at every level (blocks, paragraphs, segments) by
 * mapping over the given arrays in place — nothing is sorted, grouped
 * again, or flattened to plain text before rendering.
 *
 * Block headings are shown from `block.heading` only; `block.key` (the
 * internal BriefBlock identifier) is never rendered. If a block has no
 * heading (the type allows it, though every block briefModel() currently
 * emits sets one), no fallback identifier is shown — only the group's own
 * title heads that block's content.
 *
 * Empty-group choice: a group with zero blocks renders nothing (returns
 * null), rather than an empty-shell placeholder. Reasoning: this
 * component renders ONE group among eight, and in most real Understandings
 * several groups will legitimately be empty early in a conversation (a
 * buyer who has only described their organisation has said nothing yet
 * about locations or technologies). Showing eight sections including six
 * empty placeholder boxes would be noisy and would not match "calm,
 * readable, low-noise" — the smallest option consistent with the existing
 * preview's own empty-state convention (StatementOfRequirements.tsx shows
 * exactly one empty-state message for the WHOLE document when it has zero
 * blocks, not one per section). A future orchestrator, not this
 * primitive, is the right place to decide whether the Understanding as a
 * WHOLE needs a single empty-state message.
 */

import type { BriefBlock, BriefGap, Seg } from "@/lib/workspace/draft";
import type { AllowedPath } from "@/lib/workspace/extract";
import type { UnderstandingGroupId } from "@/components/preview/understanding-groups";
import FactInspector from "@/components/preview/FactInspector";

function answerShape(gap: BriefGap): string {
  if (gap.control === "number") return "expects a number";
  if (gap.control === "chips") {
    return gap.options && gap.options.length > 0
      ? `choose one: ${gap.options.map((o) => o.label).join(", ")}`
      : "choose one";
  }
  return "expects free text";
}

function renderGapSeg(gap: BriefGap, key: string) {
  return (
    <span key={key} className="text-[14.5px] italic text-[var(--ink-500)]">
      {gap.question}
      {gap.whyItMatters && <span className="not-italic text-[12.5px] text-[#8C8A85]"> — {gap.whyItMatters}</span>}
      <span className="not-italic text-[11px] text-[#8C8A85]"> ({answerShape(gap)})</span>
    </span>
  );
}

function renderSeg(seg: Seg, key: string, labelFor: (path: AllowedPath) => string) {
  if (seg.kind === "text") return <span key={key}>{seg.text}</span>;

  if (seg.kind === "fact") {
    const fact = seg.fact;
    return (
      <details key={key} className="inline-block align-baseline">
        <summary
          className={
            "inline cursor-pointer rounded-[2px] " +
            (fact.struck
              ? "text-[var(--ink-300)] line-through decoration-[1.5px]"
              : fact.provenance === "stated"
                ? "border-b-2 border-[var(--ink-700)]"
                : "border-b-2 border-dotted border-[var(--ink-500)]")
          }
        >
          {seg.text}
        </summary>
        <div className="mt-1">
          <FactInspector fact={fact} labelFor={labelFor} />
        </div>
      </details>
    );
  }

  return renderGapSeg(seg.gap, key);
}

export default function UnderstandingGroup({
  id,
  title,
  blocks,
  labelFor,
}: {
  id: UnderstandingGroupId;
  title: string;
  blocks: BriefBlock[];
  labelFor: (path: AllowedPath) => string;
}) {
  if (blocks.length === 0) return null;

  return (
    <section data-understanding-group={id} className="mb-6">
      <h3 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">{title}</h3>

      {blocks.map((block, bi) => (
        <div key={`${id}-${bi}`} className="mb-4 last:mb-0">
          {block.heading && <p className="m-0 mb-1 text-[12.5px] font-medium text-[#33302C]">{block.heading}</p>}

          {block.paras.map((para, pi) => (
            <p key={pi} className="m-0 mb-2 max-w-2xl text-[14.5px] leading-relaxed text-[#18181b]">
              {para.map((seg, si) => renderSeg(seg, `${id}-${bi}-${pi}-${si}`, labelFor))}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}
