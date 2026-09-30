# 30 September 2026 — reconcile current production into main

This reconciliation preserves the action-first release and main's previously approved Harry remote-user subset fixes. Current Vercel production branch is release/2026-09-30, not main. Historical deployment statements below describe their dates, not today's configuration. Both sets of validation scripts are retained. This merge is repository reconciliation only; do not deploy it to the release branch while Claude is reviewing the production snapshot.

# Netify buying platform handoff

Read this before changing the repository. Use one work branch per assistant and task. Fetch before starting and synchronise before pushing. Merge reviewed work; do not commit directly to a shared integration branch. Do not use CLI production deployments from a working tree.

Repository: shot2bits/sdwancomparison (this is not the BT reseller repository).
Vercel project: sasecomparison, prj_confIOHiitAyJxBa82WsX7ylRldv, team netifymarketplace.
The BT reseller branch codex/bt-reseller-release-1 and its deployment settings do not apply here.

## 10 September 2026: Harry retest fixes

Work branch: codex/harry-retest-fixes-2026-09-10.
Based on origin/codex/publication-first-comparison at 7a8263f, preserving Claude's sector evidence MCP and manufacturing canonical changes. No previous HANDOFF.md existed on that branch.

Changes: distinguish total users from remote users in extraction, storage, labels and supplier document; retain both through corrections and resume; clearer inline bandwidth validation feedback; darker workspace help and status text. Legacy estate.users facts remain readable. Do not infer that historic generic counts are totals or remote counts without their source.

Verification: see docs/verification/harry-retest-2026-09-10.md. No production CLI deployment performed. Do not call this a full 168-case acceptance sign-off.

Vercel Git link verified read-only on 10 September: GitHub shot2bits/sdwancomparison, Production Branch main. Pushes to this work branch are not production releases. Integration into the production branch remains outstanding.

## Preserved release-line handoff history

# Publication benefits and simplified buyer journey, 28 September 2026

User authorised all five walkthrough improvements and live deployment. Work branch codex/publication-benefits-20260928. Lead with requirements, anonymous publication and provider/vendor matching; retain the three entry routes. Put research, Memories, Skills, Connections, circuit pricing and settings in an accessible secondary disclosure; keep project, review/publication and responses prominent. Review now shows structured requirements from supplied fields, optional Short RFP questions through the existing state-preserving bridge, an exact anonymous notice, publication benefits, an explicitly fictional matching example and visible privacy/publication conditions. Existing RFP/import formats are distinguished from a basic brief. Private downloads remain. Email verification uses one panel without the duplicate CTA and explicitly requires final consent/publication after authentication. Sign-in gains an accessible email label and wrapping layout; its auth endpoints and safeguards are unchanged. No added em dashes.

Measurement: added consent-dependent marketplace_builder_viewed at entry. Existing marketplace_brief_started, marketplace_brief_details_reached and marketplace_review_reached remain. Existing server-confirmed verification_requested, verification_completed and publication_completed remain authoritative. Do not equate browser events with leads, or combine consent-dependent visitors and unique-project server stages into an unqualified conversion rate. No private requirement, company or email is added to analytics.

Validation: full validation/production build, sequential TypeScript, focused ESLint and diff checks passed. Journey tests include private-company exclusion, escaped requirement text, accurate brief/RFP labels and fictional sample disclosure. Publication-policy, funnel and isolated successful short-project publication tests passed, including both quick_list/find_providers, eligible/zero-match scenarios and idempotent retry. CUA local browser verified brief -> details -> review, optional Short RFP -> Basic with field preservation, saved-project recovery through the actual auth verification page, consent still required after authentication, duplicate verification CTA absent, mobile390px document390px, matching example expansion and secondary navigation close-on-selection. Fictional .example company correctly failed the live domain check in the isolated environment and was not published. Successful publication was exercised with isolated external-verification/provider fixtures in service tests, not claimed as a live customer publication. Only expected local missing-provider-credentials fallback appeared in development; no production credentials, leads, emails or supplier invitations used. Git release and public verification follow.

