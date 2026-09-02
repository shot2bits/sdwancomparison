import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shortlistExcerpt } from "../src/lib/governed-provider-catalogue";
import { getShortlistDatasetSchema } from "../src/lib/structured-data";

const page = readFileSync("src/app/(marketing)/shortlist/page.tsx", "utf8");
const dataRoute = readFileSync("src/app/(marketing)/shortlist/data.json/route.ts", "utf8");
const csvRoute = readFileSync("src/app/(marketing)/shortlist/data.csv/route.ts", "utf8");
const content = readFileSync("src/lib/shortlist-content.ts", "utf8");
const interfaceSource = readFileSync("src/components/ShortlistBuilder.tsx", "utf8");

assert.match(content, /Compare SD-WAN and SASE providers, vendors and managed services/);
assert.match(page, /Top SD-WAN providers at a glance/);
assert.match(page, /defaultRanking\.slice\(0, 10\)/);
assert.match(page, /itemListOrder: "https:\/\/schema\.org\/ItemListOrderDescending"/);
assert.match(page, /position: provider\.rank/);
assert.match(dataRoute, /top_providers_at_balanced_setting: defaultResult\.shortlist\.slice\(0, 10\)/);
assert.match(dataRoute, /shortlist_size: vendors\.length/);
assert.match(dataRoute, /csv: `\$\{SITE_URL\}\/shortlist\/data\.csv`/);
assert.match(csvRoute, /getLiveShortlistDataset/);
assert.match(csvRoute, /GOVERNED_SHORTLIST_CONTRACT_VERSION/);
assert.match(interfaceSource, /\{result\.shortlist\.map\(\(v\) => \(/);
assert.doesNotMatch(interfaceSource, /isDefaultView \? result\.shortlist\.slice\(0, 10\) : result\.shortlist/);
assert.doesNotMatch(interfaceSource, /Show the remaining .* ranked providers/);
assert.match(interfaceSource, /Build from requirements/);
assert.doesNotMatch(interfaceSource, /Build around your requirements/);

const dataset = getShortlistDatasetSchema(30, 40, "2026-09-01") as { keywords: string[]; distribution: Array<{ contentUrl: string }> };
assert.ok(dataset.keywords.includes("SD-WAN providers"));
assert.ok(dataset.keywords.includes("SD-WAN comparison"));
assert.equal(dataset.distribution[0]?.contentUrl, "https://netify.co.uk/sase/shortlist/data.json");

assert.equal(
  shortlistExcerpt("Suitability Matrix: Who Should Buy This", "Juniper Networks offer Mist AI with WAN Assurance."),
  "Juniper Networks offer Mist AI with WAN Assurance.",
);
assert.equal(
  shortlistExcerpt("Revenue was $120. 7 billion. The record was reviewed."),
  "Revenue was $120.7 billion. The record was reviewed.",
);

console.log("shortlist GEO regression tests passed");
