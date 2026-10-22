-- ROLE-001: every member holds exactly one product role, read from this record
-- on each request. Base's oa_operators.role remains the implementation owner
-- role of 0011, so changing a product role never ends a session or a token.
-- The default keeps every existing operator, and every operator restored from
-- an archive made before roles, an Owner: no upgrade loses a right. Every
-- product insert names the role it grants.
ALTER TABLE operators ADD COLUMN role TEXT NOT NULL DEFAULT 'owner' CHECK(role IN ('owner','admin','member','guest'));
-- operator.management.v1: Members invite Members only while this is on.
ALTER TABLE workspace_settings ADD COLUMN member_invites INTEGER NOT NULL DEFAULT 0 CHECK(member_invites IN (0,1));
-- The role an invitation link grants, keyed by its Base token so the role
-- travels with exactly the link its inviter issued. Like the links, archives
-- exclude it; it names no foreign key so restore and token retirement stay free.
CREATE TABLE vector_invitation_roles (
 token_id TEXT PRIMARY KEY,
 role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
 inviter_operator_id TEXT NOT NULL,
 created_at TEXT NOT NULL
);
-- A link issued before roles promised an operator equal to its inviter.
INSERT INTO vector_invitation_roles(token_id,role,inviter_operator_id,created_at)
 SELECT t.id,'owner',m.operator_id,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM oa_tokens t JOIN vector_auth_operators m ON m.auth_id=t.issuer_id
 WHERE t.kind='invite' AND t.consumed_at IS NULL AND t.revoked_at IS NULL;
-- The last Owner is never demoted or removed; the installation owner stays an Owner.
CREATE TRIGGER vector_preserve_installation_owner_role BEFORE UPDATE OF role ON operators
 WHEN OLD.role='owner' AND NEW.role<>'owner'
 AND EXISTS(SELECT 1 FROM workspace_installation WHERE setup_operator_id=OLD.id)
 BEGIN SELECT RAISE(ABORT,'installation_owner'); END;
CREATE TRIGGER vector_preserve_last_owner_role BEFORE UPDATE OF role ON operators
 WHEN OLD.role='owner' AND NEW.role<>'owner' AND OLD.removed_at IS NULL
 AND (SELECT count(*) FROM operators WHERE workspace_id=OLD.workspace_id AND role='owner' AND removed_at IS NULL)<=1
 BEGIN SELECT RAISE(ABORT,'last_owner'); END;
CREATE TRIGGER vector_preserve_last_owner_removal BEFORE UPDATE OF removed_at ON operators
 WHEN OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL AND OLD.role='owner'
 AND (SELECT count(*) FROM operators WHERE workspace_id=OLD.workspace_id AND role='owner' AND removed_at IS NULL)<=1
 BEGIN SELECT RAISE(ABORT,'last_owner'); END;
