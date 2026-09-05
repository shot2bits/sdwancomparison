# Buyer assistant: first production release

## Scope

The canonical buying workspace gains Memories and Skills, using its existing logo/navigation. The engine stays mounted during assistant/research navigation, retaining RFP state and bespoke questions. Public provider comparison remains available without signing in.

Memories are stored against the authenticated buyer's existing KV record. Each new fact has an ID, source, confirmation time and optional expiry; buyers can add, edit and forget facts. Existing preferences and outcomes remain intact. Account domain is never treated as permission to share company data.

Three skills reuse `callWorkspaceTool('workspace_cycle')`: review requirements, compare buying options, and prepare a project. Delivery comparisons reuse `DELIVERY_MODEL_COMPARISON`. Model extraction uses the existing deterministic fallback. The buyer explicitly selects confirmed, unexpired facts; no automatic memory overlay modifies project requirements. Results remain temporary proposals; input changes, memory edits and stale revisions invalidate them.

The reviewed handoff appends exact selected requirements to the existing short-brief dialog. It does not overwrite the full RFP, save a second server project, publish, contact suppliers or unlock matches. Existing company, identity verification, project storage, privacy review, publication and consent services remain authoritative. Published/resumed full-engine projects reject the short-brief handoff. A full RFP remains optional.

## Implementation boundaries

- `src/lib/buyer-memory.ts`: existing record schema extended with default revision/facts; all writers use atomic compare-and-set, with legacy fields preserved. Corrupt records fail closed.
- `src/lib/buyer-assistant.ts`: validated actions, owned facts and read-only skill execution. Rechecks memory revision/expiry after extraction.
- `src/app/api/buyer/assistant/route.ts`: cookie-authenticated buyer/netify roles only; identity never accepted from the request body. Strict JSON actions, bounded input, write-origin checks, private/no-store responses and sanitised failures.
- `BuyerAssistant.tsx`: lazy-loaded UI. Existing `SignIn` verifies the business email. Checks current memory again immediately before brief handoff. In-flight guard and applied state prevent duplicate clicks.
- `JourneyModeSelector.tsx`: explicit handoff into existing brief; no project mutation until existing save/review action. Consent/prepared state resets after changes; 4,000-character outcome cap retained.
- `agent-store.ts`: lock release now atomically compares owner and deletes; an expired owner cannot delete a successor's lock.

No new cron jobs, background routines, company sharing, third-party integrations or private external MCP tools are enabled. External delegated identity remains a separate implementation; existing public MCP tools remain available.

## Feature switch and recovery

`NETIFY_BUYER_ASSISTANT_ENABLED=false` disables the new APIs and hides both navigation entries. UI is server-rendered: deploy again when changing the switch. Enabled by default for this approved release. No table creation or destructive migration is required; old records parse with revision 0 and empty facts.

To disable this release, retain the new compatible memory readers/writers and deploy with the switch disabled. Do not roll back blindly to a pre-release binary after new memories have been saved: its strict schema does not understand the added fields and could treat records as missing. A rollback build must retain the memory compatibility changes. Project records and published snapshots have not changed schema.

## Verification

- `scripts/test-buyer-memory.ts`: isolated fake KV; actual service/API tests for concurrent edits, stale versions, ownership, legacy records, corrupt records, lock ownership, strict actions, confirmation/expiry, forgetting, disabled flag and real read-only requirement extraction/comparison.
- `scripts/test-buyer-assistant-ui.mjs`: desktop/mobile browser tests with isolated API fixtures; persistence, selection, skills, reviewed handoff, draft retention, stale results, forgetting and overflow. Never uses production email or publication.
- Existing regression runner now includes memory tests, plus existing marketplace/publication/security/disclosure/feature checks.
- Existing browser suites exercise bespoke questions, supplier pack, draft save failures, comparison and publication gates.

Authenticated production writes and real opportunity publication are deliberately not performed with invented buyer identities. Production smoke checks verify the live interface and unauthenticated access denial; isolated tests cover authenticated writes and publication paths.

## Released and checked — 5 September 2026

Application commit: `d8b628b`. Production deployment: `dpl_Fj9U59qXHxV5kgxBWn2bJtpPQWrt` (`https://sasecomparison-deuy7sarl-netifymarketplace.vercel.app`), promoted to the existing Netify production alias.

All 48 regression groups passed; final changed-account tests, TypeScript and targeted lint passed afterwards. Local and hosted production builds passed. Desktop/mobile assistant tests and existing shell/brief tests passed against the live canonical URL. Authenticated assistant UI tests use isolated API fixtures; real storage/auth tests run against isolated fake KV, including actual requirement extraction. Live unauthenticated API returns 401 with `private, no-store`; live provider data reports Neon and 30 providers. Builder, shortlist and board return 200. The deployment error-log query returned no entries.

The live page is `https://netify.co.uk/sase-sd-wan-rfp-builder/`. Sign in, then open Memories or Skills in the sidebar. No real buyer emails, supplier invitations or opportunity-board test publications were sent.
