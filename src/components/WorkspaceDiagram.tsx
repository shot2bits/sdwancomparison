/**
 * The brief's figure: a deterministic SVG rendering of diagramModel. Pure
 * presentation; every shape corresponds one-to-one to model data derived
 * from stated or inferred facts, so it redraws on every correction and
 * never shows anything the draft does not contain. Risk pins sit in a
 * right-hand rail, each with a leader to the layer it belongs to.
 *
 * Layout laws (Robert, 23 Jul: "text is bleeding out and looks a bit
 * basic"): every box sizes to its own content and text never crosses a
 * border; geography renders as its own quiet wrapped line beneath the
 * sites cluster instead of stretching the cluster label; and when no risk
 * pins exist the column centres instead of reserving an empty rail.
 */

import type { DiagramModel, DiagramPin } from "@/lib/workspace/diagram";

const INK = "var(--ink-700, #3f3f46)";
const FAINT = "var(--ink-300, #a1a1aa)";
const PAPER = "var(--paper-base, #fff)";

const W = 400;

/** Approximate width of a string in viewBox units for the system font. */
const est = (s: string, fontSize: number): number => s.length * fontSize * 0.54;

/** Word-wrap into at most three lines of roughly maxChars characters. */
function wrapWords(s: string, maxChars: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (t.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export default function WorkspaceDiagram({ model }: { model: DiagramModel }) {
  if (model.empty) return null;

  const hasPins = model.pins.length > 0;
  const CX = hasPins ? 140 : W / 2; // centre the column when there is no pin rail
  const RAIL_X = 262;

  const rowGap = 58;
  const hasClouds = model.clouds.length > 0;
  const hasCore = model.core.length > 0;

  let y = 22;
  const cloudY = hasClouds ? y : 0;
  if (hasClouds) y += rowGap;
  const edgeY = y;
  y += rowGap;
  const coreY = hasCore ? y : 0;
  if (hasCore) y += rowGap;

  /* Sites cluster: box sized to its content, never the other way round */
  const squaresW =
    model.sites.siteSquares > 0
      ? model.sites.siteSquares * 17 + (model.sites.overflow > 0 ? 30 : 0)
      : 0;
  const boxW = Math.max(150, Math.min(300, Math.max(squaresW + 34, est(model.sites.label, 10.5) + 44)));
  const boxH = 26 + (model.sites.siteSquares > 0 ? 19 : 0) + (model.staff ? 15 : 0);
  const boxTop = y - 12;

  /* Geography: its own quiet line(s) beneath the one cluster */
  const regionsText = model.regions.join(", ");
  const regionLines = regionsText ? wrapWords(regionsText, hasPins ? 46 : 64) : [];
  const regionsY = boxTop + boxH + 15;

  const shieldsY = regionsY + regionLines.length * 11 + (regionLines.length ? 5 : 0);
  const H = shieldsY + (model.shields.length ? 16 : 2);

  const edgeBoxW = Math.max(120, est(model.edge.label, 10.5) + 36);
  const coreText = model.core.join(" · ");
  const coreBoxW = Math.max(120, Math.min(240, est(coreText, 10) + 32));

  const siteMidY = boxTop + boxH / 2;
  const anchorY: Record<DiagramPin["anchor"], number> = { edge: edgeY, core: coreY, sites: siteMidY };
  const anchorRight: Record<DiagramPin["anchor"], number> = {
    edge: CX + edgeBoxW / 2,
    core: CX + coreBoxW / 2,
    sites: CX + boxW / 2,
  };

  const cloudXs = model.clouds.map(
    (_, i) => CX + (i - (model.clouds.length - 1) / 2) * (model.clouds.length > 2 ? 82 : 96),
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Network diagram drawn from the stated estate" className="w-full">
      {/* Clouds */}
      {model.clouds.map((c, i) => {
        const pillW = Math.max(64, est(c, 9.5) + 26);
        return (
          <g key={c}>
            <line x1={cloudXs[i]} y1={cloudY + 11} x2={CX} y2={edgeY - 14} stroke={FAINT} strokeWidth={1} />
            <rect x={cloudXs[i] - pillW / 2} y={cloudY - 11} width={pillW} height={22} rx={11} fill={PAPER} stroke={FAINT} />
            <text x={cloudXs[i]} y={cloudY + 3.5} fontSize={9.5} textAnchor="middle" fill={INK}>{c}</text>
          </g>
        );
      })}

      {/* Edge */}
      <g>
        <rect
          x={CX - edgeBoxW / 2}
          y={edgeY - 14}
          width={edgeBoxW}
          height={28}
          rx={6}
          fill={model.edge.proposed ? "#fffbeb" : PAPER}
          stroke={model.edge.proposed ? "#f59e0b" : FAINT}
          strokeDasharray={model.edge.proposed ? "4 3" : undefined}
        />
        <text x={CX} y={edgeY + (model.edge.proposed ? -1 : 3.5)} fontSize={10.5} textAnchor="middle" fill={INK} fontWeight={600}>{model.edge.label}</text>
        {model.edge.proposed && (
          <text x={CX} y={edgeY + 10} fontSize={8.5} textAnchor="middle" fill={INK} opacity={0.75}>proposed</text>
        )}
      </g>

      {/* Core */}
      {hasCore && (
        <g>
          <line x1={CX} y1={edgeY + 14} x2={CX} y2={coreY - 13} stroke={FAINT} strokeWidth={1} />
          <rect x={CX - coreBoxW / 2} y={coreY - 13} width={coreBoxW} height={26} rx={6} fill={PAPER} stroke={FAINT} />
          <text x={CX} y={coreY + 3.5} fontSize={10} textAnchor="middle" fill={INK}>{coreText}</text>
        </g>
      )}

      {/* Sites cluster: one honest cluster, never an invented split */}
      <g>
        <line x1={CX} y1={(hasCore ? coreY : edgeY) + 13} x2={CX} y2={boxTop} stroke={FAINT} strokeWidth={1} />
        <rect x={CX - boxW / 2} y={boxTop} width={boxW} height={boxH} rx={8} fill={PAPER} stroke={INK} strokeWidth={1.2} />
        <text x={CX} y={boxTop + 17} fontSize={10.5} textAnchor="middle" fill={INK} fontWeight={600}>{model.sites.label}</text>
        {model.sites.siteSquares > 0 && (
          <g>
            {Array.from({ length: model.sites.siteSquares }).map((_, i) => (
              <rect
                key={i}
                x={CX - squaresW / 2 + i * 17}
                y={boxTop + 24}
                width={12}
                height={12}
                rx={2.5}
                fill="none"
                stroke={INK}
                strokeWidth={0.9}
              />
            ))}
            {model.sites.overflow > 0 && (
              <text x={CX - squaresW / 2 + model.sites.siteSquares * 17 + 4} y={boxTop + 34} fontSize={9.5} fill={INK}>+{model.sites.overflow}</text>
            )}
          </g>
        )}
        {model.staff && (
          <text x={CX} y={boxTop + boxH - 8} fontSize={9.5} textAnchor="middle" fill={INK} opacity={0.8}>{model.staff}</text>
        )}
      </g>

      {/* Geography: the estate's stated regions, quiet, wrapped, outside the box */}
      {regionLines.map((line, i) => (
        <text key={i} x={CX} y={regionsY + i * 11} fontSize={8.5} textAnchor="middle" fill={INK} opacity={0.7}>{line}</text>
      ))}

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
        <text x={CX} y={shieldsY + 8} fontSize={9.5} textAnchor="middle" fill={INK} opacity={0.85}>
          Compliance: {model.shields.join(", ")}
        </text>
      )}
    </svg>
  );
}
