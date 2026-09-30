// @ts-expect-error Node 24 provides registerHooks.
import { registerHooks } from "node:module";
registerHooks({
  resolve(s: string, c: object, n: (s: string, c: object) => { url: string }) {
    return s === "server-only"
      ? { url: "data:text/javascript,export {};", shortCircuit: true }
      : n(s, c);
  },
});
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import fs from "node:fs";
import { withFakeKv, makeRequest } from "./fake-kv-harness";
import {
  annotateResponsePanel,
  publicPanelMember,
} from "../src/lib/response-panel-contract";
import { getShortlistDataset } from "../src/lib/vendors";
import SourcingEntrance from "../src/components/SourcingEntrance";
await withFakeKv(async () => {
  process.env.VERCEL_ENV = "production";
  delete process.env.PROVIDER_MATCH_DATA_URL;
  delete process.env.PROVIDER_MATCH_SERVICE_TOKEN;
  const { getResponsePanel } = await import("../src/lib/response-panel");
  const routes = await import("../src/app/api/sourcing/panel/route");
  const { createSession } = await import("../src/lib/rfp-store");
  const providers = getShortlistDataset();
  const render = async () =>
    renderToStaticMarkup(
      <SourcingEntrance
        vendors={annotateResponsePanel(providers, await getResponsePanel())}
        features={[]}
      />,
    );
  assert.deepEqual(
    JSON.parse(fs.readFileSync("data/response-panel.json", "utf8")),
    [],
  );
  let html = await render();
  assert.equal((html.match(/<span>Research only<\/span>/g) ?? []).length, 30);
  assert.equal((html.match(/<span>Response panel<\/span>/g) ?? []).length, 0);
  console.log(
    "PASS empty panel: 30 Research only cards, 0 Response panel badges",
  );
  const row = {
    slug: "aryaka",
    contact_name: "Synthetic Contact",
    contact_role: "Test role",
    contact_email_domain: "example.org",
    agreed_response_working_days: 5,
    introduction_terms_acknowledged_at: "2026-09-29T09:00:00Z",
    acknowledged_by: "Synthetic acknowledgement",
    source: "private-test-evidence-reference",
  };
  const staff = await createSession({
    role: "netify",
    email: "desk@example.org",
    vendor_slug: null,
  });
  const buyer = await createSession({
    role: "buyer",
    email: "buyer@example.org",
    vendor_slug: null,
  });
  const cookie = `netify_session=${staff.token}`;
  const url = "https://preview.example/sase/api/sourcing/panel/";
  const post = (
    body: unknown,
    c = cookie,
    origin = "https://preview.example",
  ) =>
    routes.POST(
      makeRequest("POST", url, { body, cookie: c, headers: { origin } }),
    );
  assert.equal((await routes.GET(makeRequest("GET", url))).status, 403);
  assert.equal((await post(row, "")).status, 403);
  assert.equal((await post(row, `netify_session=${buyer.token}`)).status, 403);
  assert.equal(
    (await post(row, cookie, "https://attacker.example")).status,
    403,
  );
  for (const field of Object.keys(row)) {
    const incomplete = { ...row };
    delete incomplete[field as keyof typeof incomplete];
    assert.equal((await post(incomplete)).status, 422, field);
  }
  assert.equal(
    (
      await post({
        ...row,
        introduction_terms_acknowledged_at: "2099-01-01T00:00:00Z",
      })
    ).status,
    422,
  );
  assert.equal((await post({ ...row, slug: "invented-provider" })).status, 422);
  assert.equal((await post(row)).status, 200);
  html = await render();
  assert.equal((html.match(/<span>Research only<\/span>/g) ?? []).length, 29);
  assert.equal((html.match(/<span>Response panel<\/span>/g) ?? []).length, 1);
  assert(html.includes("Synthetic Contact"));
  assert(!html.includes(row.source));
  assert(!html.includes(row.acknowledged_by));
  const publicRow = publicPanelMember((await getResponsePanel())[0]);
  assert(!("source" in publicRow));
  assert(!("acknowledged_by" in publicRow));
  console.log(
    "PASS synthetic panel: one badge, named-contact routing, private acknowledgement evidence excluded",
  );
  console.log(
    "PASS panel administration: staff only, origin checks, all fields required, future dates and unknown providers rejected",
  );
});