# Workspace options live acceptance, 28 September 2026

Production Git commit 419768fd73a2f52580985412f9800e23f29b3435, deployment dpl_72Fur2C1GDLPiQx44SSLBh6GtyTt READY with project-8q2xb.vercel.app assigned. Public builder shows version 2809262039 and build 419768f. Live All tools displays non-interactive Coming soon cards for Cost & TCO and Security assessment, direct marketplace directory, and clarified labels. Resumed the existing saved draft without changing requirement fields; Activity & review and Review my project both opened the Basic brief with the existing solution and regions preserved. No production submission, publication or email was triggered. Browser error log empty and Vercel runtime-error connector reported no errors for its selected one-hour window. The public regression suite passed all 42 checks during deployment. Final sequential TypeScript passed after removing a malformed ignored development-generated validator from .next/dev/types; no source or typecheck configuration was weakened.

# Workspace options audit, 28 September 2026

All Basic review entries now use the existing short-brief review bridge, including Activity & review, the tool card and internal review navigation. Legacy/full RFP review remains unchanged. Tool cards describe actual actions; Provider directory links directly to /marketplace/. Cost & TCO and Security assessment are non-interactive Coming soon cards in the workspace, including expanded research listings, because pricing calibration is outstanding and security currently redirects back to the builder. Existing public tools, URLs, auth and publication rules remain intact. No em dashes in added text.

Local browser checked Basic review through sidebar and card, preserved typed input, Detailed review and return to Basic, Settings, circuit connection form, two-provider comparison, response gate, and assistant sign-in. Circuit and buyer-memory/skill service tests passed after adapting fixtures to the existing storage and outbound-mail isolation policy; no production data or mail used. Marketplace journey and publication policy tests passed. Full validation and production build, TypeScript and focused lint passed. Mobile menu opens/closes and tool cards have no horizontal overflow at 390px. The local provider source intentionally uses the reviewed snapshot because production provider credentials are absent; this is not a production-source failure. All eight active resource destinations returned direct HTTP 200 on the public hostname. Git release and final live verification follow.

# Brief-first builder live acceptance, 28 September 2026

Production source `b6788efce2eba232a38245c21976ec3e97a7cb23`, Git deployment `dpl_7MtDaECg2VK6R93MEoXHr7oWDGty`, READY and assigned to the registered `project-8q2xb.vercel.app` origin. Public canonical builder returns direct HTTP200 with the same canonical and b6788ef source stamp. Live version 2809261731.

Live browser: inline Basic brief and three-stage progress present; detailed expansion absent; blank form cannot continue; no browser console errors. Narrow public viewport reported520px with document width520px; actual390px was tested locally. Browser viewport reset. Existing cached solution selection is preserved; a fresh local origin verifies the blank deliberate-choice default. All42 public regression checks passed at2026-09-28 16:33UTC. Vercel runtime-error connector returned no errors in its selected window, a limited observation rather than a guarantee. No real project, enquiry, verification email or supplier publication was created. Local synthetic review/save/import tests used only isolated memory storage and disabled mail keys. Final local production TypeScript/build and focused lint were clean.

# Brief-first builder, 28 September 2026

Work branch `codex/rfp-brief-first-20260928`, based on production `59350f7` plus the existing verification-only handoff. User authorised making the reviewed simplification live.

Basic requirements now presents the existing short-brief form inline. Keep ProjectDesk mounted so facts, imports, revision binding and recovery remain authoritative. Workspace presentation follows restored purpose and load/recovery state; explicit settings and document actions can reveal the editor. Preserve partial brief fields through the existing confirmation bridge before switching routes. Keep legacy RFP and imported document journeys, owner/consent/verification gates and server publication logic unchanged.

