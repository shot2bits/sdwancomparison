import WorkspaceHeader from "@/components/WorkspaceHeader";
import SiteFooter from "@/components/SiteFooter";
import CommercialFooter from "@/components/CommercialFooter";
import { workspaceFontVars } from "@/lib/workspace/fonts";

/**
 * Workspace route-group layout (2030 living-procurement workspace
 * separation, 18 Aug 2026): the living-document product experience
 * (/home, /workspace and the Procurement Room) sits under this group
 * instead of (marketing), so it does not inherit MegaNav or the marketing
 * hero — per the approved Netify 2030 closure package's rule 14, the
 * workspace must not carry marketing chrome. In its place: WorkspaceHeader,
 * a small purpose-built product header (brand mark, project state/account
 * access, one essential nav link) — see that component's own doc comment
 * for why it is a new component rather than a stripped-down MegaNav.
 *
 * FOOTER — RESTORED 19 Aug 2026, and the reversal is deliberate.
 *
 * This has now been ruled on three times, so the history matters:
 *   30 Jul 2026  Robert: "the footer is missing from the main front page,
 *                this will impact EEAT." Footer added here as a reasoned
 *                exception to rule 14.
 *   18 Aug 2026  Robert: "Remove the full marketing footer from the
 *                workspace lifecycle." Exception withdrawn; footer gone.
 *   19 Aug 2026  Robert, after reviewing the live apex against
 *                /sase/opportunities/board/: "Put the footer back please
 *                as per [the board]." Restored, identical to
 *                (marketing)/layout.tsx.
 *
 * What the 18 Aug removal actually cost, measured on the live site rather
 * than argued: netify.co.uk's apex was left with exactly THREE outbound
 * internal links (Opportunities board, Sign in, and the logo to itself),
 * against roughly fifty on any (marketing) route. About Us, Our Team,
 * Editorial Policy & Corrections and Research Methodology — the pages
 * Google's quality-rater guidance leans on for "who is responsible for
 * this site" — were unreachable from the highest-authority page on the
 * domain, and getOrganizationSchema() carries no address, legal name or
 * company number to compensate machine-readably.
 *
 * This is `<SiteFooter><CommercialFooter /></SiteFooter>`, the exact
 * composition (marketing)/layout.tsx uses, sharing the same single
 * FOOTER_COLUMNS source — so the workspace footer and the board footer
 * cannot drift apart. Rule 14 still governs the HEADER: MegaNav stays out
 * of this group, and WorkspaceHeader is unchanged.
 *
 * Known consequence, stated rather than buried: the footer now renders
 * below the five-station builder mid-project too, not only on the
 * pre-start door. Gating it on pre-start only would keep the SEO benefit
 * (the apex's crawlable state) while keeping the working tool clean, and
 * is a one-line change here if that is preferred — but it was not what
 * was asked for, so it is not what was done.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen flex flex-col ${workspaceFontVars}`}>
      <WorkspaceHeader />
      <main id="main-content" className="flex-1">{children}</main>

      <SiteFooter>
        <CommercialFooter />
      </SiteFooter>
    </div>
  );
}
