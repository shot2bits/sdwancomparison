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
 * Layout: a fixed, deterministic three-column arrangement by node `kind`
 * (estate: site/user — core: network — services: cloud/identity/voice/
 * application/circuit/datacentre), never a force-directed or
 * randomly-seeded layout (Section 14.5's "Deterministic": the SAME
 * architecture object always renders the SAME diagram). When there are no
 * `edges` at all (a node exists but nothing connects it — e.g. a single
 * site with no other structured facts yet), the plain node-chip list
 * below is kept instead of an SVG with disconnected boxes, since there is
 * no "relationship view" to draw yet.
 */

import type { LivingProcurementDocument } from "@/lib/workspace/procurement-document";

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' };

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

const BOX_W = 158;
const BOX_H = 40;
const COL_GAP = 90;
const ROW_GAP = 14;
const PAD = 16;

function layout(nodes: ArchNode[]): Map<string, { x: number; y: number }> {
  const byCol: ArchNode[][] = [[], [], []];
  // Deterministic within a column: the compiler's own node order (never
  // re-sorted by this presentational layer).
  for (const n of nodes) byCol[COLUMN_FOR_KIND[n.kind]].push(n);
  const positions = new Map<string, { x: number; y: number }>();
  byCol.forEach((col, ci) => {
    col.forEach((n, ri) => {
      positions.set(n.id, { x: PAD + ci * (BOX_W + COL_GAP), y: PAD + ri * (BOX_H + ROW_GAP) });
    });
  });
  return positions;
}

export default function ProcurementArchitecture({ architecture }: { architecture: LivingProcurementDocument["architecture"] }) {
  const { nodes, edges } = architecture;
  const positions = layout(nodes);
  const maxRows = Math.max(1, ...[0, 1, 2].map((ci) => nodes.filter((n) => COLUMN_FOR_KIND[n.kind] === ci).length));
  const svgW = PAD * 2 + BOX_W * 3 + COL_GAP * 2;
  const svgH = PAD * 2 + maxRows * BOX_H + (maxRows - 1) * ROW_GAP;
  const titleId = "arch-diagram-title";

  return (
    <div className="border-t border-[#EFECE5] pb-4 pt-[18px]">
      <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>
        Architecture
      </span>
      {nodes.length === 0 ? (
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[#8C8A85]">
          Nothing derived yet — it fills in as you describe sites, users, network and cloud.
        </p>
      ) : edges.length === 0 ? (
        <div className="mt-3 flex flex-wrap gap-2.5">
          {nodes.map((n) => (
            <span key={n.id} className="rounded-[9px] border border-[#E0DCD3] bg-white px-3 py-[7px] text-[13px] text-[#33302C]">
              {n.label}
            </span>
          ))}
        </div>
      ) : (
        <svg
          className="mt-3 max-w-full"
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          role="img"
          aria-labelledby={titleId}
          style={{ overflow: "visible" }}
        >
          <title id={titleId}>{architecture.accessibleSummary}</title>
          <defs>
            <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#C4C0B8" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const from = positions.get(e.from);
            const to = positions.get(e.to);
            if (!from || !to) return null;
            const x1 = from.x + BOX_W;
            const y1 = from.y + BOX_H / 2;
            const x2 = to.x;
            const y2 = to.y + BOX_H / 2;
            const midX = (x1 + x2) / 2;
            return (
              <g key={`${e.from}-${e.to}-${i}`}>
                <path d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`} fill="none" stroke="#C4C0B8" strokeWidth={1.5} markerEnd="url(#arch-arrow)" />
                <text x={midX} y={(y1 + y2) / 2 - 5} textAnchor="middle" fontSize="10" fill="#A3A099" style={mono}>
                  {e.label}
                </text>
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = positions.get(n.id);
            if (!p) return null;
            return (
              <g key={n.id}>
                <rect x={p.x} y={p.y} width={BOX_W} height={BOX_H} rx={9} fill="white" stroke="#E0DCD3" strokeWidth={1.5} />
                <text x={p.x + BOX_W / 2} y={p.y + BOX_H / 2 + 4} textAnchor="middle" fontSize="12" fill="#33302C">
                  {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {/* The compiler's own plain-English rendering of this same
          architecture — an EQUIVALENT accessible text representation
          (Robert's item 9), not a decorative caption: it names every
          relationship the SVG above draws, always rendered (never
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
