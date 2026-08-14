#!/usr/bin/env node
/**
 * Living Procurement OS · Phase 3 Stage A, correction round + closure
 * pass (Robert, 14 Aug 2026).
 *
 * Defect #1 (correction round): "add a UI/integration fixture exercising
 * the real ProjectDesk React update sequence." Every other Stage A
 * fixture (validate-living-procurement-os-stage-a.ts) drives the
 * compiler and the reducer directly, in a hand-rolled `turn()` test
 * harness -- it never mounts the real component, so it cannot see bugs
 * that only exist in ProjectDesk.tsx's own React wiring (effect timing,
 * mount order, debounce windows). This fixture is the reason several
 * such bugs were actually found, not merely inferred:
 *
 *  1. previousProcurementDocumentRef froze on the phantom PRE-EVENT
 *     mount compile, so Prompt A rendered as v2, not v1, in the live UI
 *     (fixed, correction round).
 *  2. Prompt D's "best-of-breed" phrase independently became its own
 *     duplicate Additional-Requirement clause alongside the OpenDecision
 *     naming the same tension (fixed, correction round).
 *  3. (Closure pass, item 1) DLP survived inside the network-
 *     architecture-scope supplier question's own example component list
 *     even once it was correctly absent as a standalone clause -- a
 *     removed capability leaking into a DIFFERENT projection than the
 *     one already checked (fixed: NETWORK_SCOPE_COMPONENTS filtering,
 *     procurement-templates.ts).
 *  4. (Closure pass, item 2) buildArchitecture() only ever created its
 *     "network" hub node from an EXISTING-network fact (estate.
 *     existingNetwork) -- so Prompt A's own recognised TARGET clauses
 *     (SASE/SD-WAN, Azure, Entra ID, Teams Phone, the retained circuit)
 *     rendered as disconnected chips, never the relationship SVG, until
 *     a follow-up MPLS-mentioning prompt (fixed: the node now also
 *     builds from procurement.buying / the network-architecture-scope
 *     clause; the identity/voice nodes were separately taught the
 *     correction round's own lighter templates).
 *  5. (Closure pass, item 3) the Project Memory strip's "0 your words"
 *     read as a false claim that nothing was received from the buyer,
 *     when it actually meant zero COMPILED CLAUSES carry buyer
 *     provenance (Prompt D compiles no clauses at all, by design) while
 *     a real retained buyer sentence sat one line above it (fixed:
 *     relabelled to "0 requirement clauses from your words").
 *
 * Closure pass item 4 (the mobile "dead zone" in
 * 09-mobile-promptA-v1.png) was investigated and is NOT a real user-
 * facing bug: pixel-diffing the delivered screenshot found a genuine
 * ~400px blank run, but reproducing the exact capture (same prompt, same
 * viewport, same natural post-send scroll position) and comparing a
 * `fullPage: true` capture against an ORDINARY (non-resized) viewport
 * capture at the identical scroll position shows the ordinary capture
 * has no gap at all -- Playwright's `fullPage` screenshot resizes the
 * browser to the full document height before capturing, and a
 * `position: sticky` element (the composer dock) can only "stick"
 * within a real, scrolled viewport; mid-resize it renders at a
 * transient position, leaving a gap that a real scrolling user on a
 * real 390px screen never sees (confirmed directly: this file's own
 * "mobile dead zone" section below screenshots BOTH forms so the claim
 * is checkable, not just asserted). The three regression checks Robert
 * asked for either way are implemented, because they check real
 * user-facing geometry regardless of how the dead zone was diagnosed.
 *
 * CLEAN-ROOM RUNNABLE (closure pass item 5): this script manages its own
 * server. If BASE_URL (below) is already reachable, it is reused as-is
 * (so a developer's own already-running `npm run dev` still works, and
 * two copies of the dev server are never started against the same
 * port). Otherwise this script spawns `next dev` itself on a dedicated
 * port, polls until it is ready, runs every check, and shuts the server
 * down again in a `finally` block -- no manual pre-started server, no
 * undocumented step. The only genuinely manual, environment-dependent
 * step is the Playwright BROWSER BINARY itself: `npm install` installs
 * the `playwright` npm package (a normal devDependency, no symlink), but
 * the matching Chromium binary is fetched separately, the standard
 * Playwright way, via:
 *
 *     npx playwright install chromium
 *
 * (`npm run validate:ui:setup` runs the same command.) That fetch needs
 * network access to Playwright's own CDN and is deliberately NOT run
 * automatically by this script or by `npm install` -- Playwright's own
 * convention, and the right one, since re-running it on every install
 * would re-fetch a multi-hundred-MB browser needlessly. A CI wrapper
 * only needs two lines before this script:
 *
 *     npm ci
 *     npx playwright install --with-deps chromium
 *     npm run validate:ui
 *
 * On a machine that already provides a compatible Chromium some other
 * way (for example via PLAYWRIGHT_BROWSERS_PATH pointing at a
 * pre-fetched browser), Playwright finds it automatically and the
 * `install` step is a fast no-op-if-present check, not a hard
 * requirement -- this script itself never assumes one or the other.
 *
 * NOT part of the default `npm run validate`/`npm run build` chain
 * (those must stay a pure, offline `tsx` pipeline runnable in CI with no
 * browser). Run explicitly: `npm run validate:ui`, or as part of a
 * release checkpoint's own manual verification pass.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SCREENSHOT_DIR = join(REPO_ROOT, "reports", "screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const DEFAULT_BASE = "http://localhost:3000/sase";
const FALLBACK_PORT = 3211;
const EXPLICIT_BASE = process.env.STAGE_A_UI_BASE_URL;

const promptA =
  "We are a UK healthcare organisation with 20 sites and 200 remote users. We need managed SASE and SD-WAN, use Azure and Entra ID, retain private Ethernet for a clinical application, support Teams Phone, operate 24/7 and transition by April 2027.";
const promptB = "Change the service to co-managed. Keep 24/7 incident support, remove DLP, and keep the April 2027 deadline.";
const promptC = "All customer data must remain in the UK.";
const promptD = "We want a single supplier but also require independent best-of-breed security controls.";

let passed = 0;
let failed = 0;
function record(cond, label, detail) {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${label}${detail !== undefined ? `  ->  ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${label}${detail !== undefined ? `  ->  ${detail}` : ""}`);
  }
}

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Clean-room server lifecycle (closure pass item 5). Returns
 *  { base, stop() } -- `stop()` is a no-op if this run reused an
 *  already-running server rather than spawning its own. */
