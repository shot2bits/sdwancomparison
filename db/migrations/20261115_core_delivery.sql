-- Private mail delivery metadata and verified-owner desk handoff. No supplier dispatch.
ALTER TABLE netify_core_phase1.captured_mail ADD COLUMN IF NOT EXISTS delivery_id text,ADD COLUMN IF NOT EXISTS delivery_round integer NOT NULL DEFAULT 0,ADD COLUMN IF NOT EXISTS delivery_ids text[] NOT NULL DEFAULT '{}',ADD COLUMN IF NOT EXISTS last_bounced_delivery_id text;
-- next
DO $$DECLARE c record;BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='netify_core_phase1.captured_mail'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%status%' LOOP EXECUTE format('ALTER TABLE netify_core_phase1.captured_mail DROP CONSTRAINT %I',c.conname);END LOOP;END $$;
-- next
ALTER TABLE netify_core_phase1.captured_mail ADD CONSTRAINT core_mail_delivery_state CHECK(status IN ('captured','failed','accepted','delivered','bounced','suppressed'));
-- next
CREATE TABLE IF NOT EXISTS netify_core_phase1.desk_requests (
 id uuid PRIMARY KEY,project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id),
 preview_id uuid NOT NULL REFERENCES netify_core_phase1.pricing_previews(id),owner_id uuid NOT NULL REFERENCES netify_core_phase1.owners(id),
 revision integer NOT NULL,scope_hash text NOT NULL,recipient text NOT NULL,
 approval_instruction text NOT NULL,approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 status text NOT NULL DEFAULT 'approved' CHECK(status IN ('approved','sending','accepted','failed','stale','bounced','suppressed')),
 delivery_id text,attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz,
 UNIQUE(project_id,preview_id)
);
-- next
ALTER TABLE netify_core_phase1.desk_requests DROP CONSTRAINT IF EXISTS desk_requests_status_check;
-- next
ALTER TABLE netify_core_phase1.desk_requests ADD CONSTRAINT desk_requests_status_check CHECK(status IN ('approved','sending','accepted','failed','stale','bounced','suppressed'));
-- next
GRANT SELECT,INSERT,UPDATE ON netify_core_phase1.desk_requests TO netify_core_runtime;
-- next
GRANT SELECT,DELETE ON netify_core_phase1.desk_requests TO netify_core_purger;
-- next
REVOKE ALL ON netify_core_phase1.desk_requests FROM PUBLIC;
-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.approve_desk_request(p_id uuid,p_session text,p_preview uuid,p_revision integer,p_scope_hash text,p_recipient text,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,netify_core_phase1 AS $$
DECLARE p netify_core_phase1.projects;v netify_core_phase1.pricing_previews;oid uuid;r netify_core_phase1.desk_requests;
BEGIN
 SELECT * INTO p FROM netify_core_phase1.projects WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.expires_at<=clock_timestamp() OR p.deletion_requested_at IS NOT NULL THEN RETURN jsonb_build_object('error','verified_owner_required');END IF;
 SELECT owner_id INTO oid FROM netify_core_phase1.owner_sessions WHERE token_hash=p_session AND project_id=p_id AND owner_id=p.owner_id AND revoked_at IS NULL AND expires_at>clock_timestamp();
 IF oid IS NULL THEN RETURN jsonb_build_object('error','verified_owner_required');END IF;
 SELECT * INTO v FROM netify_core_phase1.pricing_previews WHERE id=p_preview AND project_id=p_id;
 IF NOT FOUND OR v.revision<>p_revision OR v.scope_hash<>p_scope_hash OR p.current_revision<>p_revision THEN RETURN jsonb_build_object('error','revision_conflict');END IF;
 IF length(p_recipient)>254 OR p_recipient !~ '^[^[:space:]]+@[^[:space:]]+$' THEN RETURN jsonb_build_object('error','desk_not_configured');END IF;
 SELECT * INTO r FROM netify_core_phase1.desk_requests WHERE project_id=p_id AND preview_id=p_preview;
 IF FOUND THEN RETURN jsonb_build_object('request_id',r.id,'status',r.status,'revision',r.revision,'scope_hash',r.scope_hash);END IF;
 INSERT INTO netify_core_phase1.desk_requests(id,project_id,preview_id,owner_id,revision,scope_hash,recipient,approval_instruction)
 VALUES(p_request,p_id,p_preview,oid,p_revision,p_scope_hash,p_recipient,'Send this approved version to the Netify sourcing desk only.');
 INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail) VALUES(p_id,p_revision,'desk.approved',jsonb_build_object('type','verified_owner','ref',oid,'channel','web'),jsonb_build_object('request_id',p_request,'preview_id',p_preview,'scope_hash',p_scope_hash,'recipient',p_recipient,'supplier_dispatch',false));
 RETURN jsonb_build_object('request_id',p_request,'status','approved','revision',p_revision,'scope_hash',p_scope_hash);
