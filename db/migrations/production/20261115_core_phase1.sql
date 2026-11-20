-- Authorised production core only. Existing legacy tables remain untouched.
CREATE SCHEMA IF NOT EXISTS netify_core_phase1;
CREATE TABLE IF NOT EXISTS netify_core_phase1.projects (
 id uuid PRIMARY KEY, current_revision integer NOT NULL CHECK(current_revision>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_activity_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '90 days',
 environment text NOT NULL DEFAULT 'production' CHECK(environment='production'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','with_netify'))
);
CREATE TABLE IF NOT EXISTS netify_core_phase1.scope_revisions (
 project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id), revision integer NOT NULL,
 scope_hash text NOT NULL CHECK(length(scope_hash)=64), scope jsonb NOT NULL,
 snapshot jsonb NOT NULL, actor jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(project_id,revision)
);
-- Canonical sites live inside scope. These indexes answer sector/location/product
-- containment queries directly, without loading and unpacking every project.
CREATE INDEX IF NOT EXISTS core_scope_search ON netify_core_phase1.scope_revisions USING gin(scope jsonb_path_ops);
CREATE INDEX IF NOT EXISTS core_sector_search ON netify_core_phase1.scope_revisions((scope->'input'->>'sector'));
CREATE TABLE IF NOT EXISTS netify_core_phase1.audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id),
 revision integer NOT NULL, event text NOT NULL, actor jsonb NOT NULL, detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS netify_core_phase1.capabilities (
 token_hash text PRIMARY KEY CHECK(length(token_hash)=64), project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id),
 authority text NOT NULL CHECK(authority IN ('view','edit','claim')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz,
 -- Claim authority is reserved but cannot be issued until verified claiming exists.
 CHECK(authority<>'claim')
);
CREATE TABLE IF NOT EXISTS netify_core_phase1.operations (
 project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id), operation_id uuid NOT NULL,
 request_hash text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(project_id,operation_id)
);
CREATE OR REPLACE FUNCTION netify_core_phase1.immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'Append-only record'; END $$;
CREATE OR REPLACE TRIGGER immutable_scope BEFORE UPDATE OR DELETE ON netify_core_phase1.scope_revisions
 FOR EACH ROW EXECUTE FUNCTION netify_core_phase1.immutable_record();
CREATE OR REPLACE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON netify_core_phase1.audit_events
 FOR EACH ROW EXECUTE FUNCTION netify_core_phase1.immutable_record();
-- This function is deliberately SECURITY INVOKER. Capabilities are checked again
-- under the project lock, so revocation, expiry and stale saves fail atomically.
CREATE OR REPLACE FUNCTION netify_core_phase1.save_scope(
 p_id uuid,p_token text,p_base integer,p_operation uuid,p_request text,
 p_scope jsonb,p_snapshot jsonb,p_hash text,p_actor jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p netify_core_phase1.projects; prior netify_core_phase1.operations;
 current_scope netify_core_phase1.scope_revisions; next_revision integer; receipt jsonb;
BEGIN
 SELECT * INTO p FROM netify_core_phase1.projects WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.expires_at<=clock_timestamp() OR NOT EXISTS (
  SELECT 1 FROM netify_core_phase1.capabilities WHERE token_hash=p_token AND project_id=p_id AND authority='edit' AND revoked_at IS NULL
 ) THEN RETURN jsonb_build_object('error','project_access_denied'); END IF;
 SELECT * INTO prior FROM netify_core_phase1.operations WHERE project_id=p_id AND operation_id=p_operation;
 IF FOUND THEN
  IF prior.request_hash<>p_request THEN RETURN jsonb_build_object('error','operation_key_reused'); END IF;
  RETURN prior.result;
 END IF;
 IF p.current_revision<>p_base THEN RETURN jsonb_build_object('error','revision_conflict','current_revision',p.current_revision); END IF;
 SELECT * INTO current_scope FROM netify_core_phase1.scope_revisions WHERE project_id=p_id AND revision=p.current_revision;
 -- A transport retry or unchanged save is not a new scope version.
 IF current_scope.scope_hash=p_hash AND current_scope.snapshot=p_snapshot THEN
  receipt=jsonb_build_object('project_id',p_id,'revision',p.current_revision,'scope_hash',p_hash,'expires_at',p.expires_at,'unchanged',true);
 ELSE
  next_revision=p.current_revision+1;
  INSERT INTO netify_core_phase1.scope_revisions VALUES(p_id,next_revision,p_hash,p_scope,p_snapshot,p_actor,clock_timestamp());
  UPDATE netify_core_phase1.projects SET current_revision=next_revision,last_activity_at=clock_timestamp(),expires_at=clock_timestamp()+interval '90 days' WHERE id=p_id RETURNING * INTO p;
  INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail)
   VALUES(p_id,next_revision,'scope.saved',p_actor,jsonb_build_object('scope_hash',p_hash,'previous_scope_hash',current_scope.scope_hash));
  receipt=jsonb_build_object('project_id',p_id,'revision',next_revision,'scope_hash',p_hash,'expires_at',p.expires_at);
 END IF;
 INSERT INTO netify_core_phase1.operations VALUES(p_id,p_operation,p_request,receipt);
 RETURN receipt;
END $$;
REVOKE ALL ON SCHEMA netify_core_phase1 FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA netify_core_phase1 FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA netify_core_phase1 FROM PUBLIC;
