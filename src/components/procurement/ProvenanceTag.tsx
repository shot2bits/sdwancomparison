/**
 * The approved 2030 prototype's five-category provenance vocabulary —
 * Your words / Netify intelligence / MCP evidence / Agent proposed /
 * Buyer approved — applied consistently to every material object,
 * reproduced from the closure package's own `PROV`/`provTag()` (index.html)
 * and its five-tag consistency rule (closure-pass gap item 1).
 *
 * MAPPING TO REAL PRODUCTION DATA (stated here once, not re-derived at
 * each call site, so it can be audited in one place): this is a genuine
 * translation from the prototype's five-tag vocabulary onto the real
 * three-value `FactSource` (src/lib/workspace/draft.ts: "extract" |
 * "answer" | "link") plus the `provenance: "stated" | inferred` flag
 * already on every fact, and the real MCP receipt marker already proven
 * out in src/lib/history-provenance.ts (`via === "mcp"`). It is not
 * invented: it follows the exact distinction ProjectDesk.tsx's own
 * existing `meta` strings already draw at lines ~3263/3333/4475
 * ("you chose this" / a direct quote / "your words" / "netify guessed"),
 * just re-expressed in the prototype's five-word vocabulary instead of
 * that ad hoc string set:
 *
 *   - words    ← provenance:"stated" && source:"extract" (the buyer's own
 *                free text, quoted or not — the existing "your words" /
 *                quoted-string case)
 *   - approved ← provenance:"stated" && source:"answer" (the buyer clicked
 *                a specific offered option — the existing "you chose
 *                this" case; a discrete accept action, not free prose,
 *                which is precisely the prototype's "Buyer approved")
 *   - intel    ← anything not explicitly stated by the buyer (source:
 *                "link" seed/pack facts, or an inferred fact carrying
 *                `f.reason` — the existing "netify guessed" case):
 *                Netify's own reasoning, not the buyer's words
 *   - agent    ← a Mission Control / NextQuestion card itself: a decision
 *                Netify has ranked and is proposing the buyer resolve,
 *                still open. This matches the prototype's own real usage
 *                exactly — every decision card in state 1 uses
 *                `provTag('agent')` (index.html, renderFirst()) — not an
 *                invented mapping.
 *   - evidence ← a history event with `via === "mcp"` (history-provenance
 *                .ts's own `isMcp` field) — a genuinely distinct
 *                governance-log construct, never a `FactSource` value.
 *
 * This mapping is stated up front, per Robert's instruction that any
 * intentional interpretive step be listed before implementation.
 */

export type ProvenanceKind = "words" | "intel" | "evidence" | "agent" | "approved";

export const PROVENANCE_LABEL: Record<ProvenanceKind, string> = {
  words: "Your words",
  intel: "Netify intelligence",
  evidence: "MCP evidence",
  agent: "Agent proposed",
  approved: "Buyer approved",
};

/** var(--nf-lilac) for intel, var(--nf-orange) for agent — matching the
 *  closure-pass fix that gave agent/intel visually distinct dots (they
 *  both used to be lilac, a real collision the closure pass corrected). */
const DOT_COLOR: Record<ProvenanceKind, string> = {
  words: "var(--nf-ink-400)",
  intel: "var(--nf-lilac)",
  evidence: "var(--nf-cobalt)",
  agent: "var(--nf-orange)",
  approved: "var(--nf-emerald)",
};

/** Derives the provenance category for a WorkspaceFact-shaped value,
 *  per the mapping documented above. Accepts the minimal shape needed
 *  (not the full WorkspaceFact type) so call sites don't need to import
 *  the whole draft.ts surface just to tag a chip. */
export function provenanceFromFact(f: { provenance?: string; source?: string }): ProvenanceKind {
  if (f.provenance === "stated") {
    return f.source === "answer" ? "approved" : "words";
  }
  return "intel";
}

export function ProvenanceTag({ kind, inline, dark }: { kind: ProvenanceKind; inline?: boolean; dark?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-nowrap ${inline ? "ml-2" : ""}`}
      style={{
        fontFamily: "var(--nf-font-mono)",
        fontSize: "9px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: dark ? "#948C79" : "var(--nf-ink-400)",
      }}
    >
      <span className="inline-block h-[6px] w-[6px] flex-none rounded-full" style={{ background: DOT_COLOR[kind] }} aria-hidden="true" />
      {PROVENANCE_LABEL[kind]}
    </span>
  );
}
