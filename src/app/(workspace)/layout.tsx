import MegaNav from "@/components/MegaNav";
import SiteFooter from "@/components/SiteFooter";
import CommercialFooter from "@/components/CommercialFooter";
import { workspaceFontVars } from "@/lib/workspace/fonts";

/**
 * Workspace route-group layout — /home, /workspace and the Procurement
 * Room.
 *
 * CHROME HISTORY. This has been ruled on four times; the whole sequence
 * is kept because each step reversed the one before it, and without the
 * trail this file reads as drift rather than decisions:
 *
 *   24 Jul 2026  MegaNav is the one header everywhere.
 *   30 Jul 2026  Robert: "the footer is missing from the main front page,
 *                this will impact EEAT." Footer added to the workspace.
 *   18 Aug 2026  2030 closure package rule 14 — "no marketing hero/footer
 *                inside the workspace" — plus Robert's own instruction
 *                that the workspace "may retain a deliberately minimal
 *                Netify product header... not reproduce the marketing
 *                navigation." MegaNav and the footer both removed;
 *                WorkspaceHeader written to replace MegaNav here.
 *   19 Aug 2026  Robert, after comparing the live apex against
 *                /sase/opportunities/board/: "Put the footer back please
 *                as per [the board]", then "Add back the main menu as
 *                well." Both restored. Asked whether to stack MegaNav
 *                above WorkspaceHeader or replace it, he chose replace.
 *
 * So this group now carries exactly the same chrome as (marketing):
 * MegaNav above, <SiteFooter><CommercialFooter /></SiteFooter> below,
 * both from the same single source as the board — they cannot drift
 * apart. Rule 14 no longer applies to this layout; it is superseded by
 * the 19 Aug instruction, and WorkspaceHeader is retired rather than
 * left as dead code (git history holds it if it is ever wanted back).
 *
 * WHY REPLACE RATHER THAN STACK. MegaNav and WorkspaceHeader were both
 * `sticky top-0 z-40` and both `h-13` (52px). Stacking two sticky headers
 * at the same offset is the exact bug MegaNav's own doc comment records
 * from an earlier round ("the moment it went, the apex root showed TWO
 * sticky..."), and with the project identity bar and the five-station
 * rail beneath it that would have put ~200px of chrome above the builder.
 *
 * THE 52px CONTRACT. ProjectDesk pins the project identity bar at
 * `top-[52px]`, the wizard rail at `top-[97px]`, and the chat pane at
 * `lg:top-[145px]` / `lg:h-[calc(100vh-145px)]`. Those offsets were
 * measured against WorkspaceHeader's 52px row. MegaNav's row is also
 * `h-13` = 52px, so the whole stack still lines up — verified live at
 * 1440x900 and 390x844 after the swap, not assumed from the class name.
 * If MegaNav's height ever changes, those three offsets must change with
 * it.
 *
 * Nothing else about the workspace moves: the five-station shell, the
 * chat pane and the living document are untouched by this file.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MegaNav />
      <div className={`min-h-screen flex flex-col ${workspaceFontVars}`}>
        <main id="main-content" className="flex-1">{children}</main>

        <SiteFooter>
          <CommercialFooter />
        </SiteFooter>
      </div>
    </>
  );
}
