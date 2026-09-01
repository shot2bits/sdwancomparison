import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyComparisonHandoff, COMPARISON_HANDOFF_VERSION, parseComparisonHandoff } from "../src/lib/comparison-handoff";
import { FEATURES, getShortlistDataset } from "../src/lib/vendors";
import { buildComparison } from "../src/lib/shortlist-core";
import { callMcpTool } from "../src/lib/mcp-tools";

const vendors = getShortlistDataset();
assert.equal(vendors.length, 30, "the public comparison catalogue must retain all 30 providers");
const slugs = vendors.map((vendor) => vendor.slug);
for (const slug of ["barracuda-secureedge", "expereo", "opensystems", "virgin-media-o2"]) assert.ok(slugs.includes(slug), `${slug} must come from the governed catalogue`);
for (const slug of ["fatpipe", "hughes", "peplink", "telefonica"]) assert.ok(!slugs.includes(slug), `${slug} must not remain in the governed catalogue`);
assert.ok(vendors.every((vendor) => vendor.marketplace_url?.startsWith("https://netify.co.uk/marketplace/")), "every provider must link to its canonical marketplace profile");
const parsed = parseComparisonHandoff("compare=bt-business,vodafone-business&question=Which+fits%3F&source=marketplace-bt", slugs);
assert.deepEqual(parsed.providers, ["bt-business", "vodafone-business"]);
assert.equal(parsed.question, "Which fits?");
assert.deepEqual(parseComparisonHandoff("compare=bt-business,forged", slugs).providers, ["bt-business"]);

const url = applyComparisonHandoff(new URLSearchParams("s=healthcare"), parsed);
assert.equal(url.get("comparison_contract"), COMPARISON_HANDOFF_VERSION);
assert.equal(url.get("s"), "healthcare", "comparison handoff must preserve shortlist criteria");

const comparison = buildComparison(vendors, parsed.providers, FEATURES);
assert.ok(comparison);
assert.deepEqual(comparison.slugs, parsed.providers);
assert.equal(comparison.groups.length > 5, true);
const mcpComparison = callMcpTool("compare_vendors", { slugs: parsed.providers, question: parsed.question }) as { slugs: string[]; resume_url: string };
assert.deepEqual(mcpComparison.slugs, parsed.providers);
assert.match(mcpComparison.resume_url, /source=mcp/);
const governedOnlyProfile = callMcpTool("get_sase_vendor_profile", { slug: "expereo" }) as { slug: string; governed_profile?: { evidenceSourceCount: number } };
assert.equal(governedOnlyProfile.slug, "expereo");
assert.ok((governedOnlyProfile.governed_profile?.evidenceSourceCount ?? 0) > 0, "MCP must expose the governed profile for a newly governed provider");

const agent = readFileSync("src/app/api/agent/route.ts", "utf8");
const mcp = readFileSync("src/lib/mcp-tools.ts", "utf8");
const interfaceSource = readFileSync("src/components/ShortlistBuilder.tsx", "utf8");
assert.match(agent, /comparison_slugs/);
assert.match(agent, /buildComparison/);
assert.match(mcp, /compare_vendors/);
assert.match(interfaceSource, /Compare every feature across your selected providers/);
assert.doesNotMatch(interfaceSource, /Inspect every evidence row/);
assert.ok(
  interfaceSource.indexOf("Compare every feature across your selected providers") < interfaceSource.indexOf("Ask about the comparison"),
  "the full comparison action must appear before the optional AI question",
);
console.log("provider comparison interface tests passed");
