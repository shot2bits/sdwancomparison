-- Isolated development branch only. Apply with the development administrator.
-- next
CREATE TABLE IF NOT EXISTS netify_core_phase1.owners (
 id uuid PRIMARY KEY, email_hash text NOT NULL UNIQUE, email_cipher text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- next
ALTER TABLE netify_core_phase1.projects ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES netify_core_phase1.owners(id),
 ADD COLUMN IF NOT EXISTS last_verified_owner_at timestamptz,
 ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
 ADD COLUMN IF NOT EXISTS purge_after timestamptz,
 ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
 ADD COLUMN IF NOT EXISTS disposable_fixture boolean NOT NULL DEFAULT false;
-- next
DO $$DECLARE c record;BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='netify_core_phase1.capabilities'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%authority <>%claim%' LOOP
 EXECUTE format('ALTER TABLE netify_core_phase1.capabilities DROP CONSTRAINT %I',c.conname);END LOOP;
END $$;
-- next
ALTER TABLE netify_core_phase1.capabilities ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES netify_core_phase1.owners(id);
-- next
CREATE TABLE IF NOT EXISTS netify_core_phase1.verification_challenges (
 token_hash text PRIMARY KEY REFERENCES netify_core_phase1.capabilities(token_hash),
 project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id),
 purpose text NOT NULL CHECK(purpose IN ('claim','recover')),
 email_hash text NOT NULL, email_cipher text NOT NULL, bound_edit_hash text,
 expires_at timestamptz NOT NULL, used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- next
CREATE TABLE IF NOT EXISTS netify_core_phase1.owner_sessions (
 token_hash text PRIMARY KEY, project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id),
 owner_id uuid NOT NULL REFERENCES netify_core_phase1.owners(id),
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- next
CREATE TABLE IF NOT EXISTS netify_core_phase1.captured_mail (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id),
 purpose text NOT NULL CHECK(purpose IN ('claim','recover','retention')),
 payload_cipher text NOT NULL, status text NOT NULL DEFAULT 'captured' CHECK(status IN ('captured','failed','delivered','bounced')),
 attempts integer NOT NULL DEFAULT 1, next_attempt_at timestamptz,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- next
CREATE UNIQUE INDEX IF NOT EXISTS core_one_retention_notice ON netify_core_phase1.captured_mail(project_id) WHERE purpose='retention';
-- next
CREATE TABLE IF NOT EXISTS netify_core_phase1.identity_rate_limits (
 key_hash text PRIMARY KEY, window_at timestamptz NOT NULL, attempts integer NOT NULL
);
-- next
CREATE TABLE IF NOT EXISTS netify_core_phase1.deletion_receipts (
 receipt_id uuid PRIMARY KEY, completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reason text NOT NULL CHECK(reason IN ('owner_request','anonymous_expiry','claimed_expiry')),
 projects_deleted integer NOT NULL CHECK(projects_deleted=1)
);
-- next
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='netify_core_runtime') THEN CREATE ROLE netify_core_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='netify_core_purger') THEN CREATE ROLE netify_core_purger NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='netify_core_purge_worker') THEN CREATE ROLE netify_core_purge_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF;
END $$;
-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_user='netify_core_purger' THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Append-only record';
END $$;
-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.begin_verification(
 p_id uuid,p_edit text,p_purpose text,p_email text,p_cipher text,p_challenge text,p_mail uuid,p_payload text
) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,netify_core_phase1 AS $$
DECLARE p netify_core_phase1.projects;
BEGIN
 SELECT * INTO p FROM netify_core_phase1.projects WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.deletion_requested_at IS NOT NULL THEN RETURN false; END IF;
 IF p_purpose='claim' THEN
  IF p.owner_id IS NOT NULL OR p.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM netify_core_phase1.capabilities WHERE project_id=p_id AND token_hash=p_edit AND authority='edit' AND revoked_at IS NULL) THEN RETURN false; END IF;
 ELSIF p_purpose='recover' THEN
  IF p.owner_id IS NULL OR NOT EXISTS(SELECT 1 FROM netify_core_phase1.owners WHERE id=p.owner_id AND email_hash=p_email) OR coalesce(p.purge_after,p.expires_at)<=clock_timestamp() THEN RETURN false; END IF;
 ELSE RETURN false; END IF;
 INSERT INTO netify_core_phase1.capabilities(token_hash,project_id,authority) VALUES(p_challenge,p_id,'claim');
 INSERT INTO netify_core_phase1.verification_challenges(token_hash,project_id,purpose,email_hash,email_cipher,bound_edit_hash,expires_at)
 VALUES(p_challenge,p_id,p_purpose,p_email,p_cipher,CASE WHEN p_purpose='claim' THEN p_edit END,clock_timestamp()+interval '15 minutes');
 INSERT INTO netify_core_phase1.captured_mail(id,project_id,purpose,payload_cipher,expires_at) VALUES(p_mail,p_id,p_purpose,p_payload,clock_timestamp()+interval '1 day');
 RETURN true;
