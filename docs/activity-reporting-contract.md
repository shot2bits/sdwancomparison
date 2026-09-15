# Reliable activity reporting — implementation and release notes

Status: local patch; not deployed. No production records changed and no supplier/customer messages sent.

## Before → after

| Before | Local implementation |
|---|---|
| Missing test flags could be interpreted as buyers | New records receive server-owned environment, random non-sensitive correlation ID, source and classification with reason/actor/time; absent classification stays unknown |
| Classification corrections had no durable history | Authorised append-only audit with expected-version conflict protection and independent intent evidence references; original project and published revisions untouched |
| Preview and production shared Upstash bindings | All inspected runtime Upstash consumers use a binding selector. Outside production the shared hosted binding is refused; a distinct hosted origin plus dedicated credentials, or local fixture storage, is required |
| Event/counter keys could mix environments | Durable event deduplication includes application, environment, record, event and transition; reseller counters and webhook deduplication include environment; legacy counters remain explicitly unlabelled |
| Clicks and email acceptance could suggest success | Primary persisted records drive outcomes. Invitation creation, delivery and linked response are separate. Event journal failures do not fabricate primary outcomes |
| Invitation/publication joins relied on reconstruction | New connections retain the already-committed publication and opportunity IDs and creation environment; first delivery time is preserved |
| Missing joins could look like zero | SASE reports expose unresolved opportunity/invitation/response joins and incomplete invitation coverage. Missing coverage suppresses the percentage |
| Portal contact/status rows had no proven application join | Read-only reviewed mapping contract; no name matching or status dual-write |

## Access and operation

SASE: authenticated Netify admin GET/PATCH `/sase/api/admin/activity-report/` (route is under the SASE base path). BT: existing internal Bearer credential GET/PATCH `/api/internal/activity-report/`; no token in a query string. Responses are private/no-store. GET accepts ISO `start`, `end`, `as_of`; defaults are the requested week and current as-of time. PATCH requires record/project ID, expected audit version, a reason, and optional classification/intent change. Intent verification requires a nonempty evidence reference. The SASE audit actor is the authenticated administrator; BT records the authenticated internal reporting service as actor. Use controlled service access for attribution to that actor.

Both reports are raw read-only storage reads, avoiding application accessors that lazily repair records. Their audit correction endpoints write only the separate classification audit. New events contain IDs, environment, classification, source and times; no buyer document, name, contact details or requirements. BT application analytics now receive the server correlation ID and environment; SASE project-start responses expose the same minimal correlation object for consumers.

New BT counter responses include known tests and, when requested for unknown environment, separate unlabelled legacy counters. These remain event diagnostics, not unique outcome measures. The weekly primary-record report is the outcome authority.

## Storage isolation prerequisite

Live Vercel project bindings confirmed the same Upstash integration was connected to both `sasecomparison` and `v0-broadband-reseller-framework` for Production and Preview. No binding was changed.

Production keeps the existing `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Preview/development need **a separate Upstash database**, supplied through `NETIFY_ISOLATED_KV_REST_API_URL` and `NETIFY_ISOLATED_KV_REST_API_TOKEN`; its origin must differ from the shared binding. Keep the original URL available for the comparison. `VERCEL_ENV` is authoritative on Vercel; local runs may set `NETIFY_ACTIVITY_ENV=development`. Local HTTP loopback storage fixtures are allowed. Malformed or unavailable bindings fail closed.

This is an application-level refusal to reuse production storage, not a claim that metadata isolates credentials. Before deployment, provision a dedicated preview database and remove production credentials from preview wherever possible, then verify the actual cloud bindings. Metadata alone is not access isolation. The cloud resource change is still outstanding. With no dedicated binding, preview storage-dependent functions will be unavailable rather than writing into the shared database.

Non-production Resend sends are blocked before network access; BT quote webhooks are also blocked. Existing BT portal production/live gates remain in force. This patch does not certify every unrelated integration or provision a separate Base44 environment.

## Remaining measurement limits

- Existing records are not migrated or reclassified automatically. Explicit retained test evidence can be displayed; durable historical correction requires an authorised reviewer and reason.
- No backfill of a missing provider-evaluated count, invitation timestamp or environment is invented.
- Primary record retention still limits historical completeness; SASE snapshot history is bounded to 50 revisions and BT application records to the existing 90-day retention. Event journals are durable, but they cannot recover expired private outcome records.
- Primary state and the supplemental journal are not one distributed transaction. A journal failure can leave a missing event; primary-record totals remain the outcome source. No background resend or reconciliation mutation was added.
- A previously delivered invitation retains its first delivery timestamp even if a later delivery-state update arrives. Provider acceptance alone has no delivery timestamp.
- General supplier messages may be acknowledgements: they are listed as unverified substance rather than counted as confirmed substantive replies.
- No SASE confirmed-quote/order stage source is wired. Base44 needs the reviewed join described in the weekly report. Empty stage data is not evidence of no off-platform business.
- The retained weekly reconciliation is a documented prior inspection, not a fresh full production extract. The companion synthetic JSON demonstrates the executable reporting contract and is clearly marked as synthetic.

## Validation

See the bundled validation log. Tests cover storage refusal, cross-environment IDs, explicit tests, unknown legacy records, atomic repeated-event deduplication, audited corrections/conflicts, unauthorised reads and writes, late replies, delivery acceptance versus delivery, zero denominators and reviewed operational joins. Real SASE publication tests use isolated storage for both short journey modes, matched/zero-match/unavailable catalogue, idempotent replay and persisted report joins. No real suppliers are contacted.
