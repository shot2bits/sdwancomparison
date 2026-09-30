# Production release — 30 September 2026

Owner authorised release with “make it live”. Released through established Git production branches.

- Apex source: fc3c545; deployment dpl_2vu9trVXfRdb7Vc5jgwqM15sc579, READY and production target confirmed.
- SASE initial release: 64402e3; deployment dpl_94Y8vi59BRtDg9A19FaAX9wS72MR, READY and production target confirmed.
- SASE final release: de59bcf; deployment dpl_7cFoxtVy9Xap8rV7eVSTurgVYjzY, READY and production target confirmed. Adds accessible captions to capability and Market Record tables.

## Verified on the public domain

- Shortlist, RFP entrance and four sector pages return HTTP 200 with sourcing links.
- Shortlist canonical is the public URL and robots directives permit indexing. Research data and Market Record feeds return HTTP 200 (the latter follows a normal slash redirect).
- New homepage and shortlist headline is present. Implementation-preview banner absent.
- Live sourcing plan returns three evidence matches from Neon with provider-match-records/2.0.0.
- MCP exposes all three sourcing tools; read-only MCP plan matches the web plan exactly.
- Unauthenticated private-project access returns 401; unauthorised desk access returns 403.
- Browser generated a ten-site manufacturing sourcing plan, and healthcare entrance preselects Healthcare. No browser warnings or errors recorded.
- Production targets use existing production storage and email settings. Isolated storage and mail capture remain preview-only.
- No real email, supplier outreach, customer enquiry or project mutation submitted during production checks. Confirmation-to-project, RFP, connectivity, proposal comparison and notification capture were previously verified end to end in isolated hosted preview (see acceptance report 13).

## Regression check correction

The original script expected the replaced homepage headline. Updated that assertion to the approved sourcing headline. The next run found absent table captions; restored captions in application source de59bcf. Action-first tests passed after that correction.

## Limits

Release does not establish an increase in AI recommendations or organic clicks. Supplier commitments and response-panel membership must be recorded by the desk; release approval is not supplier acknowledgement or Harry’s copy approval. Clean acquisition baseline and actual sourcing outcomes remain operational follow-up work.

## Final acceptance

2026-09-30 18:02 UTC  passed 42  failed 0

Final public HTML contains both captions and build de59bcf. Browser reloaded the final build without warnings or errors. Screenshot: production-shortlist-live.png.
