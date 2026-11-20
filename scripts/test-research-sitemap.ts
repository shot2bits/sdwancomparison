import assert from "node:assert/strict";
import { renderUrlset, researchSitemapUrls } from "../src/lib/research-sitemap";
import { RESEARCH } from "../src/lib/workbook-research";
import { COMPARE_PAIRS } from "../src/lib/compare-pages";

const urls = researchSitemapUrls();
const locs = urls.map((u) => u.loc);
assert.equal(new Set(locs).size, locs.length, "no duplicate URLs");
assert.ok(locs.every((l) => l.startsWith("https://netify.co.uk/sase/") && l.endsWith("/")), "canonical sase URLs with trailing slash");
assert.ok(locs.some((l) => l.endsWith("/research/")));
assert.ok(locs.filter((l) => l.includes("/research/providers/")).length > 0);
assert.equal(locs.filter((l) => l.includes("/compare/") && !l.endsWith("/compare/")).length, COMPARE_PAIRS.length);
const xml = renderUrlset(urls);
assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.equal((xml.match(/<url>/g) ?? []).length, urls.length);
assert.ok(RESEARCH.updated_date);
console.log(`research sitemap ok: ${urls.length} urls`);
