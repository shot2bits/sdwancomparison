// Verification-only script (not part of the app): proves the 2030
// living-procurement workspace chrome separation is structural, not a
// runtime pathname check. Reads the REAL source files under src/app and
// src/components and asserts on them directly, mirroring this repo's own
// static-source-assertion style (see e.g. validate-canonical-envelope-
// closure.ts, validate-rfp-builder-match-disclosure.ts).
//
// This exists per Robert's explicit instruction (18 Aug 2026 route/layout
// directive): "add route/regression tests proving unrelated routes retain
// chrome and the workspace doesn't." It also guards the specific
// anti-pattern he forbade -- hiding chrome with a client-side
// usePathname() prefix check -- by asserting SiteFooter.tsx contains no
// such logic, since exactly that pattern was found and removed from this
// codebase during this same pass.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const src = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");
const exists = (...parts: string[]) => existsSync(path.join(ROOT, ...parts));

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

function main() {
  /* ================================================================ */
  /* 0. THE PUBLISH GATE IS ONE SOURCE (19 Aug 2026).                  */
  /*    Robert: "no structure, nobody knows where they are... a list    */
  /*    of random questions with no end in sight." Root cause: a real,  */
  /*    finite, monotonic gate (five standing facts) was enforced in    */
  /*    `signLocked` and never shown, while an infinite GENERATIVE      */
  /*    advisory stream was labelled "blocking" and shown everywhere.   */
  /*    The fix is that the checklist a buyer reads and the boolean     */
  /*    that stops them are the same object. These assertions exist so  */
  /*    they cannot silently drift apart again.                         */
  /* ================================================================ */
  {
    const desk = src("src/components/ProjectDesk.tsx");
    const checklist = src("src/lib/workspace/publish-checklist.ts");
    record(/persistedEssentialBaselineChecklist\(/.test(desk), "0: ProjectDesk builds the publish checklist from the same persisted seven-section baseline as the server", "");
    record(/!publishChecklist\.ready/.test(desk), "0: signLocked is gated on that SAME checklist object, not a parallel re-derivation", "");
    record(/sectionProgress\.ready/.test(desk) && /sectionProgress\.total/.test(desk), "0: the final workspace status band reads the canonical section progress projection", "");
    record(/ready: doneCount === items\.length/.test(checklist), "0: `ready` is derived from the items themselves, so the count shown and the gate enforced cannot disagree", "");
    record(!/materialDecisions/.test(checklist), "0: open decisions are NOT part of the gate -- they are advisory and generative, and including them could produce a gate that never empties", "");
  }

  /* ================================================================ */
  /* 1. The true root layout renders neither MegaNav nor SiteFooter --  */
  /*    the chrome moved one level down into (marketing)/layout.tsx so  */
  /*    the workspace group can opt out (App Router layout nesting is   */
  /*    strictly additive; the root can't be the thing that opts out).  */
  /* ================================================================ */
  {
    const rootLayout = src("src/app/layout.tsx");
    // Import statements (not prose mentions in doc comments, which
    // legitimately discuss where the chrome moved) are the real signal.
    record(!/^import .*MegaNav/m.test(rootLayout), "1: the true root layout (src/app/layout.tsx) does not import MegaNav", "");
    record(!/^import .*SiteFooter/m.test(rootLayout), "1: the true root layout does not import SiteFooter", "");
    record(!/^import .*CommercialFooter/m.test(rootLayout), "1: the true root layout does not import CommercialFooter", "");
  }

  /* ================================================================ */
  /* 2. (marketing)/layout.tsx -- the group every non-workspace route   */
  /*    now lives under -- renders MegaNav and the commercial footer.   */
  /* ================================================================ */
  {
    const marketingLayout = src("src/app/(marketing)/layout.tsx");
    record(/<MegaNav\s*\/>/.test(marketingLayout), "2: (marketing)/layout.tsx renders <MegaNav />", "");
    record(/<CommercialFooter\s*\/>/.test(marketingLayout), "2: (marketing)/layout.tsx renders <CommercialFooter />", "");
    /* Parity, 19 Aug 2026: both groups now carry identical chrome, so a
       future change to one must be a deliberate divergence, not a
       silent one. */
    record(/<MegaNav\s*\/>/.test(marketingLayout), "2: (marketing)/layout.tsx renders <MegaNav /> -- the SAME header the workspace group now uses", "");
  }

  /* ================================================================ */
  /* 3. (workspace)/layout.tsx -- home, workspace and the Procurement   */
  /*    Room -- renders the minimal WorkspaceHeader instead of MegaNav. */
  /*                                                                    */
  /*    THE FOOTER ASSERTION IS INVERTED, 19 Aug 2026. This section     */
  /*    previously asserted the workspace carries NO footer (Robert's   */
  /*    18 Aug "remove the full marketing footer from the workspace     */
  /*    lifecycle"). He has since reviewed the live apex against        */
  /*    /sase/opportunities/board/ and asked for it back: the apex was  */
  /*    left with three outbound internal links against the board's     */
  /*    ~fifty, with About/Our Team/Editorial Policy/Research           */
  /*    Methodology unreachable from the highest-authority page on the  */
  /*    domain. Rule 14 still governs the HEADER -- MegaNav must stay   */
  /*    out -- which is why that assertion below is unchanged.          */
  /* ================================================================ */
  {
    const workspaceLayout = src("src/app/(workspace)/layout.tsx");
    /* INVERTED AGAIN, 19 Aug 2026: "Add back the main menu as well."
       Rule 14's header clause is now superseded too -- the workspace
       carries the SAME MegaNav as (marketing), and WorkspaceHeader is
       retired. Offered stack-vs-replace, Robert chose replace, so there
       must be exactly ONE header here: two `sticky top-0 z-40` bars at
       the same offset is a bug MegaNav's own history already records. */
    record(/<MegaNav\s*\/>/.test(workspaceLayout), "3: (workspace)/layout.tsx renders <MegaNav /> (19 Aug restoration)", "");
    /* Matches the IMPORT and the JSX TAG, not the bare word: the doc
       comment above legitimately narrates why WorkspaceHeader was
       retired, and a fixture that trips over its own explanation is
       testing prose. (Second time this exact trap has bitten in this
       file's history -- see the --nf-lilac-on-dark note in
       validate-2030-constitution-corrections.ts.) */
    record(!/import .*WorkspaceHeader/.test(workspaceLayout) && !/<WorkspaceHeader/.test(workspaceLayout), "3: WorkspaceHeader is neither imported nor rendered -- exactly one header, never two stacked sticky bars", "");
    record(!existsSync(path.join(ROOT, "src/components/WorkspaceHeader.tsx")), "3: WorkspaceHeader.tsx is deleted rather than left as dead code (git history holds it)", "");
    record(/<CommercialFooter\s*\/>/.test(workspaceLayout), "3: (workspace)/layout.tsx renders <CommercialFooter /> (19 Aug restoration)", "");
    record(/<SiteFooter>/.test(workspaceLayout), "3: it is wrapped in <SiteFooter>, the SAME composition (marketing)/layout.tsx uses -- so the workspace footer and the board footer cannot drift apart", "");
  }

  /* ================================================================ */
  /* 4. The forbidden pattern -- hiding chrome via a client-side         */
  /*    usePathname() route-prefix check -- is structurally absent      */
  /*    from SiteFooter.tsx and MegaNav.tsx. This is the exact anti-    */
  /*    pattern a prior session introduced and this pass reverted; it   */
  /*    guards against it silently coming back.                        */
  /* ================================================================ */
  {
    const siteFooter = src("src/components/SiteFooter.tsx");
    // The doc comment legitimately discusses the removed usePathname()
    // approach in prose; the real signal is whether the file still
    // imports it from next/navigation, which is the only way to
    // actually call it.
    record(!/from ["']next\/navigation["']/.test(siteFooter), "4: SiteFooter.tsx does not import from next/navigation (no client-side route-based hiding)", "");
    const megaNav = src("src/components/MegaNav.tsx");
    record(
      !/pathname\.startsWith\((["'`])\/(home|workspace)/.test(megaNav),
      "4: MegaNav.tsx contains no /home or /workspace pathname-prefix hiding check",
      "",
    );
  }

  /* ================================================================ */
  /* 5. Public URLs are unaffected by the route-group restructuring: a  */
  /*    representative sample of routes that moved into (marketing)     */
  /*    still resolve to the same URL segments (route groups are        */
  /*    stripped from the URL, not renamed into it), and home/workspace */
  /*    live under (workspace) with their public paths unchanged.       */
  /* ================================================================ */
  {
    const marketingSamples = [
      "account/page.tsx",
      "opportunities/board/page.tsx",
      "rfp-builder/[id]/preview/download/route.ts",
      "vendors/[slug]/page.tsx",
    ];
    for (const rel of marketingSamples) {
      const moved = exists("src/app/(marketing)", rel);
      const stale = exists("src/app", rel);
      record(moved, `5: src/app/(marketing)/${rel} exists after the restructuring`, "");
      record(!stale, `5: src/app/${rel} (the pre-move path) no longer exists`, "");
    }
    record(exists("src/app/(workspace)/home/page.tsx"), "5: src/app/(workspace)/home/page.tsx exists", "");
    record(exists("src/app/(workspace)/workspace/page.tsx"), "5: src/app/(workspace)/workspace/page.tsx exists", "");
    record(!exists("src/app/home/page.tsx"), "5: the pre-move src/app/home/page.tsx no longer exists", "");
    record(!exists("src/app/workspace/page.tsx"), "5: the pre-move src/app/workspace/page.tsx no longer exists", "");
    // 18 Aug 2026 correction: the Procurement Room is the post-publication
    // state of the SAME product (Robert's explicit decision 3), so it
    // moved from (marketing) into (workspace) specifically -- unlike every
    // other project/[id]/* tab (story/timeline/approve/assessment/rescope),
    // which stayed in (marketing) since that instruction named only the
    // Room, not the whole project tab set.
    record(exists("src/app/(workspace)/project/[id]/room/page.tsx"), "5: src/app/(workspace)/project/[id]/room/page.tsx exists (Room moved into workspace chrome)", "");
    record(!exists("src/app/(marketing)/project/[id]/room/page.tsx"), "5: src/app/(marketing)/project/[id]/room/page.tsx (the pre-move path) no longer exists", "");
    for (const rel of ["story/page.tsx", "timeline/page.tsx", "approve/page.tsx", "assessment/page.tsx", "rescope/page.tsx"]) {
      record(exists("src/app/(marketing)/project/[id]", rel), `5: src/app/(marketing)/project/[id]/${rel} still exists (unrelated project tabs keep marketing chrome)`, "");
    }
  }

  /* ================================================================ */
  /* 6. Route Handlers are unaffected by route groups regardless of    */
  /*    nesting (Next.js never wraps route.ts in layout.tsx), so the    */
  /*    api/ tree and the other route.ts-only trees were correctly     */
  /*    left where they were -- asserted here so a future pass doesn't  */
  /*    "fix" this by moving them unnecessarily.                        */
  /* ================================================================ */
  {
    record(exists("src/app/api"), "6: src/app/api/ was left in place (route handlers aren't wrapped by layout.tsx)", "");
    record(!exists("src/app/(marketing)/api") && !exists("src/app/(workspace)/api"), "6: src/app/api/ was not duplicated into either route group", "");
  }

  /* ================================================================ */
  /* 7. Every top-level entry under src/app/ is either a route group    */
  /*    ((marketing) or (workspace)), a route-handler-only tree, a      */
  /*    file Next.js requires at the true root (layout.tsx, not-found   */
  /*    .tsx, globals.css), or a reserved Next.js special file --       */
  /*    never a stray leftover page.tsx from before the restructuring.  */
  /* ================================================================ */
  {
    const entries = readdirSync(path.join(ROOT, "src/app"));
    const allowedTopLevel = new Set([
      "(marketing)", "(workspace)", "api",
      "layout.tsx", "not-found.tsx", "globals.css",
      "robots.txt", "sitemap.xml", ".well-known", "llms.txt",
      "llms-full.txt", "capabilities.json", "question-bank.json",
      "methodology.json", "openapi.json", "indexnow.txt", "favicon.ico",
    ]);
    const unexpected = entries.filter((e) => !allowedTopLevel.has(e));
    record(unexpected.length === 0, "7: no unexpected top-level entries remain directly under src/app/ (no stray pre-move route)", `unexpected=${JSON.stringify(unexpected)}`);
  }

  /* ================================================================ */
  /* 8. The canonical product-entry composition (ENGINE_* copy + the    */
  /*    hero/desk JSX) is defined in exactly one place. Neither         */
  /*    (workspace)/home/page.tsx nor (workspace)/workspace/page.tsx    */
  /*    re-declares ENGINE_H1 -- both must import it from               */
  /*    ProcurementEntry.tsx, so the two routes cannot silently diverge */
  /*    on the actual product surface (Robert: "the homepage is         */
  /*    authoritative... do not maintain two separate implementations").*/
  /* ================================================================ */
  {
    const entry = src("src/components/procurement/ProcurementEntry.tsx");
    record(/export const ENGINE_H1/.test(entry), "8: ProcurementEntry.tsx is the sole declaration site of ENGINE_H1", "");
    const homePage = src("src/app/(workspace)/home/page.tsx");
    const workspacePage = src("src/app/(workspace)/workspace/page.tsx");
    record(!/const ENGINE_H1\s*=/.test(homePage), "8: (workspace)/home/page.tsx does not re-declare ENGINE_H1", "");
    record(!/const ENGINE_H1\s*=/.test(workspacePage), "8: (workspace)/workspace/page.tsx does not re-declare ENGINE_H1", "");
    record(/from ["']@\/components\/procurement\/ProcurementEntry["']/.test(homePage), "8: (workspace)/home/page.tsx imports from ProcurementEntry.tsx", "");
    record(/from ["']@\/components\/procurement\/ProcurementEntry["']/.test(workspacePage), "8: (workspace)/workspace/page.tsx imports from ProcurementEntry.tsx", "");
    record(/<ProcurementEntry(?:\s+guidance=|\s*\/>)/.test(homePage), "8: (workspace)/home/page.tsx renders the shared ProcurementEntry (optional server guidance)", "");
    record(/<ProcurementEntry\s*\/>/.test(workspacePage), "8: (workspace)/workspace/page.tsx renders <ProcurementEntry />", "");
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
