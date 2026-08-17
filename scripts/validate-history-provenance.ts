// Verification-only script (not part of the app): proves the 2030
// blueprint's Checkpoint C contract -- visible provenance for agent/MCP
// actions -- against the REAL, unmodified ProjectHistoryEventSchema
// (rfp-types.ts) and historyProvenance() (history-provenance.ts).

import { ProjectHistoryEventSchema, type ProjectHistoryEvent } from "../src/lib/rfp-types";
import { historyProvenance } from "../src/lib/history-provenance";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

function event(overrides: Partial<ProjectHistoryEvent>): ProjectHistoryEvent {
  return ProjectHistoryEventSchema.parse({
    at: 1700000000000,
    actor: "assistant",
    via: "web",
    event: "project.updated",
    ...overrides,
  });
}

function main() {
  /* ================================================================ */
  /* 1. An MCP-originated event earns the MCP receipt marker.          */
  /* ================================================================ */
  {
    const e = event({ via: "mcp", actor: "assistant", detail: { tool: "rescope_project", fields_changed: 2 } });
    const p = historyProvenance(e);
    record(p.isMcp === true, "1: via=mcp reads as an MCP receipt", `isMcp=${p.isMcp}`);
    record(p.detailFieldCount === 2, "1: the receipt's detail field count reflects the real recorded detail, not a guess", `count=${p.detailFieldCount}`);
  }

  /* ================================================================ */
  /* 2. A human-triggered assistant suggestion, accepted through the   */
  /*    web UI, must NOT read as an MCP receipt -- `actor ===          */
  /*    "assistant"` alone is not the signal; only `via === "mcp"` is. */
  /*    This is the specific confusion the blueprint's "no unreceipted */
  /*    agent/MCP actions" rule implies the inverse of: no FALSE       */
  /*    receipts either.                                               */
  /* ================================================================ */
  {
    const e = event({ via: "web", actor: "assistant" });
    const p = historyProvenance(e);
    record(p.isMcp === false, "2: actor=assistant + via=web does NOT read as an MCP receipt (via is the signal, not actor)", `isMcp=${p.isMcp}`);
  }

  /* ================================================================ */
  /* 3. Every other real `via` value (admin, cron, system) also does   */
  /*    not falsely read as MCP -- only the literal "mcp" value does.  */
  /* ================================================================ */
  for (const via of ["web", "admin", "cron", "system"] as const) {
    const p = historyProvenance(event({ via }));
    record(p.isMcp === false, `3: via="${via}" does not read as an MCP receipt`, `isMcp=${p.isMcp}`);
  }

  /* ================================================================ */
  /* 4. Consent is surfaced only when genuinely recorded true -- an    */
  /*    absent or false consent field must not render the "Consent     */
  /*    recorded" badge (a false positive would misrepresent a real    */
  /*    governance record).                                            */
  /* ================================================================ */
  record(historyProvenance(event({ consent: true })).hasConsent === true, "4: consent=true reads as recorded", "");
  record(historyProvenance(event({ consent: false })).hasConsent === false, "4: consent=false does not read as recorded", "");
  record(historyProvenance(event({})).hasConsent === false, "4: an absent consent field does not read as recorded", "");

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