Remove duplicate sidebar format entries; highlight the active top entry. Require a deliberate solution choice on the first form step. Add three-stage progress, focus on newly revealed details/review, actionable missing-field prompts including private company and whole site count, and move expanded private downloads below the working area. Detailed-question targets render only in a built Detailed RFP, never Basic or import mode. No em dashes in added UI copy. Public URLs, metadata, research, MCP and eligibility rules unchanged.

Validation: full validation/build passed; final nonmutating production build, TypeScript, focused ESLint and diff checks passed. Publication-policy tests (13 plus persisted binding tests), conversion/export tests, and extended journey tests passed. Local browser with isolated in-memory storage and mail/model keys empty verified blank-form blocking, basic -> detailed -> basic field preservation, save/review, consent gate, email handoff, server reload, upload with source preservation, device-change recovery and settings access. Mobile 390px width had no document overflow. Final production-build browser saved a second synthetic brief and reached review with no console errors. Local live provider credentials are absent, so development disclosed reviewed-snapshot fallback; not claimed as live provider validation. No live lead, email, supplier contact or project publication was created. Earlier standalone TypeScript overlapped generated build artifacts; the final sequential TypeScript check passed. Git release and live acceptance follow.

# Basic default verified live, 28 September 2026

Production commit 59350f7d4da90afbf4626394abed36d17cb00645, deployment dpl_6XBqMqNXy4cJP9tEne5GsQUeT5sg READY. Public canonical builder with journey=quick_list visibly selects Basic requirements only, version 2809261055; both disclosures remain expanded. No browser console errors observed. Full build and focused lint passed; local Basic -> Import -> Basic selection and saved Detailed RFP restoration checked. Public regression script at 2026-09-28 09:57 UTC: passed 42, failed 0. No live form submission or publication.

# Basic and import format switching, 28 September 2026

Follow-up to the Basic default: selecting an imported RFP changes a brief purpose to RFP, retaining explicit RFI. Returning to Basic exits import mode; only one format is selected. Both workspace entry actions and GuidedBuild callbacks are covered. Focused ESLint, full validation/build and local browser Basic -> Import -> Basic passed. No publication or storage gates changed.

# Basic requirements default, 28 September 2026

Set the fresh ProjectDesk document purpose to brief so Basic requirements is selected for a new project, including journey=quick_list. Keep explicit build/check RFP entry and legacy RFP resume as RFP; persisted local/server document-purpose restoration is unchanged. No publication gates changed and no copy added. Focused ESLint and full validation/production build passed. Local browser confirms fresh Basic selected and a chosen Detailed RFP with a saved sector still selected after reload and Resume saved project. Public verification follows Git release.

# Expanded sections verified live, 28 September 2026

Production commit 950060ee7f69c195eff181d63e22a4bf4c39b2ef, deployment dpl_FYmuVgMr4jALuqxjc4QUoVJ9bhnm READY. Public browser at canonical RFP builder shows Project format and RFP depth and Save for internal review expanded, version 2809261040. Local browser confirms both can still collapse; empty-draft downloads remain disabled. No browser errors observed. Public regression script: 2026-09-28 09:43 UTC passed 42 failed 0. Display-only change, no added copy or live form submission.

# Expanded project choices, 28 September 2026

User requests Project format and RFP depth and Save for internal review expanded by default. Add the native open attribute to both disclosure elements; visitors can still collapse them. No workflow, persistence, download or publication logic changed. Existing download presentation assertion updated. Focused ESLint, marketplace journey test and full production validation/build passed. Live verification follows Git release.

# Public buyer journey verification, 28 September 2026

Public verification: 28 September 2026, 07:15 UTC. SASE deployment dpl_DYUZmersEX23wpCiAfgGM4goTzVa and apex deployment dpl_WSpj6nnGrtwRb4UVa4YAQ6ufPkzV are READY from the recorded Git commits. Canonical builder, cited guide and shortlist each return direct HTTP 200. Public-domain browser confirms new headline, brief step, live preview, upload entry, Detailed RFP and guide CTA. Browser error log empty. All 30 live shortlist provider records unchanged before/after. Apex regression suite: passed 42, failed 0. No production form or publication submitted.

