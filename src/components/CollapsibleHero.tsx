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
 * Typography role (2030 living-procurement workspace visual pass, 18 Aug
 * 2026): the H1 now carries `var(--nf-font-serif)` — the approved
 * prototype's editorial-serif role for the living procurement object's
 * own title-level headings (its `h1.doc-title`/`h2.doc-title` rule).
 *
 * State-0 height correction (Robert's "Definitive 2030 Aesthetic
 * Constitution", 18 Aug 2026 -- explicitly BINDING and explicitly
 * superseding earlier aesthetic guidance): "The marketing hero occupies
 * no more than 25–30% of State 0 and disappears once a project exists."
 * The PRE-START hero was previously sized under an earlier, separate SEO
 * ruling (full clamp(38-58px) H1 + a two-paragraph subhead/value stack);
 * that earlier ruling governed WORDING/KEYWORD CONTENT, which is
 * preserved verbatim below (h1/promise/value props unchanged, still
 * present for the speakable schema and the h1 audit script) -- only the
 * VISUAL SIZE of the pre-start hero shrinks now, to a `lean` state
 * distinct from both the original full size and the post-start `compact`
 * size. This also happens to be the fix for a real, separately-measured
 * bug (18 Aug 2026 screenshot pass): at 1440x900 unscrolled, the
 * pre-start hero was tall enough that Mission Control's card collided
 * with the fixed composer before any scroll -- shrinking the hero to the
 * Constitution's own height budget clears that collision as a side
 * effect, not a coincidence chased separately.
 *
 * The `value` paragraph (the third, most marketing-toned block) is no
 * longer shown in the pre-start view -- the Constitution's own State 0
 * mockup shows eyebrow + H1 + ONE subhead line before the prompt, with a
 * "what will appear" preview taking the place a value/trust paragraph
 * used to occupy (this codebase's own EmptyDocumentFrame.tsx now serves
 * that exact role, real section names ghosted, not marketing copy). The
 * value paragraph is not deleted -- it moves to `sr-only` pre-start, same
 * treatment the whole hero already gets post-start, so it stays reachable
 * to any script/schema that reads it without consuming visible height.
 *
 * The h1/subhead are never REMOVED from the DOM: `id="page-h1"` and
 * `id="page-subhead"` are read by the speakable-schema `cssSelector`
 * (structured-data.ts) and the site's own h1-id audit script
 * (scripts/full-audit.py) on every route, including this one -- only
 * their VISUAL size changes across the three states (full pre-start
 * intent → lean pre-start reality → compact post-start), permanently for
 * this session ("Start again" reloads the page, resetting this too).
 */
export default function CollapsibleHero({
  h1,
  promise,
  value,
  eyebrow,
  definitions,
  role,
}: {
  h1: string;
  promise: string;
  value: string;
  eyebrow?: string;
  /** Short "what an SD-WAN RFP is / what a SASE RFP is" definitions shown
   *  above the application pre-start (Robert, 3 Sep 2026). Optional so the
   *  hero still renders for callers that pass none. */
  definitions?: { term: string; article: string; text: string }[];
  /** One sentence on what Netify does with the document. */
  role?: string;
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onStart = () => setCompact(true);
    window.addEventListener("pd:project-started", onStart);
    return () => window.removeEventListener("pd:project-started", onStart);
  }, []);

  /* VISIBILITY (Robert, 3 Sep 2026, "sd-wan rfp" / "sase rfp" citation
     work). The 19 Aug structural pass wrapped this whole block in sr-only,
     so the served page had no visible heading and no visible explanation
     of what the application is for; the crawlable prose on the canonical
     builder page came to roughly 120 words of UI labels. The pre-start
     hero is visible again: eyebrow, H1, the promise line, two short
     definitions and one sentence on Netify's role, inside the
     Constitution's height budget (H1 clamp unchanged at 30-42px, small
     text below). Once a project starts (`pd:project-started`) the whole
     block returns to sr-only exactly as before, so the workspace still
     carries no marketing headline. ids page-h1 / page-subhead / page-value
     are unconditional for the speakable schema and the h1 audit. */
  return (
    <div className={compact ? "sr-only" : "mx-auto max-w-[1150px] px-5 pb-4 pt-8 lg:px-8"}>
      {!compact && eyebrow && (
        <p
          className="mx-auto mb-2 text-center"
          style={{ fontFamily: "var(--nf-font-mono)", fontSize: "11.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--nf-orange-strong, #832f00)" }}
        >
          {eyebrow}
        </p>
      )}
      <h1
        id="page-h1"
        className={compact ? "sr-only" : "mx-auto max-w-[1150px] text-center"}
        style={
          compact
            ? undefined
            : { fontFamily: "var(--nf-font-serif)", fontSize: "clamp(30px, 1.6vw + 22px, 42px)", lineHeight: 1.12, fontWeight: 650, letterSpacing: "-0.015em", color: "#110f0d", margin: "0 auto 14px", transition: "font-size 220ms ease, margin 220ms ease" }
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
        <p
          id="page-subhead"
          className="mx-auto text-center"
          style={{ fontSize: "clamp(16px, 0.6vw + 13px, 19px)", lineHeight: 1.5, color: "#66635e", margin: "0 auto 14px", maxWidth: "52em" }}
        >
          {promise}
        </p>
      )}
      {definitions && definitions.length > 0 && (
        <dl
          id="rfp-definitions"
          className={compact ? "sr-only" : "mx-auto grid gap-3 text-left sm:grid-cols-2"}
          style={compact ? undefined : { maxWidth: "62em", margin: "18px auto 0" }}
        >
          {definitions.map((d) => (
            <div key={d.term} className="rounded-lg border border-[#e2dfdb] bg-[#fefdfc] px-4 py-3">
              <dt className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#110f0d]">{`What is ${d.article} ${d.term}?`}</dt>
              <dd className="mt-1 text-[14px] leading-6 text-[#55514d]">{d.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {role && (
        <p
          id="page-role"
          className={compact ? "sr-only" : "mx-auto text-center"}
          style={compact ? undefined : { fontSize: "14.5px", lineHeight: 1.55, color: "#55514d", margin: "14px auto 0", maxWidth: "52em" }}
        >
          {role}
        </p>
      )}
      {/* `value` (the third, most marketing-toned paragraph): visible only
          once compact is moot (kept sr-only pre-start per the height
          budget above; compact already sr-only's the whole subhead
          block, so this stays consistent rather than doubly-hidden). */}
      <p id="page-value" className="sr-only">
        {value}
      </p>
    </div>
  );
}
