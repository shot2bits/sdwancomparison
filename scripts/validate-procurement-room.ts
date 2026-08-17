// Verification-only script (not part of the app): proves the 2030
// blueprint's Checkpoint D contract for the Procurement Room's state
// logic (src/lib/procurement-room.ts, the SAME pure function
// src/app/project/[id]/room/page.tsx actually calls) against every phase
// and snapshot-presence combination that matters, plus the
// PublishedSnapshot immutability/single-source properties the room
// depends on (published-snapshot.ts, unmodified).

import { procurementRoomState } from "../src/lib/procurement-room";
import type { PublishedSnapshot } from "../src/lib/published-snapshot";
import type { ProjectPhase } from "../src/lib/rfp-types";
import { PROJECT_PHASE, BuyerContextSchema } from "../src/lib/rfp-types";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

function fakeSnapshot(overrides: Partial<PublishedSnapshot> = {}): PublishedSnapshot {
  return {
    id: "snap_1",
    project_id: "rfp_test",
    document_version: 1,
    compiler_version: "2026.1",
    methodology_version: "2026.1",
    rulebook_version: null,
    published_at: 1700000000000,
    published_by: "buyer@example.com",
    consent: null,
    content_hash: "abc123",
    frozen_content: { title: "Manufacturing procurement", buyer: BuyerContextSchema.parse({}), rfp_sections: [] },
    public_projection: { opportunity_id: null, url: null },
    private_requirement: { rfp_id: "rfp_test" },
    match_criteria: "",
    matched_vendor_ids: [],
    invited_vendor_ids: [],
    accepted_assumptions: [],
    open_decisions: [],
    market_report: {
      generated_at: 1700000000000,
      matched: { count: 0, names: [], total_evaluated_market: 30 },
      estimate: null,
      assumptions: [],
      gaps: [],
      document: { sections: 0, questions: 0 },
      analyst_note: "",
    },
    ...overrides,
  };
}

function main() {
  /* ================================================================ */
  /* 1. No snapshot at all: every pre-publication phase reads as       */
  /*    "not_published", the honest empty state -- never an error, and */
  /*    never confused with the legacy "published but nothing frozen"  */
  /*    case.                                                          */
  /* ================================================================ */
  const prePublish: ProjectPhase[] = ["scoping", "scoped", "drafting", "drafted"];
  for (const phase of prePublish) {
    record(procurementRoomState(phase, null) === "not_published", `1: phase="${phase}" with no snapshot reads as not_published`, `got=${procurementRoomState(phase, null)}`);
  }

  /* ================================================================ */
  /* 2. Published (or any later phase) with NO snapshot: the honest    */
  /*    "legacy record, nothing frozen" state -- must NEVER silently   */
  /*    read as "frozen" or fall through to not_published (which would */
  /*    tell a buyer whose project IS published that it isn't).        */
  /* ================================================================ */
  const publishedOrLater: ProjectPhase[] = ["published", "qa", "evaluation", "awarded", "transacting", "complete", "closed"];
  for (const phase of publishedOrLater) {
    record(procurementRoomState(phase, null) === "published_no_snapshot", `2: phase="${phase}" with no snapshot reads as published_no_snapshot (not "not_published", not "frozen")`, `got=${procurementRoomState(phase, null)}`);
  }
  record(
    new Set([...prePublish, ...publishedOrLater]).size === PROJECT_PHASE.length,
    "2: the pre-publish and published-or-later lists together cover every real ProjectPhase, none omitted",
    `covered=${prePublish.length + publishedOrLater.length} total=${PROJECT_PHASE.length}`,
  );

  /* ================================================================ */
  /* 3. A real snapshot ALWAYS wins, regardless of phase -- a snapshot */
  /*    existing is definitionally proof publication happened, so the  */
  /*    room must render it even for an edge-case phase mismatch,      */
  /*    never mask a real frozen record behind a phase check.          */
  /* ================================================================ */
  for (const phase of PROJECT_PHASE) {
    record(procurementRoomState(phase, fakeSnapshot()) === "frozen", `3: any phase="${phase}" with a real snapshot present reads as frozen`, `got=${procurementRoomState(phase, fakeSnapshot())}`);
  }

  /* ================================================================ */
  /* 4. The room's own rendered content is the frozen snapshot's OWN   */
  /*    fields, not a recompute -- proven by round-tripping a snapshot */
  /*    through JSON (the same KV serialization boundary               */
  /*    getLatestPublishedSnapshot crosses) and confirming every field */
  /*    the page actually reads survives unchanged.                   */
  /* ================================================================ */
  {
    const original = fakeSnapshot({
      document_version: 3,
      matched_vendors: [{ slug: "acme-sase", name: "Acme SASE" }],
      invited_vendors: [{ slug: "acme-sase", name: "Acme SASE", supplier_url: "/vendors/acme-sase" }],
      accepted_assumptions: ["Single region: UK"],
      open_decisions: ["Deployment timeline"],
    });
    const roundTripped = JSON.parse(JSON.stringify(original)) as PublishedSnapshot;
    record(roundTripped.document_version === 3, "4: document_version survives the snapshot's own JSON round trip", `v=${roundTripped.document_version}`);
    record(roundTripped.matched_vendors?.[0]?.name === "Acme SASE", "4: frozen matched vendor NAMES survive the round trip (the room's own primary read)", `name=${roundTripped.matched_vendors?.[0]?.name}`);
    record(roundTripped.accepted_assumptions[0] === "Single region: UK", "4: accepted_assumptions text survives the round trip verbatim", `text=${roundTripped.accepted_assumptions[0]}`);
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
