// Manual smoke test (not part of npm run validate -- writes a real file to
// disk for visual inspection): proves renderRfpDocx() produces a genuinely
// openable .docx from realistic canonical markdown, exercising every
// construct buildRfpMarkdown() actually emits.
import { writeFileSync } from "node:fs";
import { renderRfpDocx } from "../src/lib/rfp-export-docx";

const sample = `# Manufacturing procurement (20 sites)

Request for Proposal · Generated 2026-08-17 via the Netify RFP Builder

| Field | Value |
| --- | --- |
| Scope | Full SASE (no vendor-approach preference) |
| Delivery model | Co-managed |
| Sector | Manufacturing |
| Sites | 20 |
| Published version | v2, 2026-08-17 |
| Document content hash | abc123def456 |

**Accepted assumptions:**

- Single region: UK
- Standard 14-day response window

## Project background

Manufacturing company, 20 sites across the UK, 50 remote users, replacing an ageing MPLS network with SD-WAN and full SASE.

## Organisation and scale

1. **[MANDATORY]** What is your total site count and regional distribution?
   - Evidence required: Site list with addresses
   - Why this matters: Determines deployment complexity
   - Weighting: 5/5 (required)

2. What operating model do you require?
   - Weighting: 3/5

## Evidence checklist

- [ ] Site list with addresses (1 question)
- [ ] Reference customer list (2 questions)

## Scoring approach

Responses are scored per question (1-5) multiplied by the question weighting.

| Section | Questions | Required | Mandatory (pass/fail) | Weight share |
| --- | --- | --- | --- | --- |
| Organisation and scale | 2 | 1 | 1 | 45% |
| Solution scope | 3 | 2 | 0 | 55% |

## Appendix: provenance and review

- **Human review required.** This document was assembled with AI assistance.
`;

async function main() {
  const buffer = await renderRfpDocx(sample, "Manufacturing procurement (20 sites)");
  writeFileSync("/tmp/sdwan_reliability_gate/reports/manual-export-smoke-test.docx", buffer);
  console.log("wrote", buffer.length, "bytes");
}
main();
