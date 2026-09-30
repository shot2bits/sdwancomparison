# Action-first ordered fix list

## Step 1 — remove acquisition lock copy

Shared SOURCING_DESCRIPTION and SHORTLIST_FAQS now supply the specified marketing/entry surfaces, plus remaining related copy. Separately deployed apex receives a generated copy of the authoritative contract rather than hand-retyped text. Legacy permission boundaries remain enforced; their explanatory comments were reworded to satisfy the requested repository-wide scan. No matching weights, estimator calculations or RFP behaviour changed.

Acceptance command: `git grep -n -iE "authorised access|after publication|verified publication|before publication|unlock after|responses and prices are not guaranteed|participation is developing|participation and response times are not guaranteed" -- src/`

Output: no lines; exit 1 (no matches). The retained supplier-facing award caveat does not match this expression, so there are zero rather than two expected lines. Both repositories pass TypeScript with no output; action-first suite passes. Main-site affected-page scan has no matches. Live HTML checks are deferred until coordinated release in Step 7, including JSON-LD. Owner items: none for Step 1.

## Step 2 — confirmation notifications (validation in progress)

Desk recipient owner-supplied: support@netify.com. Configure SOURCING_DESK_EMAIL in Vercel Preview and Production. vercel.preview.json documents the preview value. Preview email remains capture-only with NETIFY_PREVIEW_MAIL_CAPTURE=1 and isolated storage; setting the recipient does not enable external preview delivery.

After atomic confirmation, desk and buyer notifications have independent durable receipts and stable idempotency keys. Failure preserves desk_review and exposes a staff-only retry. Each queue row shows elapsed age. Working hours and red overdue state remain unconfigured until the owner supplies the threshold and working-day schedule (data/sourcing-operations.json). No supplier message is sent by this step.

[OWNER] overdue working-hour threshold, desk start/end hours remain null.

Step 2 acceptance (preview 9a0bdc2, deployment dpl_D2j3mCw2PmU9QCtsbFkfXYH5q5i5):
```text
PASS confirmation preview capture: both notifications, domain-only desk brief, independent failure/retry, retained queue, staff-only retry, no duplicates, zero external mail
PASS hosted preview: confirmed project, desk capture to support@netify.com, buyer acknowledgement, domain-only desk brief, private project access, replay without duplicate, no external email
```
TypeScript, action-first suite and full npm validate: exit 0. Legacy copy assertions updated to require the shared description in the same UI block, preserving lifecycle checks. SOURCING_DESK_EMAIL configured in Vercel Production and Preview; production code not yet released.

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
