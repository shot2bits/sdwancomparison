/**
 * Understanding group definitions and BriefBlock mapping (Milestone 1,
 * Commit 4): the canonical, presentation-only contract the future
 * Understanding renderer will use to lay briefModel()'s BriefBlock[] out
 * under eight buyer-facing headings ("Understanding" is the buyer-facing
 * artifact's name, per Ruling 4 — never "Statement of Requirements").
 *
 * This module defines a GROUPING, not a document. It creates no React
 * components and renders nothing; it only says which of the eight groups
 * each BriefBlock belongs under, in what order the groups themselves
 * appear, and what each group is titled.
 *
 * BriefBlock keys verified directly from src/lib/workspace/draft.ts's
 * briefModel() (every `blocks.push({ key: "...", ... })` call site):
 *
 *   line 530   key: "organisation"   "The organisation"
 *   line 544   key: "estate"         "Estate and current position"
 *   line 560   key: "vendors"        "Providers and vendors"
 *   line 574   key: "locations"      "Locations and site resilience"
 *   line 588   key: "drivers"        "Why now"
 *   line 604   key: "operations"     "Compliance and operations"
 *   line 631   key: "services"       "Services required"
 *   line 646   key: "scope"          "Scope of supply"
 *   line 654   key: "bespoke"        "Additional requirements"
 *   line 666   key: "gaps"           "Only you can answer these"
 *
 * Exactly ten keys, exactly matching Revision 3's anticipated list — no
 * discrepancy found, so no stop condition applies.
 *
 * Security/compliance ruling, verified from the same source rather than
 * assumed: estate.existingSecurity is read at line 538-539, inside the
 * `estate` block's own paragraph construction ("Security tooling already
 * in place: ..."), so it renders under `estate` -> Current estate.
 * constraints.complianceRequirements is read at line 594-595, inside the
 * `operations` block ("The service must support ..."), so it renders
 * under `operations` -> Security and compliance. The two paths are
 * genuinely in different BriefBlocks in the live code; this module maps
 * whole blocks, never inspects or re-splits a block's Seg[][] content, so
 * it cannot and does not move estate.existingSecurity's prose into
 * Security and compliance merely because "security" appears in its path.
 *
 * `services` handling (deliberately not in the specification's literal
 * mapping list, because it required inspecting the real content first):
 * the `services` block (lines 607-632) renders only when
 * `verdict && securityScope && live.length > 0`, i.e. only in a
 * managed-security-shaped buying scope, and its content is entirely
 * Netify's own rulebook verdict — recommended/conditional/not-recommended
 * security CAPABILITIES (endpoint protection, MDR/SOC, SSE, SIEM/logging,
 * managed firewall, security awareness, email security, backup and
 * resilience; see CAP_LABEL) and the reasoning behind them. Structurally
 * distinct from the other blocks: every paragraph is built with the
 * plain-text helper `t()`, never `fs()` — the services block carries NO
 * WorkspaceFact-linked segments at all (worth noting for Ruling 8's
 * fact-linkage guarantee: this one block has none to link, because
 * nothing in it is a buyer-stated or buyer-inferred fact; it is the
 * engine's derived verdict). Content-wise this is unambiguously about
 * security: every recommended item is a security capability under the
 * Netify rulebook, and the block never renders alongside `scope` (network
 * buying and security buying are mutually exclusive branches of `buying`,
 * so `services` and `scope` never co-occur). The narrowest accurate
 * buyer-facing group for that content is therefore Security and
 * compliance, alongside `operations` (which holds the buyer's own stated
 * compliance/SOC/budget facts) — both blocks are about the same
 * buyer-facing topic even though one is fact-derived and the other is
 * verdict-derived; grouping them together does not require splitting
 * either block's own paragraphs, so no stop condition applies here
 * either. This decision maps a whole block, unchanged, into the same
 * group as `operations` — it does not alter, reorder or reinterpret
 * `services`'s own content.
 *
 * No redesign: this module does not modify briefModel(), does not change
 * what a block contains, does not split or re-render any Seg[][], and
 * builds no React components. It stays under src/components/preview/.
 */

