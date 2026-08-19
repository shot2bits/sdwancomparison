"use client";

/**
 * Living Procurement OS · Phase 3 Stage A, correction round (Robert, 14
 * Aug 2026), item 9: "Upgrade Architecture to a semantic SVG relationship
 * view where relationships exist, with an equivalent accessible text
 * representation." Renders exactly `LivingProcurementDocument.architecture`
 * — nodes and edges the compiler already derived from supported
 * requirement fields and clauses (`buildArchitecture()`,
 * procurement-templates.ts). This component adds no architecture logic of
 * its own: an empty `nodes` array renders the honest "nothing derived
 * yet" state, never an invented example diagram.
 *
 * STRUCTURAL PASS (Robert's "UI mockups request" handoff bundle, 19 Aug
 * 2026). The bundle's screenshot 01-builder.png draws this same real data
 * as the product's centrepiece — a left-to-right pipeline of titled boxes
 * joined by arrows, with a state legend beneath — and Robert's rejection
 * of the earlier repaint-only pass named this view among the things that
 * "looks nothing like the ZIP". The previous rendering was a small
 * absolutely-positioned SVG whose three columns collapsed into a cramped
 * vertical smear at anything under ~600px. This is now flex/HTML boxes in
 * the same three deterministic columns, so the boxes size to their own
 * text, wrap honestly on a phone, and carry the reference's title/detail
 * split. Same nodes, same edges, same column assignment, same order.
 *
 * NODE STATE IS DERIVED, NEVER INVENTED. The reference colour-codes its
 * boxes (confirmed / needs answer / in scope). `ArchitectureNode` carries
 * no status field, and adding one would have meant fabricating a judgment
 * about the buyer's estate — so the split below reads the one real signal
 * the compiler already records: `sourceClauseIds`. A node backed by a
 * governed compiled clause is genuinely CONFIRMED (there is a testable
 * requirement standing behind it); a node derived from stated requirement
 * fields alone is genuinely IN SCOPE (real and stated, no clause yet).
 * The legend renders only the states actually present, so it can never
 * advertise a category nothing on screen is in.
 *
 * Layout: a fixed, deterministic three-column arrangement by node `kind`
 * (estate: site/user — core: network — services: cloud/identity/voice/
 * application/circuit/datacentre), never a force-directed or randomly-
 * seeded layout (Section 14.5's "Deterministic": the SAME architecture
 * object always renders the SAME diagram). When there are no `edges` at
 * all (a node exists but nothing connects it — e.g. a single site with no
 * other structured facts yet), the plain node-chip list is kept instead
 * of a pipeline with disconnected boxes, since there is no "relationship
 * view" to draw yet.
 */

import type { LivingProcurementDocument } from "@/lib/workspace/procurement-document";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

type ArchNode = LivingProcurementDocument["architecture"]["nodes"][number];

const COLUMN_FOR_KIND: Record<ArchNode["kind"], 0 | 1 | 2> = {
  site: 0,
  user: 0,
  network: 1,
  cloud: 2,
  identity: 2,
  voice: 2,
  application: 2,
  circuit: 2,
  datacentre: 2,
};

/** The compiler writes labels like `Network (SD-WAN, MPLS)` and
 *  `Proposed SASE service`. The reference draws a bold title over a
 *  lighter detail line, so a parenthetical — where one already exists —
 *  becomes the detail. Purely presentational: no label is rewritten,
 *  shortened or invented, only split at a bracket the compiler itself
 *  put there. */
function splitLabel(label: string): { title: string; detail: string | null } {
  const m = label.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) return { title: m[1], detail: m[2] };
  return { title: label, detail: null };
}

/** CONFIRMED only where a governed clause actually stands behind the
 *  node — see this file's header comment on why this is the one honest
 *  signal available. */
function nodeState(n: ArchNode): "confirmed" | "in_scope" {
  return n.sourceClauseIds && n.sourceClauseIds.length > 0 ? "confirmed" : "in_scope";
}

