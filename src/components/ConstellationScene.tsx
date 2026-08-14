"use client";

import { useMemo, useState } from "react";
import {
  BAND,
  capabilityRing,
  constellation,
  labelOffsets,
  vendorHue,
  type ConstellationInput,
} from "@/lib/workspace/constellation";
import type { Market, MarketVendor, FitState } from "./ProjectDesk";

/**
 * The Netify SASE Constellation, restored 1 Aug 2026.
 *
 * History: named and built 22-23 Jul 2026 (Robert's verdicts), gated to
 * post-publish only by R1b (30 Jul, the half-a-coke rule: distance IS
 * fit, so a ranked view is the half that generates at publish, not
 * before). Its import was dropped from the desk on 31 Jul when the page
 * was rebuilt around the prompt workspace, and the two rebuilds since
 * (the Requirement Twin, the Living SoR) never brought it back — the
 * geometry in lib/workspace/constellation.ts sat unused for two days.
 * This component wires it back in, unchanged law, unchanged geometry,
 * gated exactly as R1b specifies: it renders once the notice is
 * published, at the bottom of the page, and not before.
 */

const fmtDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
};

const daysBetween = (a: string, b: string): number => {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Infinity;
  return Math.abs(da - db) / 86400000;
};

const SCENE = { w: 760, h: 440, cx: 380, cy: 210 };

export type ConstellationSceneProps = {
  market: Market | null;
  fit: FitState | null;
  published: { invited: string[] } | null;
  buying: string | null;
  added: string[];
  namedSlugs: Set<string>;
  started: boolean;
  /** Invited slugs, post-publish. Living Procurement Canvas Phase 2
   *  correction (14 Aug 2026): this used to be a LIVE, still-recomputing
   *  slice of the caller's own fit.suppliers (kept minus whatever the
   *  buyer dropped from direct invites). Since the component only ever
   *  renders once `published` is set (see the `if (!published) return
   *  null` gate below -- R1b, "distance IS fit, so a ranked view is the
   *  half that generates at publish, not before"), reading a live `fit`
   *  even in that gated state was itself a subtler version of the same
   *  leak: "not a freshly recalculated workspace fit" is Robert's Phase 2
   *  wording for it. The caller (ProjectDesk) now derives this prop from
   *  `published.invited` -- the FROZEN list returned by the publish route
   *  itself -- never from `fit`. */
  fitSlugs: string[];
};