import type { BriefBlock } from "@/lib/workspace/draft";

export type UnderstandingGroupId =
  | "organisation"
  | "objectives_drivers"
  | "estate"
  | "technologies_providers"
  | "locations_resilience"
  | "security_compliance"
  | "requirements_constraints"
  | "gaps";

export interface UnderstandingGroupDefinition {
  id: UnderstandingGroupId;
  title: string;
}

/** The eight buyer-facing groups, in the required display order. */
export const UNDERSTANDING_GROUPS: readonly UnderstandingGroupDefinition[] = [
  { id: "organisation", title: "Organisation" },
  { id: "objectives_drivers", title: "Objectives and drivers" },
  { id: "estate", title: "Current estate" },
  { id: "technologies_providers", title: "Technologies and providers" },
  { id: "locations_resilience", title: "Locations and resilience" },
  { id: "security_compliance", title: "Security and compliance" },
  { id: "requirements_constraints", title: "Requirements and constraints" },
  { id: "gaps", title: "Unresolved gaps" },
];

/**
 * The canonical BriefBlock.key -> UnderstandingGroupId mapping, covering
 * every key briefModel() currently emits (verified above). BriefBlock.key
 * is typed as a plain `string` in draft.ts (not a literal union), so
 * completeness cannot be compiler-enforced the way labels.ts's
 * Record<AllowedPath, string> is; groupBriefBlocks() below provides the
 * runtime equivalent instead — see its unknown-key handling.
 */
export const BRIEF_BLOCK_KEY_TO_GROUP: Record<string, UnderstandingGroupId> = {
  organisation: "organisation",
  drivers: "objectives_drivers",
  estate: "estate",
  vendors: "technologies_providers",
  locations: "locations_resilience",
  operations: "security_compliance",
  services: "security_compliance",
  scope: "requirements_constraints",
  bespoke: "requirements_constraints",
  gaps: "gaps",
};

export interface UnderstandingGroup {
  id: UnderstandingGroupId;
  title: string;
  blocks: BriefBlock[];
}

/**
 * Groups a briefModel() result's BriefBlock[] into the eight ordered,
 * buyer-facing Understanding groups. Pure: never mutates `blocks`, the
 * array, or any individual block object — every group's `blocks` array is
 * newly created here and holds the SAME block references passed in
 * (identity-preserving, not a clone), in original order.
 *
 * Always returns exactly eight entries, in UNDERSTANDING_GROUPS' order,
 * even for an empty or partial input (empty groups included, never
 * omitted) — so a renderer can map over the result unconditionally.
 *
 * Unknown block key handling: a BriefBlock whose key has no entry in
 * BRIEF_BLOCK_KEY_TO_GROUP is a development-time defect (briefModel()
 * emitting a key this module has not been told about), not something a
 * buyer-facing surface should paper over with heuristic text matching or
 * silent omission. This throws, deliberately — the smallest option that
 * still guarantees the defect cannot render silently; there is no
 * existing typed-Result/Either convention elsewhere in this repository to
 * be consistent with, and a preview-only, dev-time helper is exactly
 * where a loud failure is cheapest to have.
 */
export function groupBriefBlocks(blocks: BriefBlock[]): UnderstandingGroup[] {
  const byId = new Map<UnderstandingGroupId, BriefBlock[]>();
  for (const def of UNDERSTANDING_GROUPS) byId.set(def.id, []);

  for (const block of blocks) {
    const groupId = BRIEF_BLOCK_KEY_TO_GROUP[block.key];
    if (!groupId) {
      throw new Error(
        `understanding-groups: BriefBlock key "${block.key}" has no Understanding group mapping. ` +
          `briefModel() emitted a key this module does not know about — extend ` +
          `BRIEF_BLOCK_KEY_TO_GROUP deliberately (after inspecting the block's real content), ` +
          `do not guess a group from the key or heading text.`,
      );
    }
    byId.get(groupId)!.push(block);
  }

  return UNDERSTANDING_GROUPS.map((def) => ({
    id: def.id,
    title: def.title,
    blocks: byId.get(def.id) ?? [],
  }));
}