# Buyer publication journey, 28 September 2026

Branch codex/marketplace-buyer-journey-20260928 starts from verified production 82c5898 (dpl_Dzhx12S6Zds2APuFtCL3QSHBrT61). User authorised the focused publication journey with no em dashes in added copy.

Lead with finding suitable providers. Keep Describe my project primary, existing upload and Detailed RFP secondary. The brief begins with outcome, approximate sites, timing and geography; sector, solution, operating model and private company are shown on continuation. Site and sector requirements still apply before review. Not decided is an explicit timing choice; no answers or eligibility are invented. The existing notice component now previews changes in the form without a duplicate action or private company field. Review labels consistently say Review my opportunity; final authenticated action says Publish my anonymous opportunity. Explain public board visibility, private access controls and the actual admin closure/archive route. No supplier participation or response promises added.

Existing consent, owner, identity, publication, response and matching policies are unchanged. Existing server funnel stages retained; add consent-gated browser marketplace_brief_details_reached with no project text or identity. Existing public citation URLs and research are unchanged.

Verification: full validation and production build passed, followed by final nonmutating production build. TypeScript and focused ESLint passed. Publication-policy (13 checks plus persisted binding cases), RFP conversion, marketplace journey and added default-region/private-preview checks passed. CUA browser on isolated in-memory KV with mail/API keys empty: new short brief, undecided timing, inline preview, private company omission, saved review, consent gate, verification handoff, reload, recovery of unsaved device changes and resave passed. Upload entry and Detailed RFP preserve requirements. At 390px document width 390 and dialog width/scroll width both 352, with no browser errors. Reviewed React state, conditional validation, optional preview action and accessibility. Local provider-source credentials absent; existing reviewed snapshot fallback disclosed, not counted as live provider verification. No real project published, email sent or supplier contacted. Public release verification follows.

# Buyer recovery and publication exceptions — 19 September 2026

Branch codex/buyer-recovery-20260919 starts from live 32cb801. Replace supplier-count/bid promises in the existing one-off nudge with latest retained publication-outcome-aware copy, reply-to-support review, escaped HTML and stronger internal/test exclusions. Do not replay previously sent reminders. No cron was manually invoked.

Admin Needs attention lists external blocked-publication records and published projects with zero supplier connections, with reason, age and explicitly unknown personal follow-up. Retained history is bounded; not a qualified-lead count. Queue has no action buttons and creates no access exceptions. Admin responses are private/no-store. Buyer workspaces remain private.

Shared public notice projection removes only exact generated empty-editor instructions, distinguishes short briefs from full-RFP response mode with question evidence, and uses the notice's response deadline with legacy deadline fallback. Future RFP publication passes its existing response window into the notice. Admin brokering shows that same published deadline. Historical missing deadlines are not invented or silently backfilled. Original buyer wording and stored records are preserved.

Tests exposed a stale buying-funnel fixture (missing persisted project), corrected in fake KV, and an initial telemetry read outside the failure-isolation guard, now protected. Targeted recovery/notice/publication-policy/activity/funnel checks and initial production build passed. Final release verification follows separately. No real email, invitation, publication, database migration or gate relaxation performed.

# Comparison and attribution repair — 19 September 2026

Work continues from verified production 47c6d64 on `codex/lead-measurement-20260919`; stale `main` was inspected but NOT merged. Repair exact capability mappings, remove unrelated proxy evidence, preserve partial/partner grades in composite SASE, and add six dated vendor-documentation corrections with visible scope, expiry and newer-governed-review precedence. Public comparison and MCP claim verification share these corrections. No supplier invitations, policy-gate changes or database imports.