END $$;
-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.complete_verification(
 p_challenge text,p_owner uuid,p_session text,p_edit text
) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,netify_core_phase1 AS $$
DECLARE c netify_core_phase1.verification_challenges;p netify_core_phase1.projects;oid uuid;
BEGIN
 SELECT * INTO c FROM netify_core_phase1.verification_challenges WHERE token_hash=p_challenge;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','verification_unavailable'); END IF;
 SELECT * INTO p FROM netify_core_phase1.projects WHERE id=c.project_id FOR UPDATE;
 SELECT * INTO c FROM netify_core_phase1.verification_challenges WHERE token_hash=p_challenge FOR UPDATE;
 IF c.used_at IS NOT NULL OR c.expires_at<=clock_timestamp() OR p.deletion_requested_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM netify_core_phase1.capabilities WHERE token_hash=p_challenge AND authority='claim' AND revoked_at IS NULL) THEN RETURN jsonb_build_object('error','verification_unavailable');END IF;
 IF c.purpose='claim' THEN
  IF p.owner_id IS NOT NULL OR p.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM netify_core_phase1.capabilities WHERE token_hash=c.bound_edit_hash AND project_id=p.id AND authority='edit' AND revoked_at IS NULL) THEN RETURN jsonb_build_object('error','verification_unavailable'); END IF;
  INSERT INTO netify_core_phase1.owners(id,email_hash,email_cipher) VALUES(p_owner,c.email_hash,c.email_cipher) ON CONFLICT(email_hash) DO NOTHING;
  SELECT id INTO oid FROM netify_core_phase1.owners WHERE email_hash=c.email_hash;
  UPDATE netify_core_phase1.capabilities SET revoked_at=clock_timestamp() WHERE project_id=p.id AND revoked_at IS NULL;
 ELSE
  SELECT id INTO oid FROM netify_core_phase1.owners WHERE id=p.owner_id AND email_hash=c.email_hash;
  IF oid IS NULL OR coalesce(p.purge_after,p.expires_at)<=clock_timestamp() THEN RETURN jsonb_build_object('error','verification_unavailable');END IF;
  UPDATE netify_core_phase1.capabilities SET revoked_at=clock_timestamp() WHERE project_id=p.id AND authority IN ('edit','claim') AND revoked_at IS NULL;
 END IF;
 UPDATE netify_core_phase1.verification_challenges SET used_at=clock_timestamp() WHERE token_hash=p_challenge;
 UPDATE netify_core_phase1.owner_sessions SET revoked_at=clock_timestamp() WHERE project_id=p.id AND revoked_at IS NULL;
 UPDATE netify_core_phase1.projects SET owner_id=oid,last_verified_owner_at=clock_timestamp(),reminder_at=NULL,purge_after=NULL,expires_at=clock_timestamp()+interval '24 months 30 days' WHERE id=p.id;
 INSERT INTO netify_core_phase1.owner_sessions(token_hash,project_id,owner_id,expires_at) VALUES(p_session,p.id,oid,clock_timestamp()+interval '7 days');
 INSERT INTO netify_core_phase1.capabilities(token_hash,project_id,authority,owner_id) VALUES(p_edit,p.id,'edit',oid);
 INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail) VALUES(p.id,p.current_revision,'identity.'||c.purpose,jsonb_build_object('type','verified_owner','ref',oid),jsonb_build_object('private_only',true,'scope_revision',p.current_revision));
 RETURN jsonb_build_object('project_id',p.id,'owner_id',oid,'revision',p.current_revision,'purpose',c.purpose);
