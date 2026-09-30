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
