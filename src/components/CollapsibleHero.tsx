"use client";

import { useEffect, useState } from "react";

/**
 * Living Procurement OS · Phase 3 Stage A correction round (Robert, 14
 * Aug 2026), item 8: "Once a project has started, substantially compact
 * the marketing hero so the command bar and living document dominate the
 * viewport, especially on mobile."
 *
 * ProjectDesk.tsx's own `started` state lives in a sibling component --
 * this hero and ProjectDesk render as siblings under the same Server
 * Component page (home/page.tsx, workspace/page.tsx), not parent/child --
 * so this listens for a small, undirected `window` event ProjectDesk
 * dispatches once a project starts (see ProjectDesk.tsx's own
 * `pd:project-started` dispatch), rather than lifting state into the
 * Server Component page (which would lose its `Metadata` export and is
 * exactly the "unrelated global redesign" Robert's own instruction warns
 * against) or threading a prop across an unrelated sibling boundary.
 *
 * The h1/subhead are never REMOVED from the DOM: `id="page-h1"` and
 * `id="page-subhead"` are read by the speakable-schema `cssSelector`
 * (structured-data.ts) and the site's own h1-id audit script
 * (scripts/full-audit.py) on every route, including this one -- only
 * their VISUAL size collapses once a project starts, permanently for
 * this session (the same one-way "started" transition ProjectDesk's own
 * state already is; "Start again" reloads the page, resetting this too).
 */
export default function CollapsibleHero({ h1, promise, value }: { h1: string; promise: string; value: string }) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onStart = () => setCompact(true);
    window.addEventListener("pd:project-started", onStart);
    return () => window.removeEventListener("pd:project-started", onStart);
  }, []);

  return (
    <div>
      <h1
        id="page-h1"
        className="mx-auto max-w-[1150px] text-center"
        style={
          compact
            ? { fontSize: "16px", lineHeight: 1.3, fontWeight: 650, letterSpacing: "-0.01em", color: "#18181b", margin: "0 auto 6px", transition: "font-size 220ms ease, margin 220ms ease" }
            : { fontSize: "clamp(38px, 2.5vw + 24px, 58px)", lineHeight: 1.1, fontWeight: 650, letterSpacing: "-0.015em", color: "#18181b", margin: "0 auto 32px", transition: "font-size 220ms ease, margin 220ms ease" }
        }
      >
        {h1}
      </h1>
      {compact ? (
        // Visually hidden, never removed: the subhead's own id/content
        // must stay reachable for the speakable schema and the audit
        // script, even while the visible hero is collapsed.
        <p id="page-subhead" className="sr-only">
          {promise}
        </p>
      ) : (
        <>
          <p
            id="page-subhead"
            className="mx-auto text-center"
            style={{ fontSize: "clamp(20px, 1vw + 16px, 26px)", lineHeight: 1.55, color: "#52525b", margin: "0 auto 22px" }}
          >
            {promise}
          </p>
          <p
            className="mx-auto text-center"
            style={{ fontSize: "clamp(16.5px, 0.5vw + 14px, 20px)", lineHeight: 1.6, color: "#71717a", margin: "0 auto 12px" }}
          >
            {value}
          </p>
        </>
      )}
    </div>
  );
}