Add the four shortlist landing paths to attribution, canonicalise the tested old builder alias, rename generic browser form submission to `form_submit_attempt`, and tighten qualified-project reporting cutoffs. Apex's matching attribution patch is on `codex/shortlist-attribution-20260919`. No historical analytics relabelled.

Targeted mapping/evidence, attribution/privacy, activity/access, comparison-interface and MCP-boundary tests passed; TypeScript passed; full validation/build passed before the final MCP parity amendment, with a final candidate build pending. Source-feed credentials are absent locally, so existing live-source tests disclose snapshot fallback. No claim of buyer observations or production deployment yet. Live/private reconciliation currently needs an admin sign-in. Keep actual deployment and apex verification as a separate follow-up entry.

# SASE audit fixes — 15 September 2026

Work branch: codex/agentic-audit-fixes-2026-09-15. Base: f785b0c2609ce8b8c9b2f7bc66096b2dc384c2ce, matching the inspected production source metadata. Do not replace this base with stale main.

## Changes

- Public shortlist labels, related FAQ and MCP resource descriptions describe evidence order. URLs, titles and H1s retained.
- Four concise provider summary excerpts replace corporate histories in public list/table outputs. Full governed histories and all grades remain unchanged. Source links are recorded in provider-summary-copy.ts.
- Typed private-session failures return project_authentication_required and a safe sign-in handoff. Missing, expired and invalid sessions use the same response; no existence or credential detail leaks. Conflicts require readback; unknown failures do not encourage blind write retries.
- Discovery regression checks required tools and unique names instead of a brittle exact total.
- Two historical validation assertions were corrected. The canvas assertion expected a legacy requirement to override canonical confirmed facts. Updated that assertion to require the confirmed title to remain; revision/no-op/replay checks are retained. The lifecycle assertion now recognises the existing zero-invitation wording instead of expecting every zero-response publication to await responses.

## Release discipline

Production Git branch was inspected in Vercel and incorrectly tracked main. It was changed to codex/publication-first-comparison and read back after reload. The agreed SASE integration branch is codex/publication-first-comparison. Release must use its fast-forward from this tested work branch with corrected branch tracking; do not use production CLI uploads or promotions. Never rebase/force-push integration. Current production rollback reference: dpl_BSSXHwUcKr2rp4A4VBQCAU4LBFUH.

No customer data changes, publication, supplier messages, grade imports or migrations. Live verification must read through netify.co.uk. Deployment and final verification recorded after release.

## Pre-release verification

Full npm run build (including validation suite) passed. Public evidence ordering, canonical buyer facts and new audit-fix regression tests passed. Read-only MCP discovery passed on isolated local storage; invalid private session returned the safe authentication error. Browser comparison of Cato and Cisco rendered capability rows with no console errors. No live write tools used.
# Measurement changes — 19 September 2026

Work branch `codex/lead-measurement-20260919`, based on verified Git production 220253707ca15f5dd43c60fb98739e20230bc611 (dpl_37XpL4bXQrMANFCywDDHKjWktrjN). Production alias project-8q2xb.vercel.app follows this project; no alias reassignment is required.

Retains the private-route Google Analytics guard. Stops nonproduction commercial tracking; consent-gates first-touch storage; carries the apex coarse landing/source category into consented events without identifiers; renames UI source to interaction_source for GA. Principal RFP creation routes store a sanitised, private 90-day attribution sidecar, never in public projects/snapshots. Admin activity reporting now defaults to the trailing seven days and groups attributed draft/publication activity separately from independently qualified projects. Unsupported/historical attribution stays unknown.

Pre-release: full production build including validation suite passes; activity reporting/access tests pass; new measurement attribution/deduplication/environment checks pass; TypeScript passes. No customer publication, invitation, notification or live synthetic enquiry. No schema migrations or matching-policy changes.

