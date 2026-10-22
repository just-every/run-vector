-- ROLE-003: the exact invitation link carries its role and named teams before
-- it can be delivered or accepted. Historical invitations retain their grant.
ALTER TABLE vector_invitation_roles RENAME TO vector_invitation_roles_legacy;
CREATE TABLE vector_invitation_roles (
 token_id TEXT PRIMARY KEY,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','member','guest')),
 inviter_operator_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 team_ids_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(team_ids_json) AND json_type(team_ids_json)='array'),
 CHECK(role<>'guest' OR json_array_length(team_ids_json)>0)
);
INSERT INTO vector_invitation_roles(token_id,role,inviter_operator_id,created_at)
 SELECT token_id,role,inviter_operator_id,created_at FROM vector_invitation_roles_legacy;
DROP TABLE vector_invitation_roles_legacy;
-- Native acceptance cannot activate an invite without its product grant.
-- Old links were backfilled in 0075; every new link records its grant in the
-- native issuance transaction. Product creation and membership are one batch.
CREATE TRIGGER vector_invitation_requires_role BEFORE UPDATE OF consumed_at ON oa_tokens
 WHEN NEW.kind='invite' AND OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM vector_invitation_roles WHERE token_id=NEW.id)
 BEGIN SELECT RAISE(ABORT,'invitation_role_required'); END;
-- Rebuilding this table moves 0079's invitation trigger to the legacy table;
-- dropping that table retires it. Reattach the same producer to the new grant
-- table so Guest invitations keep the invitation event in their native batch.
CREATE TRIGGER vector_audit_invitation AFTER INSERT ON vector_invitation_roles BEGIN
 INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
 SELECT 'invite:'||NEW.token_id,NEW.inviter_operator_id,'operator.invited','auth:'||t.operator_id,'auth:'||t.operator_id,NEW.created_at,NEW.created_at FROM oa_tokens t WHERE t.id=NEW.token_id;
END;
