# Buyer completion repair — 6 November 2026

User authorised implementing the publication repairs and buyer-journey improvements. Work branch: codex/buyer-completion-repair-20261106, based on production 97e0d97. No unrelated untracked files changed.

## Changes

- Owner-only project-session recovery after mailbox verification, allowing a second browser or expired eight-hour session to resume without extending anonymous access. Ordinary account sign-in can reopen an already-owned private draft. Anonymous and wrong-owner recovery remain denied.
- Both email-link and six-digit-code confirmation disclose failed automatic publication; sign-in succeeds separately. Failure messages stop automatic redirection and provide a saved-project destination.
- Two entry intents: prepare requirements or request proposals. Existing brief, imported-document and full-RFP routes remain. Supplier-response intent opens approval; private downloads stay ungated.
- Builder and shortlist lead with comparable proposals. A labelled fictional comparison shows service, pricing, exclusions, installation and support differences without inventing supplier participation or quotes.
- Review keeps the anonymous notice, privacy, consent, verification and final publication together; research and downloads follow. Buyers still explicitly approve publication.
- Published receipt carries reference, durable owner-recoverable link and actual recorded invitation-preparation, handoff and response counts. Buyer confirmation email also has reference and return link.
- Private support queue includes contacted unfinished requests and recorded delivery/publication failures. Known internal/test filtering remains. Anonymous drafts are not turned into contactable leads. No automatic customer or supplier messages added.
- Field-validation events are separate from request failures; request analytics permit only bounded stage/status metadata. Requirements, identities, tokens and private URLs are excluded.

## Verification

New route-handler fixtures use in-memory storage and captured email; all other HTTP requests are blocked. Owner recovery after expiry, second-browser read, anonymous/wrong-owner denial, real email request/verification/claim, and explicit legacy failed-publication outcome tested. UI test covers token-free second-browser restoration, actual published status counts and private identity exclusion. Existing publication pipeline tests verify anonymous listing, supplier invitation preparation, frozen snapshot, receipt counts and idempotent retries for both short-project modes.

Local browser on physically isolated in-memory storage verified intent selection, fresh brief, second-step missing details, saved review, consent and email-verification handoff. Narrow mobile viewport measured document width 390 at viewport 390. No live customer record, verification email, supplier invitation or publication was used in testing. Existing test fixtures were corrected for the current preview wording, not weakened readiness requirements.

Full build, final test results, Git/PR/deployment identity and public-domain acceptance are recorded below after completion. Five intended-buyer usability sessions require actual participants; none are represented as having taken place. No measured conversion uplift is claimed.

## Pre-release result

Full npm run build passed on the final application source, including its validation gates, Next.js compilation, TypeScript and static generation. Buyer completion handler/UI tests, RFP completion/research UI, marketplace journey, account access, buyer/notice recovery and isolated short-project publication/receipt tests passed. Focused ESLint and git diff --check passed; an unused fixture binding reported during lint was removed. The local build disclosed snapshot fallback because production provider credentials are not present. Production evidence settings were not modified.
