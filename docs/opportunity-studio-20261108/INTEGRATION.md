# Opportunity Studio integration — 8 November 2026

Status: implementation and isolated acceptance in progress. Not released to production. No real opportunity, customer email or supplier invitation has been created during these tests.

The original preview now uses the existing canonical ProjectDetails store and expiring, revision-controlled marketplace project session. Requirement text, buyer fields and selected bank questions live in that record. Studio metadata records format, users and timescale in the existing entrance envelope; there is no second project database. Existing detailed ledger projects are kept in their original editor and cannot be overwritten by the simpler form.

Buyer: describe → edit → review public/supplier views → save review and company → verify work email by code on the same screen → final Publish → durable opportunity receipt and supplier requests. Returning verified owners recover the same project across devices. No administrator role is required. Email verification does not auto-publish Studio projects.

Supplier: ordinary supplier email sign-in → existing approved profile check → anonymous published requirement → one request to bid → buyer approve/decline → private conversation/proposal. Decisions and messages persist in Redis under project/vendor keys. Mutations use bounded, ownership-checked locks; message UUIDs prevent duplicate submissions on uncertain retries. No account email or company is released by approval. New Studio projects do not send automatic vendor invitations. Existing non-Studio invitation paths remain unchanged.

Public projections are restricted on the server: generated scope/region/estate-band/timing summaries, without source requirement prose, exact counts, contact details or questions. Public HTML, board/feed and MCP notice reads use that projection. Old bearer-only response routes cannot disclose a Studio requirement. Supplier details are read from the published frozen requirement and require an approved supplier session. The buyer's original free text is intentionally shared only after explicit reviewed consent; automatic redaction of that detailed text is not claimed.

MCP: actual initialize handshake from the UI. A private expiring buyer handoff permits read_studio_project/save_studio_requirement on the same record, with explicit consent, revisions and idempotency. Supplier handoffs are scoped to one project/vendor, hashed at rest, expire in one hour, recheck the supplier claim and can be disconnected. request_to_bid and message_studio_buyer share the browser service and approval gates. Copying the endpoint does not configure an external assistant or grant access; no external assistant is represented as connected automatically.

## Evidence so far

- Actual route tests: RFI/RFP save → preparation → ordinary buyer code verification → publish/replay → public projection → supplier identity → request → approval → private response → MCP.
- Injected board storage failure remains unpublished/locked and a subsequent retry succeeds.
- Wrong/reused verification code, wrong draft credential, wrong owner, unclaimed supplier, another vendor's conversation, malicious origin, mismatched/revoked assistant token and expired project session are refused.
- Browser at localhost:3038 against a dedicated real Redis REST bridge and synthetic provider feed: RFI published, normal buyer and supplier email-code sign-in, supplier request, buyer approval, buyer message and supplier response saved. Emails are captured privately, never externally delivered. Actual MCP initialize succeeds.
- Original model tests, TypeScript, scoped lint, buyer-completion tests and acceptance-fixes tests passed at their recorded checkpoints. Final regression/build/cloud checks remain to be recorded.

The existing provider-preview source assertion expected an older pre-production call signature. Updated it to require the existing merge where current saved buyer facts override translated matching input; no matching production code was changed for that assertion.

Additional acceptance: full `npm run validate` passed after updating the route inventory for the deliberate Studio group and retaining the original detailed workspace. Provider evidence, RFP completion, acceptance fixes, buyer completion and marketplace foundation suites passed. Real Redis tests also prove that a later record edit cannot change the frozen supplier requirement or be republished without fresh review. A signed content hash binds Studio approval to the exact current requirement. The browser recovery test covers an expired project credential, verified-owner recovery, same-project return after email verification and failure displays that do not invent zero requests.

Hosted acceptance uses the existing physically isolated preview database. Branch-only preview mail capture was enabled for `codex/opportunity-studio-20261108`; production settings are unchanged. PR30 targets the verified production release branch. No production merge has occurred.

## Hosted connection finding

The initial consumer preview reached the publish gate but its provider feed returned HTTP404; no notice or supplier access was created. A read-only check of the existing production sourcing-plan endpoint returned HTTP200, runtime_provider_source `neon` and contract `provider-match-records/2.0.0`. A production log count for matching provider-source errors over the available last seven days returned no groups. Neither observation establishes October behaviour or explains historic zero leads.

Preview repair is isolated: producer project `prj_8OQLyuwrhFl9VlDQU6eS55aVjkdF`, branch `codex/studio-provider-bridge-20261108`, commit `41686f3b86cbada2471d2f6ab94c13239b762297`, whose application tree exactly matches verified apex production source `338f5658`. A preview-only service key is bound on that producer branch and the consumer Studio branch. The consumer branch points to that specific provider-feed deployment. Existing protection remains enabled and the consumer retains its already-configured protection credential. No production credential, data or deployment setting has been changed. The producer's original checkout had an existing merge conflict; its worktree/index were not touched.

Publication dependency failures now return a plain-English saved/unpublished outcome and a structured private operational error. Saved projects can reopen through verified-owner recovery after credential expiry. An anonymous browser also retains a non-authoritative recovery copy of its last successful save: explicitly starting a new draft from it does not change or publish the original record. Browser cache never replaces the server as the project authority.
