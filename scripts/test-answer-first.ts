import { sourcingServiceSchema } from "../src/lib/sourcing-contract";
import { SITE_URL } from "../src/lib/structured-data";
// @ts-expect-error Node 24 provides registerHooks.
import { registerHooks } from "node:module";
registerHooks({
  resolve(s: string, c: object, n: (s: string, c: object) => { url: string }) {
    return s === "server-only"
      ? { url: "data:text/javascript,export {};", shortCircuit: true }
      : n(s, c);
  },
});
import { withFakeKv } from "./fake-kv-harness";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getLiveShortlistDataset } from "../src/lib/live-shortlist";
import {
  bestFor,
  shortlistEntity,
  ukStatus,
} from "../src/lib/shortlist-entity";
import { shortlistFaqs } from "../src/lib/shortlist-faq";
import { shortlistSchema } from "../src/lib/shortlist-schema";
import {
  publicEvidenceProviders,
  publicEvidenceOutput,
} from "../src/lib/public-provider-evidence";
import { SECTOR_KEYS, SECTOR_LABELS } from "../src/lib/shortlist-core";
import {
  SHORTLIST_VIEW_KEYS,
  buildShortlistMarketView,
} from "../src/lib/shortlist-market-views";
async function main() {
  const { GET: feedGet } = await import(
    "../src/app/(marketing)/shortlist/data.json/route"
  );
  const { GET: llmsGet } = await import("../src/app/llms.txt/route");
  const { GET: fullGet } = await import("../src/app/llms-full.txt/route");
  const { vendors: raw } = await getLiveShortlistDataset();
  const vendors = publicEvidenceProviders(raw);
  const entity = shortlistEntity(vendors);
  assert.equal(entity.counts.providers, vendors.length);
  assert.ok(
    entity.uk_sentence.startsWith(
      `${vendors.filter((v) => ["uk_hq", "uk_entity"].includes(v.uk_delivery)).length} `,
    ),
  );
  assert.ok(
    entity.uk_sentence.includes(
      `${vendors.filter((v) => v.uk_delivery === "not_confirmed").length} UK entity statuses`,
    ),
  );
  for (const v of vendors) {
    const b = bestFor(v);
    assert.ok(b.best_for);
    assert.deepEqual(
      b.best_for_fields.sectors_yes,
      SECTOR_KEYS.filter((k) => v.sectors[k] === "yes").map(
        (k) => SECTOR_LABELS[k],
      ),
    );
    assert.deepEqual(
      b.best_for_fields.sectors_partial,
      SECTOR_KEYS.filter((k) => v.sectors[k] === "partial").map(
        (k) => SECTOR_LABELS[k],
      ),
    );
    for (const label of b.best_for_fields.sectors_partial)
      assert.ok(b.best_for.includes(`${label} (partial evidence)`));
  }
  const empty = {
    ...vendors[0],
    sectors: Object.fromEntries(SECTOR_KEYS.map((k) => [k, "not_confirmed"])),
  } as (typeof vendors)[number];
  assert.ok(
    bestFor(empty).best_for.startsWith("Sector evidence not yet reviewed"),
  );
  const expired = {
    ...vendors.find((v) => v.slug === "bt-business")!,
    uk_delivery: "not_confirmed" as const,
  };
  assert.equal(ukStatus(expired).reviewed_at, null);
  assert.deepEqual(ukStatus(expired).source_urls, []);
  const faqs = shortlistFaqs(vendors);
  assert.equal(faqs.length, 15);
  for (const k of SECTOR_KEYS) {
    const f = faqs.find(
      (f) =>
        f.q === `Which providers have sector evidence for ${SECTOR_LABELS[k]}?`,
    )!;
    const yes = vendors.filter((v) => v.sectors[k] === "yes");
    const partial = vendors.filter((v) => v.sectors[k] === "partial");
    assert.ok(f.a.startsWith(`${yes.length} with public evidence:`));
    assert.ok(f.a.includes(`${partial.length} with partial evidence:`));
    for (const v of [...yes, ...partial]) assert.ok(f.a.includes(v.name));
  }
  const graph = shortlistSchema(vendors)["@graph"] as Record<string, any>[];
  // Required Dataset fields must survive the actual page graph, not just a legacy helper.
  for (const subset of [vendors, vendors.slice(0, 2)]) {
    const dataset = (shortlistSchema(subset)["@graph"] as Record<string, any>[])
      .find((item) => item["@type"] === "Dataset")!;
    assert.ok(dataset.description.length >= 50);
    assert.ok(dataset.description.includes(`${subset.length} SD-WAN and SASE providers`));
    assert.ok(dataset.description.includes("40 graded fields"));
    assert.ok(dataset.description.includes("not provider quality"));
    assert.equal(dataset.creator["@type"], "Organization");
    assert.equal(dataset.creator.name, "Netify");
    assert.equal(dataset.creator.url, "https://netify.co.uk/");
  }
  const list = graph.find((g) => g["@type"] === "ItemList")!;
  assert.equal(list.numberOfItems, vendors.length);
  assert.deepEqual(
    list.itemListElement.map((i: any) => i.item.name),
    vendors.map((v) => v.name),
  );
  assert.equal(
    graph.filter((g) => g["@type"] === "Person").length,
    entity.reviewer.name ? 1 : 0,
  );
  assert.deepEqual(
    graph
      .find((g) => g["@type"] === "FAQPage")!
      .mainEntity.map((q: any) => ({ q: q.name, a: q.acceptedAnswer.text })),
    faqs,
  );
  assert.deepEqual(graph.find(g=>g["@type"]==="Service"),sourcingServiceSchema(`${SITE_URL}/shortlist/`));
  const feed = await (
    await feedGet(new Request("http://localhost/sase/shortlist/data.json"))
  ).json();
  assert.equal(feed.last_reviewed,feed.entity.reviewed_at);
  for(const view of Object.values(feed.market_views) as {providers:{best_for:string}[]}[])assert.ok(view.providers.every(v=>v.best_for));
  const llms = await (await llmsGet()).text();
  const full = await (await fullGet()).text();
  assert.equal(llms.split("\n")[0], entity.h1);
  assert.equal(llms.split("\n")[1], feed.entity.count_sentence);
  assert.equal(llms.split("\n")[2], feed.entity.uk_sentence);
  assert.ok(!/\bunknown\b/i.test(full));
  assert.ok(!full.includes("—"));
  for (const v of vendors) {
    assert.equal(
      feed.vendors.find((r: any) => r.slug === v.slug).best_for,
      bestFor(v).best_for,
    );
    assert.ok(full.includes(bestFor(v).best_for));
  }
  for (const view of SHORTLIST_VIEW_KEYS) {
    const subset = buildShortlistMarketView(raw, view);
    assert.equal(shortlistEntity(subset).counts.providers, subset.length);
  }
  const output = JSON.stringify(
    publicEvidenceOutput({ entity, faqs, graph, feed }),
  );
  assert.ok(!output.includes("—"));
  assert.ok(!/"unknown"/.test(output));
  assert.equal(
    readFileSync("src/components/SourcingEntrance.tsx", "utf8").split(
      "/sase/api/sourcing/request/",
    ).length - 1,
    1,
  );
  console.log(
    `PASS answer-first: ${vendors.length} complete provider rows, best-for labels, 15 complete FAQs, schema parity, blank reviewer, expiry-safe UK sources, feed/llms parity, 4 views, no legacy status or em dash`,
  );
}
withFakeKv(main).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