Released through Git integration at 47c6d64c8503575216bd0d14d6012291c2855944, production dpl_62v5UL8d5SUXVyHRQAv83AYMYavP. project-8q2xb.vercel.app points to this Ready Git deployment. netify.co.uk/sase-sd-wan-rfp-builder/ rendered the existing saved-project choice, version 1909261144, footer build 47c6d64; no project resumed or created. Only the Vercel analytics loader was present, no Google loader, no browser console errors. Admin activity-report rejects anonymous requests with 403/private,no-store. Apex live regression suite after both deployments: 36 passed, zero failed at 10:47 UTC. Deployment-filtered runtime error search through 10:49 UTC returned no matching logs (limited observation window).

# UK shortlist buyer guidance — 26 September 2026

Work branch `codex/uk-shortlist-20260926`, based on verified live Git commit `2d8220c171fd8ec0a1a7665c7cc7bbf231fd1148` / deployment `dpl_Z94fCx4w5FW3AJNCWDCU29FnsDg4`. User authorised implementing the agreed UK shortlist priorities, preserving existing sentence structures and content.

The main shortlist now has a UK search title/H1, plain provider-role guidance, three optional buying situations, provider roles/products alongside selections, and a prominent Netify sales telephone link using the existing published number. Existing body paragraphs and all ten original FAQs retained verbatim. Three UK FAQs and shared JSON guidance added. No provider record, grade, evidence order, eligibility rule, publication policy, URL, canonical or redirect changed. Other shortlist views retain their specific titles.

Situations guide questions; they do not filter/certify UK availability. Only the selected label travels with the buyer's existing wording into the project draft and comparison question. Shared comparisons preserve the selection. Existing consent-gated phone and project-start events retained; situation selection emits a bounded event without free text.

Verification: full build and validation passed; final nonmutating rebuild passed after CTA destination restoration; TypeScript and changed-file ESLint passed; shortlist GEO, market-view and provider-comparison/MCP tests passed. Local source-feed credentials are absent so tests used the reviewed snapshot, with the same 30 provider identities as live JSON. Live Neon source fields differ from the local snapshot; verify production records against a pre-release live capture after deployment. The source datasets and transformation code are unchanged in Git. Browser verified two-provider comparison, roles, shared-link restoration, exact buying-context transfer into the local brief, and mobile layout at 390px with no page overflow. No real calls, enquiries, publications, invitations or data imports. Local auth-session requests cannot resolve without KV; no production credentials copied into the checkout. Production verification to follow release through the existing Git integration branch, not CLI upload/promotion.

Released via fast-forward Git push at `5e4388fdd01ddc52cf43613b20173a329094431b`; Vercel production `dpl_87NLV4Ua9MyundzfoibSF5gysPKn` is READY and `project-8q2xb.vercel.app` follows it. Public `https://netify.co.uk/sase/shortlist/` serves build 5e4388f, the UK title, self-canonical and direct HTTP 200. JSON and the canonical RFP builder also return direct 200. Post-release live Neon JSON retains all 30 provider records byte-for-byte versus the pre-release capture and all ten original FAQs; three new FAQs and the UK buying guidance are present. Live browser verified BT/Cisco roles and products, UK situation selection, rendered comparison and no console errors. Runtime-error connector reported no errors in its selected range. No production project draft, publication, enquiry or call was submitted. Evidence captures live in the parent workspace `outputs/uk-shortlist-release-2026-09-26/`.

## Owner-approved desk schedule — 30 September 2026

Owner confirmed Monday–Friday 09:00–17:00 Europe/London and a red overdue warning after eight working hours. Configured `data/sourcing-operations.json`; desk address remains support@netify.com. Weekends are excluded and GMT/BST changes are handled. Bank holidays are not separately excluded. This is an internal queue warning, not a supplier proposal SLA. The proposal-count and delivery-day undertaking remains unset pending supplier commitments.

Validation: action-first suite passed including explicit unconfigured-hours fallback, weekend/DST checks, and exact-eight-hours versus eight-hours-plus-one-minute warning boundary. Nonmutating production build passed. No real buyer request or email was created for this verification.
