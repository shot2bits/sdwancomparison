import WorkspaceHeader from "@/components/WorkspaceHeader";
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
 * Correction (Robert, 18 Aug 2026): the six-column commercial footer
 * previously rendered here below the fold, as a reasoned exception to
 * rule 14 carried over from an earlier EEAT ruling on the pre-2030
 * /home and /workspace pages. Robert's explicit instruction this pass —
 * "Remove the full marketing footer from the workspace lifecycle" —
 * supersedes that earlier exception; it is not reachable from within the
 * workspace experience at all now (marketing/research/opportunity-board
 * pages, which this instruction does not touch, keep it unchanged via
 * (marketing)/layout.tsx).
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen flex flex-col ${workspaceFontVars}`}>
      <WorkspaceHeader />
      <main id="main-content" className="flex-1">{children}</main>
    </div>
  );
}
