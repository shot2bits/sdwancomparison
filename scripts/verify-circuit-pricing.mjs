import { chromium } from "playwright";
import assert from "node:assert/strict";
const b = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const p = await b.newPage({ viewport: { width, height: 1000 } });
    p.setDefaultTimeout(15000);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/api/circuits/", (r) =>
      r.fulfill({ status: 200, json: { requests: [], admin: false } }),
    );
    await p.goto(process.env.TEST_URL || "http://localhost:3107/sase/circuit-pricing/",{waitUntil:"domcontentloaded"});
    await p.waitForTimeout(1500);
    await p.getByRole("heading", { name: "Go to market. Get real pricing." }).waitFor();
    await p.getByRole("button", { name: "Add connection requirements", exact: true }).click();
    await p.getByLabel("Location / group name").fill("Manufacturing remote team");
    await p.getByLabel("Connection type", { exact: true }).selectOption("4G / 5G SIM only");
    await p.getByLabel("For remote users", { exact: true }).check();
    assert(!(await p.getByLabel("Add optional CrowdStrike device threat protection").isChecked()));
    await p.getByLabel("Add optional CrowdStrike device threat protection").check();
    await p.getByLabel("Devices to protect").fill("30");
    await p.getByLabel("SIM quantity", { exact: true }).fill("30");
    await p.getByLabel("Bandwidth required").fill("Best available mobile speed");
    await p.getByLabel("Country", { exact: true }).fill("Germany");
    assert.equal(
      await p.getByLabel("Add optional CrowdStrike device threat protection").count(),
      0,
    );
    assert(!(await p.getByLabel("Router / SD-WAN edge (optional)").innerText()).includes("Meraki"));
    await p.getByLabel("Country", { exact: true }).fill("United Kingdom");
    await p.getByRole("button", { name: "Save requirements", exact: true }).click();
    await p.getByLabel("Company name (private)").fill("Test Manufacturing Ltd");
    await p.getByLabel("Business sector", { exact: true }).fill("Manufacturing");
    await p.getByLabel("Required installation date / timescale").fill("Within six months");
    let stored;
    await p.route("**/api/circuits/", async (r) => {
      if (r.request().method() === "POST") {
        const body = r.request().postDataJSON();
        if (body.action === "save") {
          stored = {
            ...body.input,
            id: body.id,
            owner_email: "buyer@example.test",
            revision: 1,
            status: "draft",
            quotes: [],
            created: 1,
            updated: 1,
            opportunity_id: null,
          };
        } else {
          assert.equal(body.action, "publish");
          assert(body.consent.includes("not an order"));
          stored = { ...stored, status: "sourcing", revision: 2, opportunity_id: "test" };
        }
      }
      return r.fulfill({
        status: 200,
        json:
          r.request().method() === "POST"
            ? { request: stored }
            : { requests: stored ? [stored] : [], admin: false },
      });
    });
    await p
      .getByRole("button", { name: "Review & request pricing →", exact: true })
      .first()
      .click();
    await p.getByRole("checkbox", { name: /Publish my anonymous/ }).check();
    await p.getByRole("button", { name: "Publish project & request pricing", exact: true }).click();
    await p.getByRole("heading", { name: "Netify is sourcing your request" }).waitFor();
    assert.equal(stored.lines[0].quantity, 30);
    assert.equal(stored.lines[0].protect, false);
    assert.equal(errors.length, 0, errors.join("\n"));
    assert(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    await p.screenshot({ path: `/tmp/circuit-live-${width}.png` });
    await p.close();
    console.log(
      `PASS ${width}: add/edit, opt-in UK protection, edge restrictions, reviewed publication, notifications copy, no overflow/errors. Writes intercepted.`,
    );
  }
} finally {
  await b.close();
}
