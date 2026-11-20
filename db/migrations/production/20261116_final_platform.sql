-- Production copy of db/migrations/20261116_final_platform.sql. Built by scripts/build-production-final-platform-migration.mjs.
-- Owner approval for production application recorded 2026-11-19.
-- Uses the existing private core and does not migrate or mutate legacy KV.
CREATE TABLE IF NOT EXISTS netify_core_phase1.platform_records (
 kind text NOT NULL CHECK(kind IN ('supplier','commercial','supplier_grant','supplier_document','supplier_capture','organisation','membership','mandate','agent_client','agent_code','agent_token','public_evidence','reseller_enquiry')),
 id text NOT NULL, revision bigint NOT NULL DEFAULT 1,
 environment text NOT NULL CHECK(environment IN ('development','production')),
 project_id uuid REFERENCES netify_core_phase1.projects(id) ON DELETE CASCADE,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(kind,id)
);
CREATE INDEX IF NOT EXISTS platform_records_project ON netify_core_phase1.platform_records(project_id,kind);
CREATE TABLE IF NOT EXISTS netify_core_phase1.platform_events (
 id uuid PRIMARY KEY, project_id uuid REFERENCES netify_core_phase1.projects(id) ON DELETE CASCADE,
 event text NOT NULL, actor_hash text NOT NULL, source text NOT NULL,
 environment text NOT NULL CHECK(environment IN ('development','production')),
 excluded boolean NOT NULL, exclusion_reason text,
 operation_key text NOT NULL UNIQUE, at timestamptz NOT NULL DEFAULT clock_timestamp(),
 detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS platform_events_week ON netify_core_phase1.platform_events(at,event) WHERE NOT excluded;
CREATE TABLE IF NOT EXISTS netify_core_phase1.owner_notifications (
 id text PRIMARY KEY, kind text NOT NULL, project_id uuid REFERENCES netify_core_phase1.projects(id) ON DELETE CASCADE,
 payload_cipher text NOT NULL, status text NOT NULL DEFAULT 'queued'
 CHECK(status IN ('queued','sending','accepted','delivered','failed','bounced','awaiting_delivery_confirmation','suppressed')),
 delivery_id text, attempts integer NOT NULL DEFAULT 0, at timestamptz NOT NULL DEFAULT clock_timestamp(),
 attempted_at timestamptz, next_attempt_at timestamptz
);
CREATE TABLE IF NOT EXISTS netify_core_phase1.owner_access_log (
 id uuid PRIMARY KEY, actor_hash text NOT NULL, action text NOT NULL,
 at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON netify_core_phase1.platform_records,netify_core_phase1.platform_events,netify_core_phase1.owner_notifications,netify_core_phase1.owner_access_log FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON netify_core_phase1.platform_records,netify_core_phase1.owner_notifications TO netify_core_live_runtime;
GRANT SELECT,INSERT ON netify_core_phase1.platform_events,netify_core_phase1.owner_access_log TO netify_core_live_runtime;
GRANT UPDATE(excluded,exclusion_reason) ON netify_core_phase1.platform_events TO netify_core_live_runtime;

ALTER TABLE netify_core_phase1.platform_records DROP CONSTRAINT IF EXISTS platform_records_kind_check;
ALTER TABLE netify_core_phase1.platform_records ADD CONSTRAINT platform_records_kind_check CHECK(kind IN ('supplier','commercial','supplier_grant','supplier_document','supplier_capture','organisation','membership','mandate','agent_client','agent_code','agent_token','public_evidence','reseller_enquiry'));

CREATE INDEX IF NOT EXISTS platform_events_project ON netify_core_phase1.platform_events(project_id,at DESC);
GRANT SELECT,DELETE ON netify_core_phase1.platform_records,netify_core_phase1.platform_events,netify_core_phase1.owner_notifications,netify_core_phase1.owner_access_log TO netify_core_live_purger;
