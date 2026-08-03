"use client";

/**
 * UnderstandingDocument (Milestone 1, Commit 6): the buyer-facing
 * Understanding document, composed entirely from already-approved
 * production and preview primitives. This commit is composition only —
 * it adds no new logic of its own beyond wiring these together in the
 * canonical order:
 *
 *   facts -> briefModel({ facts, verdict: null }) -> brief.blocks
 *         -> groupBriefBlocks(brief.blocks) -> UnderstandingGroup per group
 *
 * `briefModel()` (src/lib/workspace/draft.ts), `labelFor()`
 * (src/lib/workspace/labels.ts), `groupBriefBlocks()` and
 * `UNDERSTANDING_GROUPS` (src/components/preview/understanding-groups.ts),
 * and `UnderstandingGroup` (src/components/preview/UnderstandingGroup.tsx)
 * are all used unmodified and un-reimplemented — this file contains no
 * copy of any of their logic.
 *
 * `verdict: null` is passed deliberately and permanently for this
 * milestone (Do not add or synthesize a security verdict): the same
 * choice StatementOfRequirements.tsx already made for the same reason —
 * the security-scope verdict engine is a separate, existing production
 * system this slice does not touch or recompute. A direct consequence,
 * verified from briefModel()'s own source rather than assumed: the
 * `gaps` BriefBlock is derived exclusively from `verdict.gaps` (`if
 * (verdict && securityScope) { for (const g of verdict.gaps) ... }`,
 * `openGaps` is built solely from that map) — with verdict always null,
 * briefModel() can never emit a `gaps` block from this component, no
 * matter what facts are supplied. UNDERSTANDING_GROUPS still lists
 * "Unresolved gaps" last and UnderstandingGroup still renders it exactly
 * like any other group whenever a `gaps` block IS present — nothing here
 * special-cases it away — but end-to-end, in this milestone, the gaps
 * group empty-renders (per UnderstandingGroup's own empty-group rule),
 * same as every other topic the buyer hasn't touched yet. This is a
 * structural consequence of "no synthesized verdict", not a gap in this
 * commit's own logic; documented here and in the Commit 6 report rather
 * than worked around.
 *
 * Heading: the permanent buyer-facing heading is literally "Understanding"
 * — never `brief.title` (which still carries production wording built for
 * other surfaces, e.g. "SD-WAN requirement: ..."), and never any of
 * Statement of Requirements / SoR / Request for Information / RFI /
 * Request for Proposal / RFP, anywhere in this file.
 *
 * `brief.assumptions` and `brief.openGaps` are deliberately NOT rendered
 * by this component. Nothing in the Commit 6 specification asks for a
 * "Working assumptions" section or a raw open-gaps list outside the
 * `gaps` BriefBlock/group — rendering either would be adding scope this
 * commit's own "do not implement" list did not authorise (no next-step
 * policy, no ranking, no new UI beyond the eight-group document).
 *
 * Empty state — a discrepancy found from source, resolved and documented
 * rather than silently worked around: the specification's trigger is "no
 * rendered blocks", which reads naturally as `brief.blocks.length === 0`.
 * Verified directly (`briefModel({ facts: [], verdict: null }).blocks`):
 * that is NEVER true. The `organisation` block is pushed unconditionally
 * (draft.ts line 530, no `if (paras.length)` guard around it, unlike
 * every other block) — even with zero facts it renders two boilerplate
 * paragraphs ("The buyer is a company." and "It is buying [a hardcoded
 * procurement.buying gap]."), containing no buyer-derived content at all.
 * A literal `brief.blocks.length === 0` (or an equivalent grouped-blocks
 * check) can therefore never be true, which would make the specified
 * whole-document empty state unreachable dead code.
 *
 * Resolution: this component gates the empty state on `facts.length === 0`
 * instead — not a new heuristic, but the same condition the existing,
 * already-approved preview orchestrator already uses for the identical
 * judgment ("is there anything to show yet"): QuickSorWorkspace.tsx's own
 * `const started = facts.length > 0 || lastReceipt !== null;` gates
 * whether StatementOfRequirements renders at all. Using `facts.length`
 * here continues that established convention rather than inventing a new
 * "meaningful content" filter over `brief.blocks`/`Seg[][]` (which would
 * itself risk exactly the heuristic paragraph-inspection the stop
 * conditions forbid). Flagged in full in the Commit 6 report for review.
 *
 * The empty-state wording itself is fixed, not templated from any
 * project data (NO EXAMPLE OPENERS) — it renders unconditionally on the
 * `facts.length === 0` branch, never derived from `brief`.
 */

import { briefModel, type WorkspaceFact } from "@/lib/workspace/draft";
import { labelFor } from "@/lib/workspace/labels";
import { groupBriefBlocks } from "@/components/preview/understanding-groups";
import UnderstandingGroup from "@/components/preview/UnderstandingGroup";

export type UnderstandingDocumentProps = {
  facts: WorkspaceFact[];
};

export default function UnderstandingDocument({ facts }: UnderstandingDocumentProps) {
  const brief = briefModel({ facts, verdict: null });
  const groups = groupBriefBlocks(brief.blocks);
  // See the file header's "Empty state" note: brief.blocks is never
  // actually empty (the organisation block always pushes), so the
  // whole-document empty state is gated on the input, matching
  // QuickSorWorkspace.tsx's existing `started` convention.
  const hasContent = facts.length > 0;

  return (
    <article className="rounded-[13px] border border-[#EAE7E1] bg-white p-5 sm:p-6">
      <h2 className="m-0 mb-1 text-xl leading-snug text-[#141414]">Understanding</h2>
      <p className="m-0 mb-5 text-[13px] text-[var(--ink-500)]">Netify&rsquo;s current understanding of your project.</p>

      {hasContent ? (
        groups.map((g) => (
          <UnderstandingGroup key={g.id} id={g.id} title={g.title} blocks={g.blocks} labelFor={labelFor} />
        ))
      ) : (
        <div className="rounded-[13px] border border-dashed border-[#EAE7E1] p-6 text-center">
          <p className="m-0 text-[13px] text-[#8C8A85]">
            Your Understanding will appear here as Netify captures your project.
          </p>
        </div>
      )}
    </article>
  );
}