END $$;
-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.owner_action(p_id uuid,p_session text,p_action text,p_new text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,netify_core_phase1 AS $$
DECLARE p netify_core_phase1.projects;oid uuid;
BEGIN
 SELECT * INTO p FROM netify_core_phase1.projects WHERE id=p_id FOR UPDATE;
 SELECT s.owner_id INTO oid FROM netify_core_phase1.owner_sessions s WHERE s.token_hash=p_session AND s.project_id=p_id AND s.owner_id=p.owner_id AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp();
 IF oid IS NULL OR p.deletion_requested_at IS NOT NULL OR p.expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('error','verified_owner_required'); END IF;
 IF p_action IN ('replace_view','replace_edit') THEN
  IF p_new IS NULL OR length(p_new)<>64 THEN RETURN jsonb_build_object('error','invalid_link');END IF;
  UPDATE netify_core_phase1.capabilities SET revoked_at=clock_timestamp() WHERE project_id=p_id AND authority=CASE WHEN p_action='replace_view' THEN 'view' ELSE 'edit' END AND revoked_at IS NULL;
  INSERT INTO netify_core_phase1.capabilities(token_hash,project_id,authority,owner_id) VALUES(p_new,p_id,CASE WHEN p_action='replace_view' THEN 'view' ELSE 'edit' END,oid);
 ELSIF p_action='revoke_view' THEN UPDATE netify_core_phase1.capabilities SET revoked_at=clock_timestamp() WHERE project_id=p_id AND authority='view' AND revoked_at IS NULL;
 ELSIF p_action='keep' THEN NULL;
 ELSIF p_action='delete' THEN
  IF NOT p.disposable_fixture THEN RETURN jsonb_build_object('error','development_fixture_only');END IF;
  UPDATE netify_core_phase1.projects SET deletion_requested_at=clock_timestamp(),expires_at=clock_timestamp(),purge_after=clock_timestamp() WHERE id=p_id;
  UPDATE netify_core_phase1.capabilities SET revoked_at=clock_timestamp() WHERE project_id=p_id;
  UPDATE netify_core_phase1.owner_sessions SET revoked_at=clock_timestamp() WHERE project_id=p_id;
 ELSE RETURN jsonb_build_object('error','action_unavailable'); END IF;
 IF p_action<>'delete' THEN UPDATE netify_core_phase1.projects SET last_verified_owner_at=clock_timestamp(),reminder_at=NULL,purge_after=NULL,expires_at=clock_timestamp()+interval '24 months 30 days' WHERE id=p_id;END IF;
 INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail) VALUES(p_id,p.current_revision,'owner.'||p_action,jsonb_build_object('type','verified_owner','ref',oid),jsonb_build_object('private_only',true));
 RETURN jsonb_build_object('project_id',p_id,'action',p_action,'complete',true);
