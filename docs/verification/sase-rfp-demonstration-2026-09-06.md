# SASE RFP demonstration

User authorized a public, clearly fictional demonstration before customer projects or supplier participation exist. No test notice, buyer account, quote or email is created.

- New /sase/examples/sase-rfp/ shows a 15-site manufacturing brief, the actual deterministic checker output, explicit illustrative buyer decisions and unresolved items.
- Short example contains eight bank questions; Detailed contains all 43 extended SASE questions. Both include the same bespoke question, original context and response instructions. Documents are curated examples, not falsely described as automatic inference from the initial brief.
- HTML, JSON and public text downloads share a single source. The coverage score is explicitly not proof of technical adequacy or issue readiness.
- Builder links the example; sitemap includes its canonical URL. Build/check actions enter the existing workspace.
- Fixed sector detection choosing a later healthcare reference over the initial manufacturing context. Rules now prefer the first sector mention. This remains heuristic; multiple genuine sectors need buyer review.
- Fixed fresh ?journey=validate_rfp entry to activate check mode in the current layout. Existing saved drafts and explicitly resumed projects retain their existing mode.

Local checks: real checker parity; manufacturing/healthcare ordering regressions; Short/Detailed baseline and question coverage; bespoke preservation; JSON/download equality; invalid format rejection; TypeScript; scoped ESLint; complete npm validate. Desktop/mobile browser checks verify examples, 43-question display, links, no overflow or runtime errors. Existing four project formats, bespoke questions, RFI, supplier pack and sidebar checks pass. Candidate/live receipts follow after deployment.

## Production receipt

Code commit bc32503. Final production deployment https://sasecomparison-ggiryl9fh-netifymarketplace.vercel.app, promoted after candidate checks. Full production validation, compilation and TypeScript passed. Build used the existing reviewed-provider snapshot fallback when its live source was unavailable; the SASE demonstration uses the versioned local question bank.

Initial live tests caught a missing CLI build identifier, corrected by rebuilding the same commit with NETIFY_BUILD_SHA=bc32503 and rechecking before promotion. Final netify.co.uk HTML confirms the correct stamp and discovery link. Both candidate and final live demonstration checks pass at 1440 and 390 pixels, with matching JSON/text downloads, all 43 detailed questions, bespoke preservation, invalid depth rejection and correct checker entry in the current layout. Existing RFP four-route, RFI, bespoke, supplier-pack and sidebar browser checks passed on the same code before the metadata-only rebuild. Existing example, sample RFP, shortlist and circuit pages return 200. The sitemap includes the new canonical page.

Post-deploy error-level log query returned no matching logs in the sampled ten-minute window; this is not evidence of exhaustive runtime coverage. No live project or notification was created. Search indexing and AI citations have not been demonstrated by these deployment checks.

### Final live checks

```text
PASS 1440px: full HTML, both depths, all bank questions, bespoke question, links, no overflow or runtime errors
PASS 390px: full HTML, both depths, all bank questions, bespoke question, links, no overflow or runtime errors
PASS check-existing deep link opens checker within current workspace layout
PASS JSON/download parity, invalid depth rejected, labelled fictional evidence
```

### Feature-preservation checks

```text
PASS 1440px: full HTML, both depths, all bank questions, bespoke question, links, no overflow or runtime errors
PASS 390px: full HTML, both depths, all bank questions, bespoke question, links, no overflow or runtime errors
PASS check-existing deep link opens checker within current workspace layout
PASS JSON/download parity, invalid depth rejected, labelled fictional evidence
PASS 1440px: four routes, initial review, full/short questions, RFI, supplier pack, sidebar tools, no overflow/runtime errors
PASS 390px: four routes, initial review, full/short questions, RFI, supplier pack, sidebar tools, no overflow/runtime errors
```