function NodeBox({ node }: { node: ArchNode }) {
  const { title, detail } = splitLabel(node.label);
  const state = nodeState(node);
  const confirmed = state === "confirmed";
  return (
    <div
      className="flex min-w-[128px] max-w-[190px] flex-none flex-col gap-1 rounded-[4px] px-3.5 py-3 text-center"
      style={{
        border: `1.5px solid ${confirmed ? "var(--nf-emerald-soft-border, #91bb91)" : "var(--nf-ink-200, #d3d0cd)"}`,
        background: confirmed ? "var(--nf-emerald-soft, #d9f4d9)" : "#fff",
      }}
    >
      <span
        className="text-[11.5px] uppercase leading-[1.3]"
        style={{ ...mono, fontWeight: 600, letterSpacing: "0.04em", color: "var(--nf-ink-950, #110f0d)" }}
      >
        {title}
      </span>
      {detail && (
        <span className="text-[12px] leading-[1.35]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
          {detail}
        </span>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="flex-none self-center text-[15px] leading-none"
      style={{ color: "var(--nf-emerald, #1e4e22)" }}
    >
      →
    </span>
  );
}

export default function ProcurementArchitecture({
  architecture,
  deltaCaption,
}: {
  architecture: LivingProcurementDocument["architecture"];
  /** Real, pre-computed delta text (e.g. "Δ 3 clauses · 1 gate added") --
   *  see LivingProcurementCanvas.tsx's own call site for exactly which
   *  real `document.changeSet` fields this is built from. Optional and
   *  omitted entirely (never a placeholder) when there is no real change
   *  to report, matching every other honesty rule this pass. */
  deltaCaption?: string | null;
}) {
  const { nodes, edges } = architecture;
  const columns: ArchNode[][] = [[], [], []];
  // Deterministic within a column: the compiler's own node order (never
  // re-sorted by this presentational layer).
  for (const n of nodes) columns[COLUMN_FOR_KIND[n.kind]].push(n);
  const filled = columns.filter((c) => c.length > 0);
  const anyConfirmed = nodes.some((n) => nodeState(n) === "confirmed");
  const anyInScope = nodes.some((n) => nodeState(n) === "in_scope");

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3">
        <span style={{ ...mono, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nf-orange-strong, #832f00)" }}>
          Live procurement twin
        </span>
        {deltaCaption && (
          <span className="min-w-0 flex-1 text-right text-[11.5px]" style={{ ...mono, color: "var(--nf-emerald, #1e4e22)" }}>
            {deltaCaption}
          </span>
        )}
      </div>
      <div className="rounded-[4px] border p-4" style={{ borderColor: "var(--nf-rule, #d6d4d0)", background: "var(--nf-ivory-raised, #fefdfc)" }}>
        {nodes.length === 0 ? (
          <p className="m-0 text-[13.5px] leading-[1.55]" style={{ color: "var(--nf-ink-400, #83807b)" }}>
            Nothing derived yet — it fills in as you describe sites, users, network and cloud.
          </p>
        ) : edges.length === 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {nodes.map((n) => (
              <NodeBox key={n.id} node={n} />
            ))}
          </div>
        ) : (
          <>
            {/* The pipeline. `role="img"` + the compiler's own
                accessibleSummary keeps this equivalent for assistive
                technology exactly as the previous SVG did — the full
                relationship list is still rendered below, unconditionally
                and never display:none. */}
            <div className="flex flex-wrap items-stretch gap-x-3 gap-y-3" role="img" aria-label={architecture.accessibleSummary}>
              {filled.map((col, ci) => (
                <div key={ci} className="flex items-stretch gap-x-3">
                  <div className="flex flex-col justify-center gap-2">
                    {col.map((n) => (
                      <NodeBox key={n.id} node={n} />
                    ))}
                  </div>
                  {ci < filled.length - 1 && <Arrow />}
                </div>
              ))}
            </div>
            {/* Legend: only the states actually on screen (see header
                comment) — never a key to a category nothing is in. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {anyConfirmed && (
                <span className="flex items-center gap-2 text-[12px]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
                  <span
                    aria-hidden="true"
                    className="inline-block h-[11px] w-[11px] flex-none rounded-[2px]"
                    style={{ border: "1.5px solid var(--nf-emerald-soft-border, #91bb91)", background: "var(--nf-emerald-soft, #d9f4d9)" }}
                  />
                  Confirmed — a governed clause stands behind it
                </span>
              )}
              {anyInScope && (
                <span className="flex items-center gap-2 text-[12px]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
                  <span
                    aria-hidden="true"
                    className="inline-block h-[11px] w-[11px] flex-none rounded-[2px]"
                    style={{ border: "1.5px solid var(--nf-ink-200, #d3d0cd)", background: "#fff" }}
                  />
                  In scope — stated, no clause yet
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {/* The compiler's own plain-English rendering of this same
          architecture — an EQUIVALENT accessible text representation
          (Robert's item 9), not a decorative caption: it names every
          relationship the pipeline above draws, always rendered (never
          display:none / JS-conditional) so assistive technology and a
          reader who would rather read one paragraph than parse a diagram
          both get the full picture. */}
      <p className="sr-only">{architecture.accessibleSummary}</p>
      {edges.length > 0 && (
        <ul className="sr-only">
          {edges.map((e, i) => (
            <li key={`sr-${e.from}-${e.to}-${i}`}>
              {nodeLabel(nodes, e.from)} {e.label} {nodeLabel(nodes, e.to)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function nodeLabel(nodes: ArchNode[], id: string): string {
  return nodes.find((n) => n.id === id)?.label ?? id;
}