END $$;
-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.purge_project(p_id uuid,p_receipt uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,netify_core_phase1 AS $$
DECLARE p netify_core_phase1.projects;reason text;oid uuid;
BEGIN
 SELECT * INTO p FROM netify_core_phase1.projects WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_available');END IF;
 IF NOT p.disposable_fixture THEN RAISE EXCEPTION 'development_fixture_only';END IF;
 IF p.deletion_requested_at IS NOT NULL THEN reason='owner_request';
 ELSIF p.owner_id IS NULL AND p.expires_at+interval '30 days'<=clock_timestamp() THEN reason='anonymous_expiry';
 ELSIF p.owner_id IS NOT NULL AND p.reminder_at IS NOT NULL AND p.purge_after<=clock_timestamp() THEN reason='claimed_expiry';
 ELSE RAISE EXCEPTION 'purge_not_due';END IF;
 oid=p.owner_id;
 DELETE FROM netify_core_phase1.verification_challenges WHERE project_id=p_id;
 DELETE FROM netify_core_phase1.owner_sessions WHERE project_id=p_id;
 DELETE FROM netify_core_phase1.captured_mail WHERE project_id=p_id;
 DELETE FROM netify_core_phase1.capabilities WHERE project_id=p_id;
 DELETE FROM netify_core_phase1.operations WHERE project_id=p_id;
 DELETE FROM netify_core_phase1.scope_revisions WHERE project_id=p_id;
 DELETE FROM netify_core_phase1.audit_events WHERE project_id=p_id;
 DELETE FROM netify_core_phase1.projects WHERE id=p_id;
 DELETE FROM netify_core_phase1.owners WHERE id=oid AND NOT EXISTS(SELECT 1 FROM netify_core_phase1.projects WHERE owner_id=oid);
 INSERT INTO netify_core_phase1.deletion_receipts(receipt_id,reason,projects_deleted) VALUES(p_receipt,reason,1);
 RETURN jsonb_build_object('receipt_id',p_receipt,'status','purged','reason',reason);
END $$;
-- next
GRANT netify_core_purger TO neondb_owner;
-- next
GRANT USAGE ON SCHEMA netify_core_phase1 TO netify_core_runtime,netify_core_purger,netify_core_purge_worker;
-- next
GRANT SELECT ON ALL TABLES IN SCHEMA netify_core_phase1 TO netify_core_runtime;
-- next
GRANT INSERT ON netify_core_phase1.projects,netify_core_phase1.scope_revisions,netify_core_phase1.audit_events,netify_core_phase1.capabilities,netify_core_phase1.operations,netify_core_phase1.owners,netify_core_phase1.verification_challenges,netify_core_phase1.owner_sessions,netify_core_phase1.captured_mail,netify_core_phase1.identity_rate_limits TO netify_core_runtime;
-- next
GRANT UPDATE ON netify_core_phase1.projects,netify_core_phase1.capabilities,netify_core_phase1.owners,netify_core_phase1.verification_challenges,netify_core_phase1.owner_sessions,netify_core_phase1.captured_mail,netify_core_phase1.identity_rate_limits TO netify_core_runtime;
-- next
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA netify_core_phase1 TO netify_core_runtime;
-- next
GRANT SELECT,DELETE ON ALL TABLES IN SCHEMA netify_core_phase1 TO netify_core_purger;
-- next
GRANT INSERT ON netify_core_phase1.deletion_receipts TO netify_core_purger;
-- next
GRANT UPDATE ON netify_core_phase1.projects TO netify_core_purger;
-- next
GRANT CREATE ON SCHEMA netify_core_phase1 TO netify_core_purger;
-- next
ALTER FUNCTION netify_core_phase1.purge_project(uuid,uuid) OWNER TO netify_core_purger;
-- next
REVOKE CREATE ON SCHEMA netify_core_phase1 FROM netify_core_purger;
-- next
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA netify_core_phase1 FROM PUBLIC;
-- next
GRANT EXECUTE ON FUNCTION netify_core_phase1.save_scope(uuid,text,integer,uuid,text,jsonb,jsonb,text,jsonb),netify_core_phase1.begin_verification(uuid,text,text,text,text,text,uuid,text),netify_core_phase1.complete_verification(text,uuid,text,text),netify_core_phase1.owner_action(uuid,text,text,text) TO netify_core_runtime;
-- next
GRANT EXECUTE ON FUNCTION netify_core_phase1.purge_project(uuid,uuid) TO netify_core_purge_worker;
-- next
REVOKE ALL ON SCHEMA netify_core_phase1 FROM PUBLIC;
-- next
REVOKE ALL ON ALL TABLES IN SCHEMA netify_core_phase1 FROM PUBLIC;

-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.save_scope(
 p_id uuid,p_token text,p_base integer,p_operation uuid,p_request text,
 p_scope jsonb,p_snapshot jsonb,p_hash text,p_actor jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p netify_core_phase1.projects; prior netify_core_phase1.operations;
 current_scope netify_core_phase1.scope_revisions; next_revision integer; receipt jsonb; verified_owner boolean;
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
  verified_owner=EXISTS(SELECT 1 FROM netify_core_phase1.owner_sessions WHERE token_hash=p_actor->>'owner_session_hash' AND project_id=p_id AND owner_id=p.owner_id AND revoked_at IS NULL AND expires_at>clock_timestamp());
  p_actor=p_actor-'owner_session_hash';
  next_revision=p.current_revision+1;
  INSERT INTO netify_core_phase1.scope_revisions VALUES(p_id,next_revision,p_hash,p_scope,p_snapshot,p_actor,clock_timestamp());
  UPDATE netify_core_phase1.projects SET current_revision=next_revision,last_activity_at=clock_timestamp(),expires_at=CASE WHEN owner_id IS NULL THEN clock_timestamp()+interval '90 days' WHEN verified_owner THEN clock_timestamp()+interval '24 months 30 days' ELSE expires_at END,last_verified_owner_at=CASE WHEN verified_owner THEN clock_timestamp() ELSE last_verified_owner_at END,reminder_at=CASE WHEN verified_owner THEN NULL ELSE reminder_at END,purge_after=CASE WHEN verified_owner THEN NULL ELSE purge_after END WHERE id=p_id RETURNING * INTO p;
  INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail)
   VALUES(p_id,next_revision,'scope.saved',p_actor,jsonb_build_object('scope_hash',p_hash,'previous_scope_hash',current_scope.scope_hash));
  receipt=jsonb_build_object('project_id',p_id,'revision',next_revision,'scope_hash',p_hash,'expires_at',p.expires_at);
 END IF;
 INSERT INTO netify_core_phase1.operations VALUES(p_id,p_operation,p_request,receipt);
 RETURN receipt;
END $$;
