// Project Foundation Piece 2 verification (7 Aug 2026). Not part of the app
// bundle, not wired into `npm run validate` (the repo has no test runner;
// this follows the established scripts/verify-*.ts and *.fixtures.ts
// conventions). Run: npx tsx scripts/verify-piece2-engine-data.ts
//
// Two parts:
//   1. Runs the five EXISTING *.fixtures.ts suites end-to-end, as a
//      regression check that narrowing engine_data's schema hasn't broken
//      anything they already cover. None of these currently run from any
//      wired-up script - this is the first time they run together.
//   2. New, focused coverage for Piece 2 itself: schema enforcement on the
//      two newly-typed leaves, the closed write-gate loophole (Finding 6),
//      legacy-Project compatibility, and transport parity across web/MCP
//      for creation, rescope and the newly-extracted regeneration capability.

import { runProjectMachineTests } from "../src/lib/project-machine.fixtures";
import { runCreateProjectTests } from "../src/lib/security/create-project.fixtures";
import { runRescopeTests } from "../src/lib/security/rescope-project.fixtures";
import { runGenerateRfpTests } from "../src/lib/security/generate-rfp.fixtures";
import { runProjectStoryTests } from "../src/lib/project-story.fixtures";

import {
  SecurityRequirementInputSchema,
  SecurityScopeVerdictSchema,
  assessSecurityRequirement,
} from "../src/lib/security/rulebook";
import { buildSecurityProject } from "../src/lib/security/create-project";
import { buildRescopedProject } from "../src/lib/security/rescope-project";
import { buildRegeneratedProject } from "../src/lib/security/regenerate-project";
import { assertEngineArtefactsIntact, ProtectedContentError } from "../src/lib/security/generate-rfp";
import { ProjectDetailsSchema, type ProjectDetails } from "../src/lib/rfp-types";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${label}`);
  } else {
    fail += 1;
    failures.push(label + (detail ? `  (${detail})` : ""));
    console.log(`FAIL  ${label}${detail ? `  -> ${detail}` : ""}`);
  }
}

async function checkAsync(label: string, fn: () => Promise<boolean> | boolean, detail?: string) {
  try {
    check(label, await fn(), detail);
  } catch (e) {
    check(label, false, `threw unexpectedly: ${(e as Error).message}`);
  }
}

function throws(label: string, fn: () => unknown, matchClass?: unknown) {
  try {
    fn();
    check(label, false, "expected a throw, none thrown");
  } catch (e) {
    const okClass = matchClass ? e instanceof (matchClass as new (...a: unknown[]) => Error) : true;
    check(label, okClass, okClass ? undefined : `threw wrong error type: ${(e as Error).constructor.name}`);
  }
}

function doesNotThrow(label: string, fn: () => unknown) {
  try {
    fn();
    check(label, true);
  } catch (e) {
    check(label, false, `unexpected throw: ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Part 1: existing fixture suites (regression check) ===\n");

  const machine = runProjectMachineTests();
  check(`project-machine.fixtures: ${machine.pass}/${machine.pass + machine.fail} passed`, machine.fail === 0, machine.failures.join(" | "));

  const create = await runCreateProjectTests();
  check(`create-project.fixtures: ${create.pass}/${create.pass + create.fail} passed`, create.fail === 0, create.failures.join(" | "));

  const rescope = await runRescopeTests();
  check(`rescope-project.fixtures: ${rescope.pass}/${rescope.pass + rescope.fail} passed`, rescope.fail === 0, rescope.failures.join(" | "));

  const generate = await runGenerateRfpTests();
  check(`generate-rfp.fixtures: ${generate.pass}/${generate.pass + generate.fail} passed`, generate.fail === 0, generate.failures.join(" | "));

  const story = await runProjectStoryTests();
  check(`project-story.fixtures: ${story.pass}/${story.pass + story.fail} passed`, story.fail === 0, story.failures.join(" | "));

  console.log("\n=== Part 2: Piece 2 focused coverage ===\n");

  // A realistic, high-confidence requirement: enough of the four core
  // signals present that assessSecurityRequirement won't refuse on
  // low confidence, so it exercises the real rulebook end to end.
  const REALISTIC_REQUIREMENT = {
    organisation: { sector: "Retail", sizeBand: "medium" as const, regions: ["uk"] },
    estate: {
      users: 220,
      sites: 6,
      devices: { computers: 180, mobiles: 90, servers: 8 },
      existingSecurity: ["Windows Defender"],
      existingNetwork: ["MPLS"],
    },
    drivers: ["compliance", "renewal"] as ("compliance" | "renewal")[],
    constraints: { complianceRequirements: ["iso27001"], inHouseSocCapacity: "business_hours" as const },
  };

  // ---- Schema enforcement ----

  const reqParsed = SecurityRequirementInputSchema.safeParse(REALISTIC_REQUIREMENT);
  check("valid SecurityRequirementInput parses", reqParsed.success);

  const realVerdict = await assessSecurityRequirement(REALISTIC_REQUIREMENT as never);
  const verdictParsed = SecurityScopeVerdictSchema.safeParse(realVerdict);
  check(
    "a REAL verdict produced by assessSecurityRequirement() validates against SecurityScopeVerdictSchema (self-consistency: the rulebook's own output must satisfy the schema built from its own interface)",
    verdictParsed.success,
    verdictParsed.success ? undefined : JSON.stringify((verdictParsed as { error: { issues: unknown } }).error.issues).slice(0, 400),
  );

  const missingAgainstInterest = { ...realVerdict } as Record<string, unknown>;
  delete missingAgainstInterest.againstInterest;
  check("verdict missing required againstInterest fails", !SecurityScopeVerdictSchema.safeParse(missingAgainstInterest).success);

  check(
    "invalid serviceModel enum value fails",
    !SecurityScopeVerdictSchema.safeParse({ ...realVerdict, serviceModel: "self_service" }).success,
  );
  check(
    "invalid pathRecommendation enum value fails",
    !SecurityScopeVerdictSchema.safeParse({ ...realVerdict, pathRecommendation: "diy_path" }).success,
  );
  check(
    "malformed nested capability (bad 'needed' enum) fails",
    !SecurityScopeVerdictSchema.safeParse({
      ...realVerdict,
      capabilities: [{ id: "endpoint", needed: "maybe", reasoning: "x", evidence: [], route: null, firedRules: [] }],
    }).success,
  );
  check(
    "malformed nested estate.specialDevices (bad enum member) fails",
    !SecurityRequirementInputSchema.safeParse({ estate: { specialDevices: ["laptop"] } }).success,
  );
  check(
    "malformed nested estate.devices (wrong type) fails",
    !SecurityRequirementInputSchema.safeParse({ estate: { devices: { computers: "a lot" } } }).success,
  );
  check(
    "unknown top-level key on SecurityRequirementInput fails (.strict())",
    !SecurityRequirementInputSchema.safeParse({ ...REALISTIC_REQUIREMENT, extra_field: true }).success,
  );

  // ---- Legacy Project compatibility ----

  const legacy: ProjectDetails = ProjectDetailsSchema.parse({
    id: "rfp_legacy_test",
    created: Date.now(),
    updated: Date.now(),
    buyer: {},
    share_token: "tok_legacy_test",
  });
  check("a legacy Project (no engine_data) parses via ProjectDetailsSchema", true); // parse() above would have thrown otherwise
  check("engine_data is genuinely absent, not synthesized as an empty object", legacy.engine_data === undefined);
  const reparsed = ProjectDetailsSchema.parse({ ...legacy, title: "Renamed, unrelated edit" });
  check(
    "saving an unrelated field on a legacy Project does not introduce engine_data",
    reparsed.engine_data === undefined && reparsed.title === "Renamed, unrelated edit",
  );

  // ---- The closed write-gate loophole (Finding 6) ----

  const fabricatedEngineData = {
    verdicts: [{ version: 1, verdict: realVerdict, input_digest: "d".repeat(64), created_at: Date.now(), via: "web" as const }],
    requirement: REALISTIC_REQUIREMENT,
    artefacts: [],
  };

  throws(
    "generic update CANNOT attach first-time engine_data to a legacy Project (no engineWrite)",
    () => assertEngineArtefactsIntact(legacy, { ...legacy, engine_data: fabricatedEngineData }, {}),
    ProtectedContentError,
  );
  doesNotThrow(
    "an authorised engine writer (engineWrite: true) CAN attach engine_data to a legacy Project",
    () => assertEngineArtefactsIntact(legacy, { ...legacy, engine_data: fabricatedEngineData }, { engineWrite: true }),
  );
  doesNotThrow(
    "an ordinary edit that leaves engine_data untouched (still absent) is completely unaffected",
    () => assertEngineArtefactsIntact(legacy, { ...legacy, title: "Still just a rename" }, {}),
  );

  // Existing security_sourcing append-only protection must be unchanged.
  const built = await buildSecurityProject({
    requirement: REALISTIC_REQUIREMENT as never,
    via: "web",
    ids: { id: "rfp_engine_test", shareToken: "tok_share_test", manageToken: "tok_manage_test" },
  });
  const engineProject = built.project;
  const shrunk: ProjectDetails = { ...engineProject, engine_data: { ...engineProject.engine_data!, verdicts: [] } };
  throws(
    "an existing security_sourcing Project's verdict record still cannot be shortened (unchanged append-only behaviour)",
    () => assertEngineArtefactsIntact(engineProject, shrunk, {}),
    ProtectedContentError,
  );
  throws(
    "a non-engineWrite caller still cannot APPEND a new verdict to an existing security_sourcing Project",
    () =>
      assertEngineArtefactsIntact(
        engineProject,
        {
          ...engineProject,
          engine_data: {
            ...engineProject.engine_data!,
            verdicts: [...engineProject.engine_data!.verdicts, { version: 2, verdict: realVerdict, input_digest: "e".repeat(64), created_at: Date.now(), via: "web" }],
          },
        },
        {},
      ),
    ProtectedContentError,
  );

  // ---- Transport parity: web and MCP reach the same domain capability ----

  await checkAsync("creation via 'web' produces schema-valid engine_data", async () => {
    const r = await buildSecurityProject({
      requirement: REALISTIC_REQUIREMENT as never,
      via: "web",
      ids: { id: "rfp_parity_web", shareToken: "t1", manageToken: "m1" },
    });
    return SecurityScopeVerdictSchema.safeParse(r.project.engine_data?.verdicts?.[0]?.verdict).success;
  });
  await checkAsync("creation via 'mcp' produces schema-valid engine_data (same buildSecurityProject core as web)", async () => {
    const r = await buildSecurityProject({
      requirement: REALISTIC_REQUIREMENT as never,
      via: "mcp",
      ids: { id: "rfp_parity_mcp", shareToken: "t2", manageToken: "m2" },
    });
    return SecurityScopeVerdictSchema.safeParse(r.project.engine_data?.verdicts?.[0]?.verdict).success;
  });

  const RESCOPE_REQUIREMENT = { ...REALISTIC_REQUIREMENT, estate: { ...REALISTIC_REQUIREMENT.estate, users: 300 } };
  await checkAsync("rescope via 'web' and 'mcp' both go through buildRescopedProject and validate", async () => {
    const rWeb = await buildRescopedProject({ project: engineProject, requirement: RESCOPE_REQUIREMENT as never, via: "web" });
    const rMcp = await buildRescopedProject({ project: engineProject, requirement: RESCOPE_REQUIREMENT as never, via: "mcp" });
    const latestWeb = rWeb.project.engine_data?.verdicts?.slice(-1)[0]?.verdict;
    const latestMcp = rMcp.project.engine_data?.verdicts?.slice(-1)[0]?.verdict;
    return SecurityScopeVerdictSchema.safeParse(latestWeb).success && SecurityScopeVerdictSchema.safeParse(latestMcp).success;
  });

  // ---- The newly-extracted regeneration capability ----

  check("buildRegeneratedProject (web) produces a new artefact version with unchanged verdict", (() => {
    const before = engineProject.engine_data!.artefacts.length;
    const r = buildRegeneratedProject({ project: engineProject, via: "web" });
    return r.version === before + 1 && r.verdict === engineProject.engine_data!.verdicts.slice(-1)[0].verdict;
  })());
  check("buildRegeneratedProject (mcp) - same capability, same result shape as web (transport parity)", (() => {
    const rWeb = buildRegeneratedProject({ project: engineProject, via: "web" });
    const rMcp = buildRegeneratedProject({ project: engineProject, via: "mcp" });
    return rWeb.version === rMcp.version && JSON.stringify(rWeb.project.rfp_sections) === JSON.stringify(rMcp.project.rfp_sections);
  })());
  throws(
    "buildRegeneratedProject refuses on a non-security_sourcing project",
    () => buildRegeneratedProject({ project: legacy, via: "mcp" }),
  );

  console.log(`\n${pass}/${pass + fail} passed.`);
  if (fail > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Verification script crashed:", e);
  process.exit(1);
});