END $$;
-- next
REVOKE ALL ON FUNCTION netify_core_phase1.approve_desk_request(uuid,text,uuid,integer,text,text,uuid) FROM PUBLIC;
-- next
GRANT EXECUTE ON FUNCTION netify_core_phase1.approve_desk_request(uuid,text,uuid,integer,text,text,uuid) TO netify_core_runtime;
-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.cleanup_transients() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,netify_core_phase1 AS $$
DECLARE n integer;total integer=0;
BEGIN
 DELETE FROM netify_core_phase1.captured_mail WHERE project_id IN (SELECT id FROM netify_core_phase1.projects WHERE disposable_fixture=true) AND expires_at<=clock_timestamp();GET DIAGNOSTICS n=ROW_COUNT;total=total+n;
 DELETE FROM netify_core_phase1.verification_challenges WHERE project_id IN (SELECT id FROM netify_core_phase1.projects WHERE disposable_fixture=true) AND expires_at<clock_timestamp()-interval '1 day';GET DIAGNOSTICS n=ROW_COUNT;total=total+n;
 DELETE FROM netify_core_phase1.capabilities c WHERE c.project_id IN (SELECT id FROM netify_core_phase1.projects WHERE disposable_fixture=true) AND c.authority='claim' AND c.created_at<clock_timestamp()-interval '1 day' AND NOT EXISTS(SELECT 1 FROM netify_core_phase1.verification_challenges v WHERE v.token_hash=c.token_hash);GET DIAGNOSTICS n=ROW_COUNT;total=total+n;
 DELETE FROM netify_core_phase1.owner_sessions WHERE project_id IN (SELECT id FROM netify_core_phase1.projects WHERE disposable_fixture=true) AND expires_at<clock_timestamp()-interval '1 day';GET DIAGNOSTICS n=ROW_COUNT;total=total+n;
 -- Global operational counters are not removed by development fixture cleanup.
 RETURN jsonb_build_object('deleted_transient_rows',total);
END $$;
-- next
GRANT CREATE ON SCHEMA netify_core_phase1 TO netify_core_purger;
-- next
ALTER FUNCTION netify_core_phase1.cleanup_transients() OWNER TO netify_core_purger;
-- next
REVOKE CREATE ON SCHEMA netify_core_phase1 FROM netify_core_purger;
-- next
REVOKE ALL ON FUNCTION netify_core_phase1.cleanup_transients() FROM PUBLIC;
-- next
GRANT EXECUTE ON FUNCTION netify_core_phase1.cleanup_transients() TO netify_core_purge_worker;

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
 DELETE FROM netify_core_phase1.desk_requests WHERE project_id=p_id;
 IF to_regclass('netify_core_phase1.pricing_previews') IS NOT NULL THEN EXECUTE 'DELETE FROM netify_core_phase1.pricing_previews WHERE project_id=$1' USING p_id;END IF;
 DELETE FROM netify_core_phase1.verification_challenges WHERE project_id IN (SELECT id FROM netify_core_phase1.projects WHERE disposable_fixture=true) AND project_id=p_id;
 DELETE FROM netify_core_phase1.owner_sessions WHERE project_id IN (SELECT id FROM netify_core_phase1.projects WHERE disposable_fixture=true) AND project_id=p_id;
 DELETE FROM netify_core_phase1.captured_mail WHERE project_id IN (SELECT id FROM netify_core_phase1.projects WHERE disposable_fixture=true) AND project_id=p_id;
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
CREATE INDEX IF NOT EXISTS core_mail_delivery_id ON netify_core_phase1.captured_mail(delivery_id) WHERE delivery_id IS NOT NULL;

-- next
DO $$DECLARE c record;BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='netify_core_phase1.projects'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%status%' LOOP EXECUTE format('ALTER TABLE netify_core_phase1.projects DROP CONSTRAINT %I',c.conname);END LOOP;END $$;
-- next
ALTER TABLE netify_core_phase1.projects ADD CONSTRAINT core_project_status CHECK(status IN ('draft','with_netify'));
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
  UPDATE netify_core_phase1.projects SET current_revision=next_revision,status='draft',last_activity_at=clock_timestamp(),expires_at=CASE WHEN owner_id IS NULL THEN clock_timestamp()+interval '90 days' WHEN verified_owner THEN clock_timestamp()+interval '24 months 30 days' ELSE expires_at END,last_verified_owner_at=CASE WHEN verified_owner THEN clock_timestamp() ELSE last_verified_owner_at END,reminder_at=CASE WHEN verified_owner THEN NULL ELSE reminder_at END,purge_after=CASE WHEN verified_owner THEN NULL ELSE purge_after END WHERE id=p_id RETURNING * INTO p;
  INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail)
   VALUES(p_id,next_revision,'scope.saved',p_actor,jsonb_build_object('scope_hash',p_hash,'previous_scope_hash',current_scope.scope_hash));
  receipt=jsonb_build_object('project_id',p_id,'revision',next_revision,'scope_hash',p_hash,'expires_at',p.expires_at);
 END IF;
 INSERT INTO netify_core_phase1.operations VALUES(p_id,p_operation,p_request,receipt);
 RETURN receipt;
END $$;