export default function ConstellationScene({
  market,
  fit,
  published,
  buying,
  added,
  namedSlugs,
  started,
  fitSlugs,
}: ConstellationSceneProps) {
  const [constellationKey, setConstellationKey] = useState(false);
  const [focusV, setFocusV] = useState<string | null>(null);
  const [focusC, setFocusC] = useState<string | null>(null);

  const shownFit = useMemo(() => new Set([...fitSlugs, ...added].slice(0, 8)), [fitSlugs, added]);

  /* Market rows: invited suppliers float into view first (Harry's 22 Jul
   * check: "N invited" must be verifiable without scrolling), then the
   * ranked fit order, then anything the buyer named directly, then the
   * rest by recency. */
  const marketRows = useMemo(() => {
    const vendors = market?.vendors ?? [];
    const latest = market?.latest_evaluation ?? "";
    const byS = new Map(vendors.map((v) => [v.slug, v]));
    const ordered: MarketVendor[] = [];
    for (const s of published?.invited ?? []) {
      const v = byS.get(s);
      if (v) { ordered.push(v); byS.delete(s); }
    }
    for (const s of fitSlugs) {
      const v = byS.get(s);
      if (v) { ordered.push(v); byS.delete(s); }
    }
    for (const s of added) {
      const v = byS.get(s);
      if (v) { ordered.push(v); byS.delete(s); }
    }
    const rest = [...byS.values()].sort((a, b) => (a.last_verified < b.last_verified ? 1 : -1));
    const all = [...ordered, ...rest];
    return { all, shown: all.slice(0, 12), latest, more: Math.max(0, all.length - 12) };
  }, [market, fitSlugs, added, published]);

  const sceneRanked = Boolean(started && buying && fitSlugs.length > 0);
  const sceneBodies = useMemo(() => {
    const items: ConstellationInput[] = marketRows.shown.map((v) => {
      const idx = fitSlugs.indexOf(v.slug);
      return { slug: v.slug, rank: sceneRanked && idx >= 0 ? idx : null };
    });
    return constellation(items, sceneRanked, SCENE.cx, SCENE.cy, 34, BAND);
  }, [marketRows, sceneRanked, fitSlugs]);

  // Living Procurement Canvas Phase 2 correction (14 Aug 2026): `fit`
  // (FitState, ProjectDesk.tsx) no longer ever carries `suppliers` -- the
  // /api/workspace/fit route now redacts vendor-identifying data
  // unconditionally, and per the product rule this component (though
  // already gated to post-publish only, see `if (!published) return
  // null` below) must render the FROZEN matched/invited result from the
  // publish response, never a freshly recalculated workspaceFit() --
  // exactly the shape that used to feed this map. Evidence lines to the
  // capability ring therefore no longer draw (there is no per-vendor,
  // per-check grade to draw from any more); the vendor dots themselves
  // still position and rank correctly, from `fitSlugs`/`published`, both
  // of which ProjectDesk now derives from the frozen publish response.
  // Nothing here is invented to fill the gap -- the honest degradation
  // is fewer lines, never a guessed one.
  const fitBySlug = useMemo(() => new Map<string, { matched: { id: string; grade: string }[] }>(), []);

  const capNodes = useMemo(
    () => capabilityRing(sceneRanked ? fit?.checks ?? [] : [], SCENE.cx, SCENE.cy, 92, 0.78),
    [sceneRanked, fit],
  );
  const capById = useMemo(() => new Map(capNodes.map((c) => [c.id, c])), [capNodes]);

  const sceneLabels = useMemo(() => {
    const byS = new Map(marketRows.shown.map((v) => [v.slug, v]));
    const obstacles = [
      { id: "__you", x: SCENE.cx, y: SCENE.cy, half: 12 },
      ...sceneBodies.map((b) => ({ id: b.slug, x: b.x, y: b.y, half: 9 })),
      ...capNodes.map((c) => ({ id: c.id, x: c.x, y: c.y, half: 6 })),
    ];
    const capItems = capNodes.map((c) => {
      const above = c.y <= SCENE.cy;
      const label = c.label.length > 30 ? `${c.label.slice(0, 29)}…` : c.label;
      return { slug: c.id, x: c.x, y: above ? c.y - 11 : c.y + 11, anchor: "middle" as const, len: label.length };
    });
    const vendorItems = sceneBodies.map((b) => {
      const v = byS.get(b.slug);
      const name = v ? (v.name.length > 22 ? `${v.name.slice(0, 21)}…` : v.name) : b.slug;
      const anchorEnd = b.x > SCENE.w - 120 ? true : b.x < 120 ? false : Math.cos((b.angle * Math.PI) / 180) < 0;
      return { slug: b.slug, x: b.x, y: b.y, anchor: (anchorEnd ? "end" : "start") as "end" | "start", len: name.length, gap: 10 };
    });
    return labelOffsets([...capItems, ...vendorItems], obstacles);
  }, [sceneBodies, capNodes, marketRows]);

  const invitedSet = new Set(published?.invited ?? []);

  if (!published) return null;

  return (
    <div className="mx-auto mt-16 w-full max-w-[1000px] px-[26px] pb-10">
      <style>{`
        @keyframes cs-emerge{from{opacity:0}}
        .cs-emerge{animation:cs-emerge .9s ease}
        .cs-move{transition:transform .6s cubic-bezier(.34,1.56,.64,1)}
        @media(prefers-reduced-motion:reduce){.cs-move{transition:none}.cs-emerge{animation:none}}
      `}</style>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="m-0 text-[10px] font-mono font-semibold uppercase tracking-[.12em] text-[#6E6C67]">
          The Netify SASE Constellation
        </p>
        <p className="m-0 text-[12.5px] text-[#8C8A85]">
          distance is fit · every position computed from graded evidence · nothing moves except on its own evidence
          {" · "}
          <button type="button" onClick={() => setConstellationKey((o) => !o)} className="cursor-pointer border-0 bg-transparent p-0 underline hover:text-[#5F5D59]">
            {constellationKey ? "close the key" : "how to read this"}
          </button>
        </p>
      </div>
      {constellationKey && (
        <div className="mt-2 rounded-md border border-[#EAE7E1] bg-white p-4 text-[12.5px] leading-relaxed text-[#5F5D59]">
          <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">You</span> are the dot at the centre. Everything on the map positions itself against your stated requirements.</p>
          <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Diamonds</span> are requirements created from your own words. Each one exists because you said it; strike the fact and its diamond goes with it.</p>
          <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Circles</span> are technology vendors. <span className="font-semibold text-[#33302C]">Squares</span> are managed service providers.</p>
          <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Distance is fit.</span> A vendor or service provider sits closer when its graded evidence against your named requirements is stronger. Before you name requirements, they all hold one honest ring, because there is nothing yet to rank them against.</p>
          <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Lines are evidence.</span> A line exists only where the Netify dataset grades that vendor or service provider for that requirement: solid means evidenced, dashed means partial. No line means no graded evidence, never a guess.</p>
          <p className="m-0 mb-1.5"><span className="font-semibold text-[#33302C]">Colour</span> follows the vendor or service provider, never its rank. Amber marks your market activity, such as who you invited.</p>
          <p className="m-0"><span className="font-semibold text-[#33302C]">Hover</span> a vendor, a service provider or a requirement to isolate its evidence. The evidence source and its latest evaluation date sit beneath the map.</p>
        </div>
      )}
      {marketRows.shown.length > 0 && (
        <svg
          viewBox={`0 0 ${SCENE.w} ${SCENE.h}`}
          className="mt-1 block w-full"
          role="img"
          aria-label="The Netify SASE Constellation: vendors and service providers positioned by evidence against your named requirements, capability lines where the dataset grades them"
          onMouseLeave={() => { setFocusV(null); setFocusC(null); }}
        >
          <g key={`lines:${fitSlugs.join(",")}:${capNodes.length}`} className="cs-emerge">
            {capNodes.length > 0 && sceneBodies.map((b) => {
              const fs = fitBySlug.get(b.slug);
              if (!fs) return null;
              const hue = vendorHue(b.slug);
              return fs.matched.map((m) => {
                const cap = capById.get(m.id);
                if (!cap) return null;
                const focused = focusV === b.slug || focusC === m.id;
                const faded = (focusV !== null || focusC !== null) && !focused;
                const full = m.grade === "yes";
                return (
                  <line
                    key={`${b.slug}:${m.id}`}
                    x1={b.x} y1={b.y} x2={cap.x} y2={cap.y}
                    stroke={hue}
                    strokeWidth={focused ? (full ? 1.9 : 1.5) : full ? 1.25 : 1}
                    strokeDasharray={full ? undefined : "5 4"}
                    opacity={faded ? 0.05 : focused ? 0.9 : 0.24}
                    style={{ transition: "opacity .25s" }}
                  />
                );
              });
            })}
          </g>

          <circle cx={SCENE.cx} cy={SCENE.cy} r={7} fill="#141414" />
          <text x={SCENE.cx} y={SCENE.cy + 20} fontSize={7.5} textAnchor="middle" fill="#8C8A85" style={{ letterSpacing: ".12em" }}>YOU</text>

          {capNodes.map((c) => {
            const faded = (focusV !== null && !(fitBySlug.get(focusV)?.matched.some((m) => m.id === c.id))) || (focusC !== null && focusC !== c.id);
            const above = c.y <= SCENE.cy;
            return (
              <g
                key={c.id}
                className="cs-emerge"
                style={{ opacity: faded ? 0.22 : 1, transition: "opacity .25s", cursor: "default" }}
                onMouseEnter={() => { setFocusC(c.id); setFocusV(null); }}
              >
                <rect x={c.x - 3.2} y={c.y - 3.2} width={6.4} height={6.4} transform={`rotate(45 ${c.x} ${c.y})`} fill="#141414" />
                <text
                  x={c.x} y={(above ? c.y - 8 : c.y + 14) + (sceneLabels[c.id] ?? 0)}
                  fontSize={8}
                  textAnchor="middle"
                  fill="#33302C"
                >{c.label.length > 30 ? `${c.label.slice(0, 29)}…` : c.label}</text>
              </g>
            );
          })}

          {sceneBodies.map((b) => {
            const v = marketRows.shown.find((s) => s.slug === b.slug);
            if (!v) return null;
            const isFit = shownFit.has(v.slug);
            const bright = v.last_verified === marketRows.latest && marketRows.latest !== "";
            const recent = !bright && Boolean(marketRows.latest) && daysBetween(v.last_verified, marketRows.latest) < 60;
            const dim = started && Boolean(buying) && !isFit;
            const invited = invitedSet.has(v.slug);
            const hue = vendorHue(v.slug);
            const labelInk = bright ? "#141414" : recent ? "#52525b" : "#a8a29e";
            const size = bright || invited ? 5.5 : 4.8;
            const provider = /provider/i.test(v.category);
            const faded = (focusV !== null && focusV !== b.slug) || (focusC !== null && !(fitBySlug.get(b.slug)?.matched.some((m) => m.id === focusC)));
            const anchorEnd = b.x > SCENE.w - 120 ? true : b.x < 120 ? false : Math.cos((b.angle * Math.PI) / 180) < 0;
            const name = v.name.length > 22 ? `${v.name.slice(0, 21)}…` : v.name;
            return (
              <a key={b.slug} href={`/sase/vendors/${b.slug}/`} aria-label={`${v.name}, evaluated ${fmtDate(v.last_verified)}`}>
                <g
                  className="cs-move cs-emerge"
                  style={{ transform: `translate(${b.x}px, ${b.y}px)`, cursor: "pointer", opacity: faded ? 0.16 : dim ? 0.38 : 1 }}
                  onMouseEnter={() => { setFocusV(b.slug); setFocusC(null); }}
                >
                  {invited && (
                    <>
                      <line x1={0} y1={0} x2={SCENE.cx - b.x} y2={SCENE.cy - b.y} stroke="#F5A21B" strokeWidth={1.3} opacity={0.5} />
                      <circle r={size + 3.2} fill="none" stroke="#F5A21B" strokeWidth={1.4} />
                    </>
                  )}
                  {added.includes(v.slug) && <circle r={size + 3} fill="none" stroke="#8C8A85" strokeWidth={0.8} />}
                  {provider ? (
                    <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={1.5} fill={hue} />
                  ) : (
                    <circle r={size} fill={hue} />
                  )}
                  <text
                    x={anchorEnd ? -(size + 5) : size + 5}
                    y={3 + (sceneLabels[b.slug] ?? 0)}
                    fontSize={9}
                    textAnchor={anchorEnd ? "end" : "start"}
                    fill={labelInk}
                    style={namedSlugs.has(v.slug) ? { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" } : undefined}
                  >{name}</text>
                </g>
              </a>
            );
          })}
        </svg>
      )}
      <p className="m-0 mt-1 text-[12.5px] leading-snug text-[#8C8A85]">
        {capNodes.length > 0 ? (
          <>Diamonds are the requirements your own words created; a line exists only where Netify&rsquo;s dataset grades that vendor or service provider for that requirement (solid evidenced, dashed partial). Hover any of them, or a requirement, to isolate its evidence. Circles are technology vendors, squares managed providers.</>
        ) : (
          <>Your requirements appear here as points of gravity, with a line from every vendor and service provider the evidence supports. Circles are technology vendors, squares managed providers; nothing sits closer than the evidence puts it.</>
        )}
        {market?.latest_evaluation ? ` Evidence: Netify vendor dataset, live · latest evaluation ${fmtDate(market.latest_evaluation)}.` : ""}
      </p>
    </div>
  );
}
