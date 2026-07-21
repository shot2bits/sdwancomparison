/**
 * The brief's figure: a deterministic SVG rendering of diagramModel. Pure
 * presentation; every shape corresponds one-to-one to model data derived
 * from stated or inferred facts, so it redraws on every correction and
 * never shows anything the draft does not contain. Risk pins sit in a
 * right-hand rail, each with a leader to the layer it belongs to.
 */

import type { DiagramModel, DiagramPin } from "@/lib/workspace/diagram";

const INK = "var(--ink-700, #3f3f46)";
const FAINT = "var(--ink-300, #a1a1aa)";
const PAPER = "var(--paper-base, #fff)";

const W = 400;
const CX = 140; // shape column centre; 260..396 is the pin rail
const RAIL_X = 262;

export default function WorkspaceDiagram({ model }: { model: DiagramModel }) {
  if (model.empty) return null;

  const rowGap = 64;
  const hasClouds = model.clouds.length > 0;
  const hasCore = model.core.length > 0;

  let y = 24;
  const cloudY = hasClouds ? y : 0;
  if (hasClouds) y += rowGap;
  const edgeY = y;
  y += rowGap;
  const coreY = hasCore ? y : 0;
  if (hasCore) y += rowGap;
  const sitesY = y;
  const shieldsY = sitesY + 56;
  const H = shieldsY + (model.shields.length ? 24 : 4);

  const anchorY: Record<DiagramPin["anchor"], number> = { edge: edgeY, core: coreY, sites: sitesY };
  const anchorRight: Record<DiagramPin["anchor"], number> = { edge: CX + 76, core: CX + 76, sites: CX + 108 };

  const cloudXs = model.clouds.map(
    (_, i) => CX + (i - (model.clouds.length - 1) / 2) * (model.clouds.length > 2 ? 82 : 96),
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Network diagram drawn from the stated estate" className="w-full">
      {/* Clouds */}
      {model.clouds.map((c, i) => (
        <g key={c}>
          <line x1={cloudXs[i]} y1={cloudY + 11} x2={CX} y2={edgeY - 13} stroke={FAINT} strokeWidth={1} />
          <rect x={cloudXs[i] - 44} y={cloudY - 11} width={88} height={22} rx={11} fill={PAPER} stroke={FAINT} />
          <text x={cloudXs[i]} y={cloudY + 3.5} fontSize={9.5} textAnchor="middle" fill={INK}>{c}</text>
        </g>
      ))}

      {/* Edge */}
      <g>
        <rect x={CX - 76} y={edgeY - 14} width={152} height={28} rx={6} fill={model.edge.proposed ? "#fffbeb" : PAPER} stroke={model.edge.proposed ? "#f59e0b" : FAINT} strokeDasharray={model.edge.proposed ? "4 3" : undefined} />
        <text x={CX} y={edgeY + (model.edge.proposed ? -1 : 3.5)} fontSize={10.5} textAnchor="middle" fill={INK} fontWeight={600}>{model.edge.label}</text>
        {model.edge.proposed && (
          <text x={CX} y={edgeY + 10} fontSize={8.5} textAnchor="middle" fill={INK} opacity={0.75}>proposed</text>
        )}
      </g>

      {/* Core */}
      {hasCore && (
        <g>
          <line x1={CX} y1={edgeY + 14} x2={CX} y2={coreY - 13} stroke={FAINT} strokeWidth={1} />
          <rect x={CX - 76} y={coreY - 13} width={152} height={26} rx={6} fill={PAPER} stroke={FAINT} />
          <text x={CX} y={coreY + 3.5} fontSize={10} textAnchor="middle" fill={INK}>{model.core.join(" · ")}</text>
        </g>
      )}

      {/* Sites cluster: one honest cluster, never an invented split */}
      <g>
        <line x1={CX} y1={(hasCore ? coreY : edgeY) + 13} x2={CX} y2={sitesY - 20} stroke={FAINT} strokeWidth={1} />
        <rect x={CX - 108} y={sitesY - 20} width={216} height={52} rx={8} fill={PAPER} stroke={INK} strokeWidth={1.2} />
        <text x={CX} y={sitesY - 6} fontSize={10.5} textAnchor="middle" fill={INK} fontWeight={600}>{model.sites.label}</text>
        {model.sites.siteSquares > 0 && (
          <g>
            {Array.from({ length: model.sites.siteSquares }).map((_, i) => (
              <rect
                key={i}
                x={CX - (model.sites.siteSquares * 17 + (model.sites.overflow > 0 ? 28 : 0)) / 2 + i * 17}
                y={sitesY + 3}
                width={12}
                height={12}
                rx={2.5}
                fill="none"
                stroke={INK}
              />
            ))}
            {model.sites.overflow > 0 && (
              <text x={CX + (model.sites.siteSquares * 17 + 28) / 2 - 22} y={sitesY + 13} fontSize={9.5} fill={INK}>+{model.sites.overflow}</text>
            )}
          </g>
        )}
        {model.staff && (
          <text x={CX} y={sitesY + (model.sites.siteSquares > 0 ? 27.5 : 11)} fontSize={9.5} textAnchor="middle" fill={INK} opacity={0.8}>{model.staff}</text>
        )}
      </g>

      {/* Risk pins: rail on the right, leader lines to their layer */}
      {model.pins.map((p, i) => {
        const py = 18 + i * 26;
        const ay = anchorY[p.anchor] || edgeY;
        return (
          <g key={p.label}>
            <path d={`M ${anchorRight[p.anchor]} ${ay} C ${RAIL_X - 24} ${ay}, ${RAIL_X - 24} ${py}, ${RAIL_X - 6} ${py}`} fill="none" stroke="#f59e0b" strokeWidth={0.9} opacity={0.55} />
            <circle cx={RAIL_X} cy={py} r={3.2} fill="#f59e0b" />
            <text x={RAIL_X + 8} y={py + 3.2} fontSize={9} fill={INK}>{p.label}</text>
          </g>
        );
      })}

      {/* Compliance shields */}
      {model.shields.length > 0 && (
        <text x={CX} y={shieldsY + 6} fontSize={9.5} textAnchor="middle" fill={INK} opacity={0.85}>
          Compliance: {model.shields.join(", ")}
        </text>
      )}
    </svg>
  );
}
