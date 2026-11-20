-- Development-only request previews. No outbox, dispatch, supplier recipient or publication table.
CREATE TABLE IF NOT EXISTS netify_core_phase1.pricing_previews (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES netify_core_phase1.projects(id),
 operation_id uuid NOT NULL, revision integer NOT NULL, scope_hash text NOT NULL,
 request_hash text NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(project_id,operation_id)
);
-- next
GRANT SELECT,INSERT ON netify_core_phase1.pricing_previews TO netify_core_live_runtime;
-- next
GRANT SELECT,DELETE ON netify_core_phase1.pricing_previews TO netify_core_live_purger;
-- next
REVOKE ALL ON netify_core_phase1.pricing_previews FROM PUBLIC;
-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.prepare_request(p_id uuid,p_token text,p_base integer,p_op uuid,p_hash text,p_preview uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,netify_core_phase1 AS $$
DECLARE p netify_core_phase1.projects;prior netify_core_phase1.operations;receipt jsonb;scope_hash text;
BEGIN
 SELECT * INTO p FROM netify_core_phase1.projects WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM netify_core_phase1.capabilities WHERE project_id=p_id AND token_hash=p_token AND authority='edit' AND revoked_at IS NULL) THEN RETURN jsonb_build_object('error','project_access_denied');END IF;
 SELECT * INTO prior FROM netify_core_phase1.operations WHERE project_id=p_id AND operation_id=p_op;
 IF FOUND THEN IF prior.request_hash<>p_hash THEN RETURN jsonb_build_object('error','operation_key_reused');END IF;RETURN prior.result;END IF;
 IF p.current_revision<>p_base THEN RETURN jsonb_build_object('error','revision_conflict');END IF;
 SELECT r.scope_hash INTO scope_hash FROM netify_core_phase1.scope_revisions r WHERE r.project_id=p_id AND r.revision=p_base;
 INSERT INTO netify_core_phase1.pricing_previews VALUES(p_preview,p_id,p_op,p_base,scope_hash,p_hash,p_payload,clock_timestamp());
 receipt=jsonb_build_object('preview_id',p_preview,'project_id',p_id,'revision',p_base,'scope_hash',scope_hash,'status','prepared_not_sent','supplier_actions',0,'human_approval_required',true);
 INSERT INTO netify_core_phase1.operations VALUES(p_id,p_op,p_hash,receipt);
 INSERT INTO netify_core_phase1.audit_events(project_id,revision,event,actor,detail) VALUES(p_id,p_base,'pricing.prepared',jsonb_build_object('type','assistant'),jsonb_build_object('preview_id',p_preview,'scope_hash',scope_hash,'supplier_actions',0));
 RETURN receipt;
END $$;
-- next
REVOKE ALL ON FUNCTION netify_core_phase1.prepare_request(uuid,text,integer,uuid,text,uuid,jsonb) FROM PUBLIC;
-- next
GRANT EXECUTE ON FUNCTION netify_core_phase1.prepare_request(uuid,text,integer,uuid,text,uuid,jsonb) TO netify_core_live_runtime;

-- next
CREATE OR REPLACE FUNCTION netify_core_phase1.purge_project(p_id uuid,p_receipt uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,netify_core_phase1 AS $$
DECLARE p netify_core_phase1.projects;reason text;oid uuid;
BEGIN
 SELECT * INTO p FROM netify_core_phase1.projects WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','not_available');END IF;
 IF p.environment<>'production' THEN RAISE EXCEPTION 'production_project_required';END IF;
 IF p.deletion_requested_at IS NOT NULL THEN reason='owner_request';
 ELSIF p.owner_id IS NULL AND p.expires_at+interval '30 days'<=clock_timestamp() THEN reason='anonymous_expiry';
 ELSIF p.owner_id IS NOT NULL AND p.reminder_at IS NOT NULL AND p.purge_after<=clock_timestamp() THEN reason='claimed_expiry';
 ELSE RAISE EXCEPTION 'purge_not_due';END IF;
 oid=p.owner_id;
 IF to_regclass('netify_core_phase1.pricing_previews') IS NOT NULL THEN EXECUTE 'DELETE FROM netify_core_phase1.pricing_previews WHERE project_id=$1' USING p_id;END IF;
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
