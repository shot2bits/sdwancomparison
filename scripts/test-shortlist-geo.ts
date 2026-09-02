import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shortlistExcerpt } from "../src/lib/governed-provider-catalogue";
import { getShortlistDatasetSchema } from "../src/lib/structured-data";

const page = readFileSync("src/app/(marketing)/shortlist/page.tsx", "utf8");
const dataRoute = readFileSync("src/app/(marketing)/shortlist/data.json/route.ts", "utf8");
const csvRoute = readFileSync("src/app/(marketing)/shortlist/data.csv/route.ts", "utf8");
assert.match(dataRoute, /Last-Modified/);
assert.match(csvRoute, /Last-Modified/);
assert.doesNotMatch(dataRoute, /X-Robots-Tag.*noindex/);
assert.doesNotMatch(csvRoute, /X-Robots-Tag.*noindex/);
const content = readFileSync("src/lib/shortlist-content.ts", "utf8");
const interfaceSource = readFileSync("src/components/ShortlistBuilder.tsx", "utf8");
const llms = readFileSync("src/app/llms.txt/route.ts", "utf8");
const consolidatedOpenApi = readFileSync("src/app/openapi.json/route.ts", "utf8");
const perToolOpenApi = readFileSync("src/app/api/openapi/[tool]/route.ts", "utf8");
const shortlistBuilder = readFileSync("src/components/ShortlistBuilder.tsx", "utf8");
const nav = readFileSync("src/lib/nav.ts", "utf8");
const workspaceTools = readFileSync("src/lib/mcp-workspace-tools.ts", "utf8");

assert.match(content, /Compare SD-WAN and SASE providers, vendors and managed services/);
assert.match(page, /2026 market answer/);
assert.match(page, /viewRanking\.slice\(0, 10\)/);
assert.match(page, /Leading \{SHORTLIST_VIEWS\[selectedView\]\.label\.toLowerCase\(\)\} at a glance/);
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
assert.match(page, /https:\/\/netify\.co\.uk\/sase-sd-wan-rfp-builder\//);
assert.doesNotMatch(llms, /https:\/\/netify\.co\.uk\/\?q=/);
assert.match(llms, /endpoint \/sase\/api\/mcp\/, trailing slash required/);
assert.match(llms, /\/openapi\.json/);
assert.match(consolidatedOpenApi, /"\/api\/mcp\/"/);
assert.match(consolidatedOpenApi, /MCP_RFP_TOOL_DEFINITIONS/);
assert.match(consolidatedOpenApi, /WORKSPACE_TOOL_DEFINITIONS/);
assert.match(perToolOpenApi, /`\/api\/openapi\/\$\{def\.name\}\/`/);
assert.match(shortlistBuilder, /`\/sase\/shortlist\/print\/\$\{qs/);
assert.match(shortlistBuilder, /aria-label="Main priority"/);
assert.match(shortlistBuilder, /aria-label="Deployment ceiling"/);
assert.match(shortlistBuilder, /aria-label="Scoring profile"/);
assert.match(shortlistBuilder, /aria-label="Work email"/);
assert.doesNotMatch(nav, /\/resell\/bt-(?:sd-wan|sase)\//);
assert.doesNotMatch(workspaceTools, /https:\/\/netify\.co\.uk\/\?q=/);

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
