// @ts-expect-error Node 24 test runtime; project types target Node 20.
import { registerHooks } from "node:module";
registerHooks({ resolve(specifier: string, context: object, next: (s: string, c: object) => { url: string }) { return specifier === "server-only" ? { url: "data:text/javascript,export {};", shortCircuit: true } : next(specifier, context); } });
import assert from "node:assert/strict";
import { CAPABILITIES, MCP_ACCESS_GROUPS, capabilitiesDocument } from "../src/lib/capabilities";
import { MCP_TOOL_DEFINITIONS } from "../src/lib/mcp-tool-definitions";
const { MCP_RFP_TOOL_DEFINITIONS } = await import("../src/lib/mcp-rfp-tools");
const { MCP_COST_TOOL_DEFINITIONS } = await import("../src/lib/mcp-cost-tools");
const { SECURITY_TOOL_DEFINITIONS_ALL } = await import("../src/lib/mcp-security-tools");
const { WORKSPACE_TOOL_DEFINITIONS } = await import("../src/lib/mcp-workspace-tools");

const tools = [...MCP_TOOL_DEFINITIONS, ...MCP_RFP_TOOL_DEFINITIONS, ...MCP_COST_TOOL_DEFINITIONS, ...SECURITY_TOOL_DEFINITIONS_ALL, ...WORKSPACE_TOOL_DEFINITIONS];
const actual = new Set<string>(tools.map((tool) => tool.name));
const grouped = MCP_ACCESS_GROUPS.flatMap((group) => [...group.tools]);
assert.equal(new Set(grouped).size, grouped.length, "Each tool has one unambiguous public access group");
assert.deepEqual(new Set(grouped), actual, "Public connector documents every actual tool, without invented or missing names");
for (const capability of CAPABILITIES) {
  for (const name of capability.mcp?.split(/,\s*/) ?? []) assert(actual.has(name), `${capability.id}: unknown tool ${name}`);
}
const accessFor = (tool: string) => MCP_ACCESS_GROUPS.find((group) => (group.tools as readonly string[]).includes(tool))?.access;
assert.equal(accessFor("compare_vendors"), "public");
assert.equal(accessFor("build_sase_shortlist"), "public");
assert.equal(accessFor("get_unlocked_matches"), "verified-buyer");
assert.equal(accessFor("publish_opportunity"), "verified-buyer");
assert.equal(accessFor("publish_rfp"), "browser-handoff");
assert.equal(accessFor("respond_to_rfp"), "unavailable-transport");
const preview = CAPABILITIES.find((entry) => entry.id === "build_shortlist")!;
assert(preview.description.includes("aggregate"));
assert(!/ranked, graded shortlist|No sign-in/.test(preview.description));
const publication = CAPABILITIES.find((entry) => entry.id === "post_opportunity")!;
assert(publication.requiresIdentity && publication.requiresApproval);
assert.equal(publication.accessLevel, "signed-in");
for (const capability of capabilitiesDocument().capabilities) {
  if (capability.page) assert.equal((capability.page.match(/https:\/\//g) ?? []).length, 1, `One absolute origin for ${capability.id}`);
}
console.log(`Public capability truth passed: ${actual.size} real MCP tools, access boundaries and canonical page URLs.`);
