#!/usr/bin/env node
/**
 * Row-8 hotfix (16 Aug 2026) -- reproduction harness.
 *
 * Reproduces the three pre-publication supplier-identity/matching
 * disclosure paths the R0 reconciliation found in RfpBuilder.tsx and its
 * supporting routes, against a faithful local runtime of this exact
 * repository commit (not a mock: the real Next.js route handlers, the real
 * rfp-store/rfp-connect/project-machine logic, only the Upstash-compatible
 * KV backend swapped for the in-memory fake-kv-server.mjs, exactly as
 * Engagement A's fixture already established for this sandbox).
 *
 * This intentionally does NOT touch https://netify.co.uk/ directly for the
 * write-side checks (inviting/connecting a supplier): doing that against
 * real production would either require bypassing magic-link sign-in (not
 * attempted) or would risk creating a real, addressable SupplierConnection
 * against a real vendor slug in the live dataset -- i.e. reproducing the
 * defect against production would itself cause the exact harm the hotfix
 * exists to prevent. The read-side check (share-token project read) is
 * safe to reason about identically in this local clone because the route
 * logic is unchanged from what runs in production at this SHA.
 *
 * Run once against the pre-fix tree and once against the post-fix tree
 * (see checkpoint report for the exact git-stash sequence used) to get
 * paired before/after evidence.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startFakeKv } from "./lib/fake-kv-server.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "reports", "row8-repro");
mkdirSync(OUT_DIR, { recursive: true });

const LABEL = process.env.REPRO_LABEL || "run";
const PORT = Number(process.env.REPRO_PORT || 3212);
const BASE = `http://localhost:${PORT}/sase`;

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitReady(deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (await reachable(`${BASE}/workspace`)) return true;
    await delay(500);
  }
  return false;
}

const evidence = { label: LABEL, at_repro_time: null, checks: [] };
function record(name, detail) {
  evidence.checks.push({ name, ...detail });
  console.log(`[${LABEL}] ${name}:`, JSON.stringify(detail));
}

async function main() {
  console.log(`Starting fake KV backend...`);
  const kv = await startFakeKv();

  console.log(`Starting next dev on port ${PORT} against KV ${kv.url} ...`);
  const child = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: REPO_ROOT,
    stdio: "pipe",
    detached: true,
    env: { ...process.env, KV_REST_API_URL: kv.url, KV_REST_API_TOKEN: kv.token },
  });
  let serverLog = "";
  child.stdout?.on("data", (d) => { serverLog += d.toString(); });
  child.stderr?.on("data", (d) => { serverLog += d.toString(); });

  const stop = async () => {
    try { if (child.pid) process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
    await delay(300);
    await kv.stop();
  };

  try {
    const ready = await waitReady(90_000);
    if (!ready) {
      console.error("Server log tail:\n" + serverLog.slice(-4000));
      throw new Error(`Dev server did not become ready within 90s at ${BASE}`);
    }

    // --- Create a draft RFP, exactly as the real wizard/desk does -------
    const createRes = await fetch(`${BASE}/api/rfp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Row-8 repro: UK manufacturer SASE RFP",
        buyer: { sector: "manufacturing", organisation_size: "201-1000", operating_model: "hybrid", regions: ["uk"] },
      }),
    });
    const project = await createRes.json();
    record("create_draft", { status: createRes.status, id: project.id, project_status: project.status, has_share_token: !!project.share_token, has_manage_token: !!project.manage_token });
    if (!project.id) throw new Error("Draft creation failed, cannot continue reproduction.");

    // --- Access-mode separation (step 7): anonymous, no token/manage key
    // at all. Must be refused regardless of publish state -- possession of
    // the bare id alone (which appears in URLs, logs, referrers) must never
    // be sufficient, published or not.
    const anonPreRes = await fetch(`${BASE}/api/rfp/${project.id}`);
    record("anonymous_read_pre_publish", { status: anonPreRes.status });

    // --- Disclosure path 1: share-token project read, pre-publish -------
    const shareReadRes = await fetch(`${BASE}/api/rfp/${project.id}?token=${project.share_token}`);
    const shareReadBody = await shareReadRes.json().catch(() => ({}));
    record("share_token_read_pre_publish", {
      status: shareReadRes.status,
      leaked_rfp_sections: Array.isArray(shareReadBody.rfp_sections) ? shareReadBody.rfp_sections.length : null,
      leaked_buyer_sector: shareReadBody.buyer?.sector ?? null,
      response_error: shareReadBody.error ?? null,
    });

    // --- Disclosure path 2: connect/invite persistence, pre-publish -----
    const connectRes = await fetch(`${BASE}/api/rfp/${project.id}/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vendor_slug: "cato-networks", intro: "Row-8 repro invite", manage_token: project.manage_token }),
    });
    const connectBody = await connectRes.json().catch(() => ({}));
    record("connect_invite_pre_publish", {
      status: connectRes.status,
      persisted_connection: !!connectBody.vendor_slug,
      response: connectBody,
    });

    // Verify persistence independently via the owner-only GET (proves the
    // POST above actually wrote a SupplierConnection, not just returned a
    // synthetic 200).
    const listConnRes = await fetch(`${BASE}/api/rfp/${project.id}/connect`, {
      headers: { "x-manage-token": project.manage_token },
    });
    const listConnBody = await listConnRes.json().catch(() => ({}));
    record("connect_list_after_pre_publish_attempt", {
      status: listConnRes.status,
      connection_count: Array.isArray(listConnBody.connections) ? listConnBody.connections.length : null,
    });

    // --- Disclosure path 3 (UI): the vendor panel on the actual page ----
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
      await page.goto(`${BASE}/rfp-builder/${project.id}?manage=${project.manage_token}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const suppliersSection = page.locator("#suppliers");
      await suppliersSection.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const shotPath = join(OUT_DIR, `${LABEL}-vendor-panel-pre-publish.png`);
      await page.screenshot({ path: shotPath, fullPage: false, clip: await suppliersSection.boundingBox().then((b) => b ?? undefined).catch(() => undefined) });
      const suggestButtonVisible = await page.locator("#suppliers button:has-text('Suggest best-fit vendors')").isVisible().catch(() => false);
      const bodyText = await suppliersSection.innerText().catch(() => "");
      record("ui_vendor_panel_pre_publish", {
        screenshot: shotPath,
        suggest_button_visible: suggestButtonVisible,
        panel_text_snippet: bodyText.slice(0, 400),
      });
    } finally {
      await browser.close();
    }

    // --- Step 6 (post-publish availability): flip the project straight to
    // "published" via the KV backend directly, bypassing the full
    // publish orchestration (magic-link sign-in, vendor ranking, board
    // listing) entirely -- that pipeline is pre-existing, unrelated
    // machinery this hotfix does not touch. This isolates exactly the
    // boundary condition the hotfix DOES own: once a project has crossed
    // into a post-publish status, do the same three gated code paths
    // correctly reveal the intended content again? Equivalent to unit-
    // testing hasPublished()'s true branch against the same three real
    // route handlers already exercised above.
    const rawGet = await fetch(`${kv.url}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(["GET", `rfp:${project.id}`]),
    }).then((r) => r.json());
    const storedProject = JSON.parse(rawGet.result);
    storedProject.status = "published";
    await fetch(`${kv.url}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(["SET", `rfp:${project.id}`, JSON.stringify(storedProject)]),
    });

    const anonPostRes = await fetch(`${BASE}/api/rfp/${project.id}`);
    record("anonymous_read_post_publish", { status: anonPostRes.status });

    const shareReadPostRes = await fetch(`${BASE}/api/rfp/${project.id}?token=${project.share_token}`);
    const shareReadPostBody = await shareReadPostRes.json().catch(() => ({}));
    record("share_token_read_post_publish", {
      status: shareReadPostRes.status,
      rfp_sections_visible: Array.isArray(shareReadPostBody.rfp_sections) ? shareReadPostBody.rfp_sections.length : null,
    });

    const connectPostRes = await fetch(`${BASE}/api/rfp/${project.id}/connect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vendor_slug: "fortinet", intro: "Row-8 repro invite (post-publish)", manage_token: project.manage_token }),
    });
    const connectPostBody = await connectPostRes.json().catch(() => ({}));
    record("connect_invite_post_publish", {
      status: connectPostRes.status,
      persisted_connection: !!connectPostBody.vendor_slug,
    });

    const browser2 = await chromium.launch();
    try {
      const page2 = await browser2.newPage({ viewport: { width: 1280, height: 1600 } });
      await page2.goto(`${BASE}/rfp-builder/${project.id}?manage=${project.manage_token}`, { waitUntil: "networkidle" });
      await page2.waitForTimeout(1500);
      const suppliersSection2 = page2.locator("#suppliers");
      await suppliersSection2.scrollIntoViewIfNeeded().catch(() => {});
      await page2.waitForTimeout(300);
      const shotPath2 = join(OUT_DIR, `${LABEL}-vendor-panel-post-publish.png`);
      await page2.screenshot({ path: shotPath2, fullPage: false, clip: await suppliersSection2.boundingBox().then((b) => b ?? undefined).catch(() => undefined) });
      const suggestButtonVisible2 = await page2.locator("#suppliers button:has-text('Suggest best-fit vendors')").isVisible().catch(() => false);
      const bodyText2 = await suppliersSection2.innerText().catch(() => "");
      record("ui_vendor_panel_post_publish", {
        screenshot: shotPath2,
        suggest_button_visible: suggestButtonVisible2,
        panel_text_snippet: bodyText2.slice(0, 400),
      });
    } finally {
      await browser2.close();
    }

    const outFile = join(OUT_DIR, `${LABEL}-evidence.json`);
    writeFileSync(outFile, JSON.stringify(evidence, null, 2));
    console.log(`\nEvidence written to ${outFile}`);
  } finally {
    await stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
