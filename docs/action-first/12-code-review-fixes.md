# Code review and bug fixes — 30 September 2026

## Fixed

1. High priority: written proposals were not bound to a requirement version. Recording now requires the current content hash; a stale staff screen receives HTTP 409. The receipt retains that hash. Changes to buyer requirements, RFP sections, engine inputs, facts or the procurement document exclude previous-scope proposals and their automated reviews from the current comparison. Earlier and legacy unbound proposals remain accessible in a labelled section. Comparable-set recording applies the same filter. Activity timestamps alone do not change the content hash.
2. Medium priority: staff could switch requests while an earlier history request was loading. A selection version now prevents the previous request's response from overwriting the active request's history or scope. Proposal entry is disabled until the selected scope has loaded.
3. Medium priority: whitespace-only charging basis passed validation. The API now trims and rejects it before recording a proposal.
4. Medium priority: written evidence URLs were persisted but absent from the buyer comparison. Links now appear, with HTTPS validation and safe new-tab attributes. Malformed and executable URLs are excluded.
5. Small copy correction: cookie settings now refer to the actual Cookie preferences control.

## Verification

Full npm validation suite passed. Action-first route tests passed, including stale scope rejection, whitespace rejection, earlier-scope exclusion, private owner access, recipient approval, retries, archives and missing prices. Evidence-link rendering test passed, including executable URL rejection. Focused lint and Next production build passed.

Browser walkthrough used a loopback-only synthetic database with email and model keys disabled. Reopened a confirmed request, opened the private RFP, navigated written proposals and connectivity, inspected the evidence link, changed the synthetic estate from 10 to 11 sites, and refreshed the comparison. The prior proposal moved into the earlier-scope section; its evidence remained available. Connectivity still exposed the archived revision under the same project.

No real customer records were changed. No supplier requests or email were sent. Production remains frozen. This review verifies implementation behaviour; it does not establish supplier commitments or AI recommendation uplift.
