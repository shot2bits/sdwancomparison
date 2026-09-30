# Action-first ordered fix list

## Step 1 — remove acquisition lock copy

Shared SOURCING_DESCRIPTION and SHORTLIST_FAQS now supply the specified marketing/entry surfaces, plus remaining related copy. Separately deployed apex receives a generated copy of the authoritative contract rather than hand-retyped text. Legacy permission boundaries remain enforced; their explanatory comments were reworded to satisfy the requested repository-wide scan. No matching weights, estimator calculations or RFP behaviour changed.

Acceptance command: `git grep -n -iE "authorised access|after publication|verified publication|before publication|unlock after|responses and prices are not guaranteed|participation is developing|participation and response times are not guaranteed" -- src/`

Output: no lines; exit 1 (no matches). The retained supplier-facing award caveat does not match this expression, so there are zero rather than two expected lines. Both repositories pass TypeScript with no output; action-first suite passes. Main-site affected-page scan has no matches. Live HTML checks are deferred until coordinated release in Step 7, including JSON-LD. Owner items: none for Step 1.

## Step 2 — confirmation notifications (accepted)

Desk recipient owner-supplied: support@netify.com. Configure SOURCING_DESK_EMAIL in Vercel Preview and Production. vercel.preview.json documents the preview value. Preview email remains capture-only with NETIFY_PREVIEW_MAIL_CAPTURE=1 and isolated storage; setting the recipient does not enable external preview delivery.

After atomic confirmation, desk and buyer notifications have independent durable receipts and stable idempotency keys. Failure preserves desk_review and exposes a staff-only retry. Each queue row shows elapsed age. Working hours and red overdue state remain unconfigured until the owner supplies the threshold and working-day schedule (data/sourcing-operations.json). No supplier message is sent by this step.

[OWNER] overdue working-hour threshold, desk start/end hours remain null.

Step 2 acceptance (preview 9a0bdc2, deployment dpl_D2j3mCw2PmU9QCtsbFkfXYH5q5i5):
```text
PASS confirmation preview capture: both notifications, domain-only desk brief, independent failure/retry, retained queue, staff-only retry, no duplicates, zero external mail
PASS hosted preview: confirmed project, desk capture to support@netify.com, buyer acknowledgement, domain-only desk brief, private project access, replay without duplicate, no external email
```
TypeScript, action-first suite and full npm validate: exit 0. Legacy copy assertions updated to require the shared description in the same UI block, preserving lifecycle checks. SOURCING_DESK_EMAIL configured in Vercel Production and Preview; production code subsequently released in Step 7.

## Step 3 — one undertaking setting

SOURCING_TARGET drives page step 3, Service JSON-LD, llms, MCP request description and buyer acknowledgement. Invalid or incomplete settings retain the existing response-target wording. Both values remain null.
```text
PASS sourcing target unset: page step 3, Service JSON-LD, llms and MCP agree
PASS sourcing target set: page step 3, Service JSON-LD, llms and MCP agree
PASS partial or invalid targets stay unpromised; buyer acknowledgement uses the same contract
```
[OWNER] proposals and working_days remain null.

## Step 4 — response-panel records

Empty committed response-panel.json plus isolated/private store; all fields required in the staff-only admin form. Public cards/feed carry only contact identity, role/domain, response time and terms date. Source references and acknowledged_by remain private. Named-contact routing is included in the desk notification; supplier outreach remains a separately reviewed human action.
```text
PASS empty panel: 30 Research only cards, 0 Response panel badges
PASS synthetic panel: one badge, named-contact routing, private acknowledgement evidence excluded
PASS panel administration: staff only, origin checks, all fields required, future dates and unknown providers rejected
PASS hosted panel: empty 30/0; synthetic 29/1; named contact in card, feed and captured desk action; private evidence excluded; queue age and both notification receipts present
PASS preview cleanup: test membership removed; committed panel remains empty; no external mail
```
Hosted preview 8a9cef3, dpl_FwMBAqJgEXiycBXbguVQmjHPFtgy. TypeScript and action-first suite exit 0. [OWNER] all actual panel memberships/contacts/commitments remain absent.

## Step 5 — four evidenced UK carrier records

Primary-source corporate/entity records and SD-WAN delivery sources now support the four UK classifications. Comparison IDs are bt-business, virgin-media-o2, vodafone-business and colt-technology-services (the requested Colt and Virgin names use different actual IDs). Source URLs and qualifications are embedded in UK_CARRIER_REVIEWS. UK/Ireland yes is explicitly qualified as UK evidence, not every Irish/UK address. Colt's group entity and UK trading company are distinguished.

Exposed the existing uk_provider_only filter on the sourcing brief and passed it through the web/MCP shared plan and stored project criteria; no matching weights or estimator/RFP algorithms changed.
```text
PASS UK-only filter: bt-business, colt-technology-services, virgin-media-o2, vodafone-business; four sourced reviews; other UK grades remain not_confirmed; capability/sector grades unchanged
```
TypeScript and action-first suite exit 0. Live audit and four-provider filter acceptance deferred to coordinated Step 7 deployment. [OWNER] none.

## Step 6 — owner sign-off sheet and visible status

Generated docs/sector-adjudications-signoff-2026-09-30.md: 36 positive rows plus a clearly separated five-row unconfirmed appendix. Added blank signed_off_by/at to all 19 records without changing any sector value. Public provider cards/feed use explicit pending/signed labels. Corrected Colt's governed-to-comparison slug join so its already-reviewed evidence and sign-off state reach the actual card.
```text
PASS sign-off: 19 provider records, 36 positive rows (27 yes/9 partial), 5 unconfirmed rows preserved; all values unchanged; pending and signed labels verified; Colt slug mapped
```
TypeScript and action-first suite exit 0. [OWNER] all 19 sign-offs remain empty.

