# SASE RFP demonstration

User authorized a public, clearly fictional demonstration before customer projects or supplier participation exist. No test notice, buyer account, quote or email is created.

- New /sase/examples/sase-rfp/ shows a 15-site manufacturing brief, the actual deterministic checker output, explicit illustrative buyer decisions and unresolved items.
- Short example contains eight bank questions; Detailed contains all 43 extended SASE questions. Both include the same bespoke question, original context and response instructions. Documents are curated examples, not falsely described as automatic inference from the initial brief.
- HTML, JSON and public text downloads share a single source. The coverage score is explicitly not proof of technical adequacy or issue readiness.
- Builder links the example; sitemap includes its canonical URL. Build/check actions enter the existing workspace.
- Fixed sector detection choosing a later healthcare reference over the initial manufacturing context. Rules now prefer the first sector mention. This remains heuristic; multiple genuine sectors need buyer review.
- Fixed fresh ?journey=validate_rfp entry to activate check mode in the current layout. Existing saved drafts and explicitly resumed projects retain their existing mode.

Local checks: real checker parity; manufacturing/healthcare ordering regressions; Short/Detailed baseline and question coverage; bespoke preservation; JSON/download equality; invalid format rejection; TypeScript; scoped ESLint; complete npm validate. Desktop/mobile browser checks verify examples, 43-question display, links, no overflow or runtime errors. Existing four project formats, bespoke questions, RFI, supplier pack and sidebar checks pass. Candidate/live receipts follow after deployment.
