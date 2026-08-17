"use client";

import { usePathname } from "next/navigation";

/**
 * 2030 shell reset, Checkpoint F (17 Aug 2026): the blueprint's binding
 * visual-standard no-go list is explicit -- "marketing footer absent from
 * active workspace." `layout.tsx` is the one root layout every route shares
 * (marketing pages AND the Living Procurement workspace), so the footer
 * previously rendered unconditionally on every page, including `/home/` and
 * `/workspace/` (confirmed via Playwright: `footer` element count 1 on
 * `/home/`). Pulled out of the server-rendered root layout into this small
 * client component -- the ONLY part of the footer that needs to change is
 * "render or don't" based on the CURRENT route, which needs `usePathname()`
 * (client-only); the footer's own content/markup is unchanged, still owned
 * by the caller (`RootLayout`), which passes it as `children` so this file
 * carries no duplicated column data to drift out of sync with `layout.tsx`.
 *
 * Workspace routes (`usePathname()` returns the path WITHOUT this app's
 * `/sase` basePath, e.g. `/home`, not `/sase/home` -- see next.config.ts):
 *   /home        -- the door of the sourcing engine (home/page.tsx)
 *   /workspace   -- the twin/redirect route (workspace/page.tsx)
 *   /rfp/*       -- an open buyer project (including any future
 *                   Procurement Room view under it)
 * Every other route (marketing pages, /vendors/, /insights/, /marketplace/,
 * etc.) keeps the full commercial footer, unchanged.
 */
const WORKSPACE_PREFIXES = ["/home", "/workspace", "/rfp"];

function isWorkspaceRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return WORKSPACE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function SiteFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isWorkspaceRoute(pathname)) return null;
  return <>{children}</>;
}
