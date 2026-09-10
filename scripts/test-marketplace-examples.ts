import assert from "node:assert/strict";
import fs from "node:fs";
import { MARKETPLACE_EXAMPLES } from "../src/lib/marketplace-examples";
assert.deepEqual(new Set(Object.values(MARKETPLACE_EXAMPLES).map((example) => example.type)), new Set(["quick_list","sector","rfp","comparison"]));
for (const [slug, example] of Object.entries(MARKETPLACE_EXAMPLES)) { assert.match(slug, /^[a-z0-9-]+$/); assert.ok(example.summary.length > 80); assert.ok(example.limitations.length >= 2); assert.doesNotMatch(JSON.stringify(example), /@|phone|contact name/i); }
const page = fs.readFileSync("src/app/(marketing)/examples/[slug]/page.tsx", "utf8");
const data = fs.readFileSync("src/app/(marketing)/examples/[slug]/data.json/route.ts", "utf8");
assert.match(page, /generateStaticParams/); assert.match(page, /application\/ld\+json/); assert.match(data, /synthetic: true/);
console.log("PASS permanent synthetic examples cover quick-list, sector, RFP and comparison in HTML and JSON");