## Step 7 — release branch and reconciliation PR

Created release/2026-09-30 from c28fe0b. Vercel SASE Production → Branch Tracking updated and API readback confirms release/2026-09-30. Existing domains/production storage retained. No further pushes to codex/publication-first-comparison. Draft PR: https://github.com/shot2bits/sdwancomparison/pull/8 (75 release-line commits at creation). Main has three independent commits absent from this production line; PR conflicts are in docs/HANDOFF.md and package.json. They are not silently resolved by replacing main or importing unreviewed RFP changes. PR merge is not part of this production deployment.

Final preview c28fe0b READY; public UK review audit has four sourced records; live Neon prepare_sourcing_plan returns all four with uk_provider_only true. TypeScript, action-first suite and full validation passed, and prior hosted confirmation/panel acceptance remains recorded above. Production deployment and apex verification follow below.

Production SASE cec4800: dpl_AcAFbxeBhX8Dxdeoiibkw66KGFw3 READY, githubCommitRef release/2026-09-30. Apex 1100f9d: dpl_5YAmJX5nN6yUBRsoDkZHk7f8oJQo READY.
```text
PASS live HTML including JSON-LD: four requested URLs HTTP 200; zero prohibited copy matches
PASS live UK-only plan: authenticated Neon source; all four carriers returned
PASS live feed: 30 researched providers; zero panel memberships; 19 sector sign-offs pending
PASS browser: four UK evidence matches; no console warnings or errors
2026-09-30 20:14 UTC  passed 42  failed 0
```
No synthetic live confirmations or supplier messages. Owner blanks unchanged.

## Step 8 — indexing and baseline (external work outstanding)

Fixed actual 2026-09-30 lastmod dates added on the SASE and apex target sitemaps. Live acceptance found the /best/ hub lacked lastmod; corrected before sign-off (a2e65e1). IndexNow used the already-published apex root ownership file because the SASE key route returned 404. HTTP 200 accepted all 58 target URLs. Search Console requests are being recorded separately in docs/ai-overview-baseline.md; clean Google baseline blocked by CAPTCHA pending user confirmation. Earlier positive readings are owner-reported, not independently verified. Four weekly reading slots recorded; no automation installed.
```text
IndexNow: 200 URLs: 58 body: ''
PASS baseline document: exact eight prompts, blocked observations, reported claims separated, four weekly slots, 58-URL HTTP 200 receipt
2026-09-30 20:21 UTC  passed 42  failed 0
```
Step 8 is not declared complete while clean observations and remaining Google requests are outstanding. Owner: CAPTCHA confirmation requested. Continue the independent Step 9 copy correction.

## Step 9 — consistent pre-sales contacts wording

Selected pre-sales contacts. Existing action button labels now shared unchanged between UI and confirmation/acknowledgement mail. Service schema/feed/llms inherit sourcing description; MCP request description uses the same term. Supplier panel asks for a named contact, preserving its one-contact schema. Apex homepage/generated contract aligned. No matching, estimator, RFP or permission logic changed.
```text
PASS wording: pre-sales contacts; action button labels unchanged; shared Service schema consistent
```
Case-insensitive source scan has only the contacts form. Action-first regression and TypeScript exit 0. Owner: Harry editorial approval remains separate; no rewrite or invented undertaking. Production verification follows.

## Step 10 — not approved

No side-by-side layout change made.

Final Step 9 deployment: SASE c56a2a7 READY dpl_8KfqXjBhgwYrPzLRwPwnXCrjSWVx; apex d097f64 READY dpl_AAbMGg3SuJFdgP6ouRz9SDzWxfvk.
```text
PASS live sitemaps: all 58 target URLs present with fixed 2026-09-30 lastmod
PASS live contacts wording: /
PASS live contacts wording: /sase/shortlist/
PASS live contacts wording: /sase/shortlist/data.json
PASS live contacts wording: /sase/llms.txt
PASS live MCP descriptions: pre-sales contacts
2026-09-30 20:26 UTC  passed 42  failed 0
```
Public browser displayed released heading/description and preserved actions; warning/error log empty. No live customer, project confirmation or supplier email sent for verification.

Final Step 8 external status:
```text
PASS IndexNow receipt: HTTP 200, 58 URLs
PASS live sitemap dates: 58/58 target URLs
PASS Search Console sitemap submission: SASE and apex
PASS individual Google indexing receipts: 11 URLs
BLOCKED remaining individual Google requests: 47 URLs; Quota Exceeded
BLOCKED clean eight-prompt baseline: CAPTCHA confirmation pending; native Mac locked
```
The remaining URL queue and actual receipts are saved in search-console-submissions-2026-09-30.json. No indexing, AI recommendation or click uplift is claimed from submission receipts. Owner blanks: overdue working-hour threshold/start/end; proposal count/working-day undertaking; supplier panel commitments; 19 sector sign-offs; Harry editorial approval. Step 10 remains unapproved and unchanged.

## Baseline resumed after owner unlock

At 20:38–20:41 UTC the native Incognito browser exposed signed-out UK Google results for all eight queries. Clean Google AI Overview panel now complete; raw answer excerpts and first sentences saved. Broad terms: 3/6 visible Netify citations, 0/6 named next-step recommendations. Two action prompts: 2/2 named routes; one opens with Netify. First action answer makes false supplier-response claims, explicitly flagged. AI Mode/Copilot not re-tested; no causal attribution to release and no click uplift claim. Google individual indexing quota still blocks 47 URLs.
```text
PASS clean Google panel: 8/8 answers; Sign in and United Kingdom visible on every result
PASS evidence separation: citations, named recommendations and inaccurate claims recorded separately
```