async function ensureServer() {
  if (EXPLICIT_BASE) {
    console.log(`Using explicit STAGE_A_UI_BASE_URL=${EXPLICIT_BASE} (assumed already running).`);
    return { base: EXPLICIT_BASE, stop: async () => {} };
  }
  if (await reachable(`${DEFAULT_BASE}/workspace`)) {
    console.log(`Reusing already-running dev server at ${DEFAULT_BASE}.`);
    return { base: DEFAULT_BASE, stop: async () => {} };
  }
  console.log(`No server reachable at ${DEFAULT_BASE} -- starting one on port ${FALLBACK_PORT} for this run.`);
  const child = spawn("npx", ["next", "dev", "-p", String(FALLBACK_PORT)], {
    cwd: REPO_ROOT,
    stdio: "pipe",
    detached: true, // own process group, so stop() can kill next's spawned children too
  });
  let out = "";
  child.stdout?.on("data", (d) => { out += d.toString(); });
  child.stderr?.on("data", (d) => { out += d.toString(); });
  const base = `http://localhost:${FALLBACK_PORT}/sase`;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await reachable(`${base}/workspace`)) {
      console.log(`Self-started dev server ready at ${base}.`);
      return {
        base,
        stop: async () => {
          try {
            if (child.pid) process.kill(-child.pid, "SIGTERM"); // whole group: next dev spawns its own child
          } catch {
            /* already gone */
          }
          await delay(300);
        },
      };
    }
    await delay(500);
  }
  console.error("Server log tail:\n" + out.slice(-4000));
  throw new Error(`Dev server did not become ready within 90s at ${base}`);
}

async function typeAndSend(page, text) {
  const box = page.locator("textarea").first();
  await box.click();
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(1200); // clears the 400ms settle window plus render
}

async function versionOf(page) {
  // innerText reflects the CSS text-transform:uppercase applied to this
  // label ("LIVING PROCUREMENT DOCUMENT · V1"), so the version marker
  // itself must be matched case-insensitively too.
  const text = await page.getByText(/Living procurement document/i).first().innerText();
  const m = /v(\d+)/i.exec(text);
  return m ? Number(m[1]) : null;
}

async function requirementCount(page) {
  const card = page.getByText(/^requirements$/i).first().locator("xpath=..");
  const text = await card.innerText();
  const m = /^(\d+)/.exec(text.trim());
  return m ? Number(m[1]) : null;
}

