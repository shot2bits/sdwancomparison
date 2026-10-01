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
assert.equal(SHORTLIST_VIEW_CONTRACT_VERSION, "shortlist-market-view/2.0.0");

for (const view of SHORTLIST_VIEW_KEYS) {
  const first = buildShortlistMarketView(vendors, view);
  const second = buildShortlistMarketView(vendors, view);
  assert.ok(first.length > 0, `${view} must return providers`);
  assert.deepEqual(first.map((provider) => provider.slug), second.map((provider) => provider.slug), `${view} must be deterministic`);
  assert.deepEqual(first, buildShortlistMarketView([...vendors].reverse(), view), `${view} must ignore import order`);
  assert.deepEqual(first.map(p=>p.position),first.map((_,i)=>i+1));
  assert.ok(first.every(p => !("rank" in p) && !("score" in p)));
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
// The answer-first journey replaced the earlier ShortlistBuilder/table layout.
assert.match(page, /<SourcingEntrance/);
assert.match(page, /<BuyerDecisionGuide/);
assert.match(page, /buildShortlistMarketView\(live.vendors,view\)/);
assert.match(jsonTwin, /market_views/);
assert.match(csvTwin, /parseShortlistMarketView/);
assert.match(page, /`\/shortlist\/\$\{view\}\//);
assert.ok(![page, component].join("\n").includes("—"), "new shortlist interface must not contain em dashes");

const {shortlistViewMetadata}=await import('../src/lib/shortlist-market-views');
const descriptions=new Set();
for(const view of SHORTLIST_VIEW_KEYS){const meta=shortlistViewMetadata(vendors,view);assert.equal(meta.count,buildShortlistMarketView(vendors,view).length);assert(meta.title.includes(`(${meta.count} providers)`));descriptions.add(meta.description);}
assert.equal(descriptions.size,4);
const {bestFor}=await import('../src/lib/shortlist-entity');
for(const v of vendors){const result=bestFor(v);if(result.best_for_fields.signoff)assert(!result.best_for.includes(result.best_for_fields.signoff));}
const {shortlistFaqs}=await import('../src/lib/shortlist-faq');assert(!shortlistFaqs(vendors.map(v=>({...v,uk_delivery:'not_confirmed' as const}))).slice(0,2).some(f=>f.a.includes('(none)')||f.a.includes(': none')));
console.log(`PASS ${SHORTLIST_VIEW_KEYS.length} governed views, actual counts, distinct descriptions, duplicate label removal and honest empty evidence`);
