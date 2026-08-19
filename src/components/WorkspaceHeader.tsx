"use client";

/**
 * The living-document workspace's own minimal product header (2030
 * living-procurement workspace separation, 18 Aug 2026), replacing MegaNav
 * on /home and /workspace per the approved prototype's rule 14 ("no
 * marketing hero/footer inside the workspace") and Robert's explicit
 * instruction: "The product workspace may retain a deliberately minimal
 * Netify product header: brand, project state/account access and essential
 * navigation only... follow the approved prototype, not reproduce the
 * marketing navigation."
 *
 * This is NOT MegaNav with items removed — it is a new, small component so
 * the workspace's chrome can carry the approved prototype's own visual
 * language (see the frozen closure package) without inheriting the mega-
 * panel/hover-group interaction model that belongs to the marketing site.
 * It keeps only what the instruction names: the brand mark, session/account
 * access (mirrors MegaNav's own session-aware Sign in / My account logic,
 * duplicated in miniature rather than imported since MegaNav has no
 * "minimal" render mode and the instruction is explicit that this must not
 * become a reproduction of the marketing nav), and one essential nav item
 * (the opportunities board, the one non-workspace destination a buyer
 * mid-project plausibly needs).
 *
 * Visual pass (18 Aug 2026): restyled from the light placeholder built
 * during the routing-separation step to the approved prototype's own
 * `.topbar` treatment (index.html) — deep-ink sticky bar, white brand
 * mark, mono uppercase wordmark — since Robert's instruction is explicit
 * that this header should "follow the approved prototype", not just sit
 * structurally apart from MegaNav. `.procurement-2030` is applied directly
 * on this header (not inherited from a shared ancestor — see
 * ProcurementEntry.tsx's own doc comment on why CommercialFooter, which
 * this same layout also renders, must NOT pick up these tokens) so the
 * --nf-* variables resolve here independently.
 *
 * Aesthetic-only restyle (19 Aug 2026, Robert's "UI mockups request"
 * handoff bundle): flips the bar from the dark ink-950 fill above to the
 * reference design's light bar (ivory-raised bg, hairline bottom border,
 * small dark square brand mark with an accent-orange corner dot, dark
 * text) — the SAME header, same links, same session logic, same "N"
 * mark; only the colour direction inverted, per the handoff doc's own
 * top-bar treatment. Nothing below changes what this component does,
 * only how it's painted.
 *
 * Scoped-out for this pass, tracked as a named follow-up rather than a
 * silent gap: the prototype's topbar also shows live project identity
 * (document title, version/status badges) once a project exists. That
 * data lives deep in ProjectDesk's own client state and isn't threaded
 * up to this sibling header yet — the identity row ProjectDesk already
 * renders inline (project name, save state) continues to carry that
 * information for now. Wiring a `pd:project-identity` window-event
 * bridge (the same pattern CollapsibleHero already uses for
 * `pd:project-started`) is the natural next step, not a redesign.
 */

import { useEffect, useState } from "react";
import { SIGN_IN, ACCOUNT, BOARD_LINK } from "@/lib/nav";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; admin?: boolean };

export default function WorkspaceHeader() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/sase/api/auth/session")
      .then((r) => r.json())
      .then((d: Session) => { if (live) setSession(d); })
      .catch(() => { if (live) setSession({ authenticated: false }); });
    return () => { live = false; };
  }, []);

  const accountLabel = session?.authenticated ? ACCOUNT.label : SIGN_IN.label;
  const accountHref = session?.authenticated ? ACCOUNT.href : SIGN_IN.href;

  return (
    <header
      className="procurement-2030 sticky top-0 z-40 border-b"
      style={{ background: "var(--nf-ivory-raised)", color: "var(--nf-ink-900)", borderColor: "var(--nf-rule)" }}
    >
      <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-4 px-5 py-[14px] sm:px-6">
        <a
          href="/"
          className="flex shrink-0 items-center gap-2.5 no-underline"
          style={{ fontFamily: "var(--nf-font-mono)", fontSize: "11.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--nf-ink-900)" }}
        >
          <span
            className="relative grid h-7 w-7 flex-none place-items-center rounded-[3px] text-sm font-bold"
            style={{ fontFamily: "var(--nf-font-serif)", background: "var(--nf-ink-950)", color: "#fff" }}
          >
            N
            {/* Handoff doc, brand mark ("width:18px;height:18px;background:
                oklch(0.17 0.006 75);position:relative" plus a small
                accent-coloured corner dot): the one purely decorative
                flourish from the reference's own top-bar treatment, added
                alongside (not instead of) the existing "N" mark. */}
            <span
              aria-hidden="true"
              className="absolute -right-[3px] -top-[3px] h-[6px] w-[6px] rounded-full"
              style={{ background: "var(--nf-orange)" }}
            />
          </span>
          <span className="hidden sm:inline">Netify / Living Procurement OS</span>
        </a>
        {/* Touch-target correction (verification pass, 18 Aug 2026): these
            two links carried no vertical padding of their own, so their
            actual hit area was just their 17px text-line height, even
            though `items-center` visually centred them inside the header's
            52px (h-13) row -- a real sub-target tap area on mobile
            (measured via Playwright at 390px: 50x17px), not just a guess.
            `py-3` (12px top+bottom) grows ONLY the invisible hit box to
            ~41px, well inside the row's own 52px height, so the header's
            visible size and the approved prototype's topbar aesthetic are
            unchanged -- no new chrome, no layout shift. */}
        <nav aria-label="Workspace" className="flex shrink-0 items-center gap-4">
          <a
            href={BOARD_LINK.href}
            className="hidden items-center py-3 no-underline transition-colors hover:text-[var(--nf-ink-950)] sm:inline-flex"
            style={{ fontFamily: "var(--nf-font-mono)", fontSize: "10.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nf-ink-600)" }}
          >
            {BOARD_LINK.label}
          </a>
          <a
            href={accountHref}
            className="inline-flex items-center py-3 no-underline transition-colors hover:text-[var(--nf-ink-950)]"
            style={{ fontFamily: "var(--nf-font-mono)", fontSize: "10.5px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nf-ink-600)" }}
          >
            {accountLabel}
          </a>
        </nav>
      </div>
    </header>
  );
}