/** Closure pass item 1: every DOM TEXT NODE (the true leaf unit of
 *  rendered text -- not an element locator, which over-matches by
 *  including every ancestor whose subtree happens to contain the word
 *  too) containing "DLP" must reduce to a SUBSTRING of the buyer's own
 *  original verbatim sentence. Anything else is a leak into some other
 *  generated projection (a supplier question's own example list, a
 *  gate, evidence, architecture, a summary). */
async function dlpTextNodes(page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = [];
    let node;
    while ((node = walker.nextNode())) {
      if (/dlp/i.test(node.nodeValue)) hits.push(node.nodeValue.trim());
    }
    return hits;
  });
}

async function main() {
  const { base: BASE, stop } = await ensureServer();
  let browser;
  try {
    browser = await chromium.launch();

    // ================================================================
    // ONE project: Prompt A -> B -> C, checking V1 -> V2 -> V3
    // ================================================================
    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page1 = await ctx1.newPage();
    await page1.goto(`${BASE}/workspace`, { waitUntil: "networkidle" });

    await typeAndSend(page1, promptA);
    record((await versionOf(page1)) === 1, "UI: Prompt A alone renders the REAL component at v1 (not v2 -- the mount-freeze regression)", `v=${await versionOf(page1)}`);

    // ---- Closure pass item 2: Architecture target-state projection ----
    {
      const svgCount = await page1.locator('svg[role="img"]').count();
      record(svgCount > 0, "UI/closure item 2: Prompt A alone (no follow-up MPLS prompt) renders the real relationship SVG, not the disconnected-chip fallback", `svgCount=${svgCount}`);
      const title = await page1.evaluate(() => document.querySelector('svg[role="img"] title')?.textContent ?? "");
      record(/Proposed .*service/i.test(title), "UI/closure item 2: the network hub node is labelled as the PROPOSED target service (procurement.buying), not left empty", "");
      record(/sites connects network|remote-users connects network/i.test(title), "UI/closure item 2: sites/remote users connect through the proposed service", "");
      record(/network reaches cloud-azure/i.test(title), "UI/closure item 2: the proposed service reaches Azure", "");
      record(/policy decision identity|network.*identity/i.test(title), "UI/closure item 2: Entra ID supplies identity/policy integration", "");
      record(/voice.*network|network.*voice/i.test(title), "UI/closure item 2: Teams Phone (voice) is connected to the delivered network", "");
      record(/legacy-application coexists via retained-circuit/i.test(title), "UI/closure item 2: the clinical application coexists with the retained Ethernet circuit", "");
      record(/retained-circuit migrates onto network/i.test(title), "UI/closure item 2: the retained circuit's own migration path onto the new network is represented", "");
      // The accessible text equivalent must always be present, regardless
      // of which view is rendered -- Robert's own "preserve the
      // accessible text equivalent" instruction for this item.
      const srSummaryCount = await page1.locator("p.sr-only", { hasText: /Architecture:/i }).count();
      record(srSummaryCount > 0, "UI/closure item 2: the accessible text equivalent of the architecture is present alongside the SVG", "");
    }

    await typeAndSend(page1, promptB);
    record((await versionOf(page1)) === 2, "UI: Prompt B renders v2", `v=${await versionOf(page1)}`);
    {
      const bodyText = await page1.locator("body").innerText();
      const dlpAsOwnClause = /Suppliers? must (?:evidence|confirm)[^.]*DLP[^.]*(coverage|policy)/i.test(bodyText) || /DLP coverage/i.test(bodyText);
      record(!dlpAsOwnClause, "UI: no DLP-specific clause/gate exists after Prompt B's negation", `found=${dlpAsOwnClause}`);
      record(/co-managed/i.test(bodyText), "UI: co-managed operating model is shown after Prompt B", "");
      record(/24\/7 incident support/i.test(bodyText), "UI: 24/7 incident support survives Prompt B's edit", "");

      // ---- Closure pass item 1: removal is PROJECTION-WIDE ----
      const hits = await dlpTextNodes(page1);
      const buyerSentenceLower = promptB.toLowerCase();
      const leaks = hits.filter((h) => !buyerSentenceLower.includes(h.toLowerCase()));
      record(
        leaks.length === 0,
        "UI/closure item 1: every DOM text node mentioning DLP reduces to a substring of the buyer's own retained verbatim sentence -- no leak into any other projection (requirements, supplier questions, evidence, gates, scoring, architecture, summaries, change text)",
        `hits=${JSON.stringify(hits)} leaks=${JSON.stringify(leaks)}`,
      );
      record(hits.length > 0, "UI/closure item 1: the buyer's own wording is NOT erased -- the verbatim sentence is still findable in the DOM", `hits.length=${hits.length}`);
    }

    await typeAndSend(page1, promptC);
    record((await versionOf(page1)) === 3, "UI: Prompt C renders v3", `v=${await versionOf(page1)}`);
    {
      const bodyText = await page1.locator("body").innerText();
      record(/remain in the UK/i.test(bodyText) && /Data residency constraint/i.test(bodyText), "UI: Prompt C's UK residency sentence is recognised as its own named clause", "");
      record(!/I did not catch anything new/i.test(bodyText), "UI: the chat narration never claims 'I did not catch anything new' when a real clause/gate/decision was just derived (defect #3)", "");
      record(/Kept in your own words/i.test(bodyText), "UI: the chat narration instead gives the honest 'kept in your own words' line", "");
    }
    await ctx1.close();

    // ================================================================
    // SEPARATE new project: Prompt D alone
    // ================================================================
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page2 = await ctx2.newPage();
    await page2.goto(`${BASE}/workspace`, { waitUntil: "networkidle" });
    await typeAndSend(page2, promptD);
    record((await versionOf(page2)) === 1, "UI: Prompt D in a fresh project renders v1 (a new project never inherits another project's revision count)", `v=${await versionOf(page2)}`);
    {
      const bodyText = await page2.locator("body").innerText();
      record(/single supplier/i.test(bodyText) && /best-of-breed/i.test(bodyText) && /(conflict|opposite directions)/i.test(bodyText), "UI: the single-supplier/best-of-breed conflict is a visible open decision", "");
      const reqCount = await requirementCount(page2);
      record(reqCount === 0, "UI: no duplicate 'best-of-breed' Additional-Requirement clause is created alongside the conflict decision (0 requirements total)", `requirements=${reqCount}`);
      record(!/I did not catch anything new/i.test(bodyText), "UI: Prompt D's narration also never claims 'I did not catch anything new'", "");

      // ---- Closure pass item 3: Project Memory semantics ----
      const memoryText = await page2.evaluate(() => {
        const turnLabel = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && /recorded turn/i.test(e.textContent ?? ""));
        return turnLabel ? turnLabel.parentElement.textContent ?? "" : "";
      });
      record(/1 recorded turn/i.test(memoryText), "UI/closure item 3: the retained buyer turn is counted (1 recorded turn) even though it compiles zero clauses", `memoryText=${JSON.stringify(memoryText)}`);
      record(/\d+ requirement clauses? from your words/i.test(memoryText), "UI/closure item 3: the buyer-provenance metric is precisely labelled ('N requirement clauses from your words'), not a bare 'your words' claim", "");
      // The specific false claim: a BARE "0 your words" (no "requirement
      // clause(s)" qualifier immediately preceding it) would misread as
      // "nothing was received from the buyer" while a verbatim buyer
      // sentence sits one line above in the SAME strip. This must never
      // render un-qualified.
      const bareZeroClaim = /\b0 your words\b/i.test(memoryText);
      record(!bareZeroClaim, "UI/closure item 3: the displayed memory description never claims zero buyer wording while the verbatim conflict sentence is present", `bareZeroClaim=${bareZeroClaim}`);
    }
    await ctx2.close();

    // ================================================================
    // Closure pass item 4: the mobile "dead zone" -- real geometry
    // checks, not a font-size measurement, on a genuine 390px viewport.
    // ================================================================
    {
      const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const pageM = await ctxM.newPage();
      await pageM.goto(`${BASE}/workspace`, { waitUntil: "networkidle" });
      await typeAndSend(pageM, promptA);

      // Ordinary (non-resized) viewport screenshot -- what a real mobile
      // user actually sees at their natural post-send scroll position.
      await pageM.screenshot({ path: join(SCREENSHOT_DIR, "mobile-viewport-ordinary.png") });
      // Full-page screenshot too, per Robert's explicit ask -- kept for
      // completeness, with the header comment above explaining its own
      // sticky-positioning stitching caveat.
      await pageM.screenshot({ path: join(SCREENSHOT_DIR, "mobile-viewport-fullpage.png"), fullPage: true });

      const geometry = await pageM.evaluate(() => {
        const rectOf = (el) => (el ? el.getBoundingClientRect() : null);
        const h1 = document.querySelector("#page-h1");
        const dock = document.querySelector('[data-dock="1"]');
        const textarea = document.querySelector("textarea");
        return {
          h1: rectOf(h1),
          dock: rectOf(dock),
          textarea: rectOf(textarea),
          innerHeight: window.innerHeight,
          scrollY: window.scrollY,
        };
      });

      // 1. Vertical distance between the compact heading and the command
      //    surface (the dock immediately below it) is small -- a real
      //    "dead zone" would show a large gap here; normal flow spacing
      //    is a few tens of px.
      //
      //    This must be measured at scrollY=0, not at whatever position
      //    the page naturally rests at after sending a prompt. Sending a
      //    prompt makes the conversation auto-scroll to reveal the new
      //    reply (ordinary, correct chat behaviour) -- at that resting
      //    position the marketing h1 has scrolled far above the viewport
      //    (bottom deep negative) and the sticky dock is pinned near
      //    top:52, so `dock.top - h1.bottom` measures the distance to an
      //    off-screen element, not any gap a user can actually see. A
      //    first attempt at this assertion used the natural resting
      //    position and reported a ~665px "gap" that does not exist on
      //    screen (confirmed against mobile-viewport-ordinary.png, which
      //    shows the command composer immediately visible with no blank
      //    region). The literal claim under test -- "once a project has
      //    started, the compact heading must be followed immediately by
      //    the command surface" -- is a statement about the top-of-page
      //    layout once compact mode is on, so it is tested there.
      await pageM.evaluate(() => window.scrollTo(0, 0));
      await pageM.waitForTimeout(80);
      await pageM.screenshot({ path: join(SCREENSHOT_DIR, "mobile-viewport-top-scroll.png") });
      const topGeometry = await pageM.evaluate(() => {
        const rectOf = (el) => (el ? el.getBoundingClientRect() : null);
        return {
          h1: rectOf(document.querySelector("#page-h1")),
          dock: rectOf(document.querySelector('[data-dock="1"]')),
        };
      });
      const headingToDockGap = topGeometry.dock && topGeometry.h1 ? topGeometry.dock.top - topGeometry.h1.bottom : null;
      record(
        headingToDockGap !== null && headingToDockGap >= 0 && headingToDockGap < 150,
        "UI/closure item 4: the compact heading is followed immediately by the command surface (gap < 150px, not a large dead zone), measured at the top of the page once compact mode is on",
        `gap=${headingToDockGap}px h1.bottom=${topGeometry.h1?.bottom} dock.top=${topGeometry.dock?.top}`,
      );

      // 2. The command composer is visible within the CURRENT mobile
      //    working viewport (no scrolling needed to find it).
      const textareaVisible =
        geometry.textarea !== null && geometry.textarea.bottom > 0 && geometry.textarea.top < geometry.innerHeight;
      record(textareaVisible, "UI/closure item 4: the command composer is visible within the initial mobile working viewport", `textarea=${JSON.stringify(geometry.textarea)} innerHeight=${geometry.innerHeight}`);

      // 3. No sticky element obscures the conversation or document
      //    heading -- the dock's own bottom edge must not overlap
      //    whatever content immediately follows it in the DOM (checked
      //    via elementFromPoint just below the dock's reported bottom
      //    edge: it must resolve to content, not to the dock itself
      //    covering it).
      const obscured = await pageM.evaluate(() => {
        const dock = document.querySelector('[data-dock="1"]');
        if (!dock) return { checked: false };
        const r = dock.getBoundingClientRect();
        const probeY = Math.min(r.bottom + 4, window.innerHeight - 1);
        const probeX = Math.floor(window.innerWidth / 2);
        const el = document.elementFromPoint(probeX, probeY);
        const isDockOrChild = !!(el && dock.contains(el));
        return { checked: true, isDockOrChild, probeX, probeY, tag: el?.tagName, text: el?.textContent?.slice(0, 60) };
      });
      record(
        obscured.checked && !obscured.isDockOrChild,
        "UI/closure item 4: the sticky composer dock does not obscure the content immediately below it (a probe point just past the dock's own bottom edge resolves to real content, not the dock itself)",
        JSON.stringify(obscured),
      );

      await ctxM.close();
    }
  } finally {
    if (browser) await browser.close();
    await stop();
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    console.error(`\nFAILED (${failed})`);
    process.exit(1);
  }
  console.log("\nALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
