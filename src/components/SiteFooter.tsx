/**
 * 2030 living-procurement workspace separation (18 Aug 2026), replacing the
 * prior "Checkpoint F" (17 Aug 2026) fix: that version hid the footer on
 * workspace routes with a client-side `usePathname()` prefix check — the
 * same class of fragile, runtime string-matching fix that MegaNav.tsx's own
 * doc comment describes trying and reverting (netify.co.uk/ and this app's
 * own /sase/ root both normalize to "/" once basePath is stripped, so
 * pathname-prefix matching can't reliably tell workspace and marketing
 * apex apart). It also required manually keeping a route-prefix list in
 * sync with actual routing by hand.
 *
 * The real fix is structural: SiteFooter is now only ever imported by
 * (marketing)/layout.tsx. The living-document workspace has its own
 * sibling layout, (workspace)/layout.tsx, which never imports this
 * component at all — so "does this route get the footer" is answered by
 * the filesystem router itself, not by a runtime pathname check. This file
 * goes back to being a plain pass-through; the footer's own markup/content
 * is still owned by the caller and passed as `children`, unchanged.
 */
export default function SiteFooter({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
