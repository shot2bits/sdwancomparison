import MegaNav from "@/components/MegaNav";
import SiteFooter from "@/components/SiteFooter";
import CommercialFooter from "@/components/CommercialFooter";

/**
 * Marketing route-group layout (2030 living-procurement workspace
 * separation, 18 Aug 2026): every route that isn't the living-document
 * product experience lives under this group and keeps exactly the chrome
 * it always had — MegaNav above, the six-column commercial footer below.
 * This is the chrome that used to live directly in the true root layout
 * (src/app/layout.tsx); it moved here so the workspace group
 * ((workspace)/layout.tsx) can render its own minimal product header
 * instead without touching any of these routes. Route groups never
 * appear in the URL, so every public path under here — /account,
 * /admin, /opportunities, /rfp-builder, /vendors, and so on — is
 * unchanged.
 *
 * The footer's column data (FOOTER_COLUMNS) and markup now live in
 * src/components/CommercialFooter.tsx, shared verbatim with
 * (workspace)/layout.tsx, so the six columns have exactly one source of
 * truth instead of being copy-pasted between the two route groups.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The 2026 top navigation (Robert's verdicts, 24 Jul): one header
          everywhere; the sidebar retired with it and the canvas runs
          full width. Unchanged — still every marketing/research/board
          route, just no longer the true root so the workspace group can
          opt out. */}
      <MegaNav />
      <div className="min-h-screen flex flex-col">
        <main id="main-content" className="flex-1">{children}</main>

        <SiteFooter>
          <CommercialFooter />
        </SiteFooter>
      </div>
    </>
  );
}
