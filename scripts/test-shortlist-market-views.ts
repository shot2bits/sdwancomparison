import assert from "node:assert/strict";
import fs from "node:fs";
import { getShortlistDataset } from "@/lib/vendors";
import {
  buildShortlistMarketView,
  SHORTLIST_VIEW_CONTRACT_VERSION,
  SHORTLIST_VIEW_KEYS,
  SHORTLIST_VIEWS,
} from "@/lib/shortlist-market-views";

const vendors = getShortlistDataset();
assert.equal(vendors.length, 30, "the governed comparison must retain all 30 providers");
assert.equal(SHORTLIST_VIEW_CONTRACT_VERSION, "shortlist-market-view/1.0.0");

for (const view of SHORTLIST_VIEW_KEYS) {
  const first = buildShortlistMarketView(vendors, view);
  const second = buildShortlistMarketView(vendors, view);
  assert.ok(first.length > 0, `${view} must return providers`);
  assert.deepEqual(first.map((provider) => provider.slug), second.map((provider) => provider.slug), `${view} must be deterministic`);
  assert.ok(first.every((provider, index) => provider.rank === index + 1), `${view} ranks must be contiguous`);
}

const sdWan = buildShortlistMarketView(vendors, "sd-wan-vendors");
assert.ok(sdWan.every((provider) => SHORTLIST_VIEWS["sd-wan-vendors"].eligible(vendors.find((item) => item.slug === provider.slug)!)));
const sase = buildShortlistMarketView(vendors, "sase-vendors");
assert.ok(sase.some((provider) => provider.slug === "cato-networks"), "the SASE view must include evidenced SASE platforms");
const managed = buildShortlistMarketView(vendors, "managed-sd-wan");
assert.ok(managed.every((provider) => SHORTLIST_VIEWS["managed-sd-wan"].eligible(vendors.find((item) => item.slug === provider.slug)!)));

const page = fs.readFileSync("src/app/(marketing)/shortlist/page.tsx", "utf8");
const component = fs.readFileSync("src/components/ShortlistBuilder.tsx", "utf8");
const jsonTwin = fs.readFileSync("src/app/(marketing)/shortlist/data.json/route.ts", "utf8");
const csvTwin = fs.readFileSync("src/app/(marketing)/shortlist/data.csv/route.ts", "utf8");
for (const value of ["sd-wan-vendors", "sase-vendors", "managed-sd-wan"]) {
  assert.ok(page.includes(value) || page.includes("SHORTLIST_VIEW_KEYS"), `page must expose ${value}`);
}
assert.match(page, /Comparison summary/);
assert.match(page, /<caption className="sr-only">Comparative overview/);
assert.match(page, /scope="col"/);
assert.match(page, /Provider, product and differentiator/);
assert.match(page, /comparison-chart\.png/);
assert.match(page, /dateModified: verified/);
assert.match(page, /Confirm through RFP/);
assert.match(component, /SHORTLIST_VIEWS\[initialView\]\.eligible/);
assert.match(component, /function encodedScenarioWithView\(\)/);
assert.match(component, /params\.set\("view", initialView\)/);
assert.match(jsonTwin, /market_views/);
assert.match(csvTwin, /parseShortlistMarketView/);
assert.match(page, /`\/shortlist\/\$\{view\}\//);
assert.ok(![page, component].join("\n").includes("—"), "new shortlist interface must not contain em dashes");

console.log(`PASS ${SHORTLIST_VIEW_KEYS.length} governed shortlist views, SSR comparison, decision fields and machine twins`);
