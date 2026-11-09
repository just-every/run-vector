import { visibleTeam } from '../roles/visibility-sql';
/** Shared by evaluation and dispatch. Saved ownership never carries authority. */
export const liveRule = (r = 'r') => `EXISTS(SELECT 1 FROM operators owner
 JOIN vector_auth_operators mapping ON mapping.operator_id=owner.id
 JOIN oa_operators account ON account.id=mapping.auth_id AND account.status='active'
 WHERE owner.id=${r}.owner_operator_id AND owner.workspace_id=${r}.workspace_id AND owner.removed_at IS NULL
 AND (owner.role IN ('owner','admin') OR (owner.role='member' AND ${r}.team_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM teams rt JOIN team_members membership ON membership.team_id=rt.id AND membership.operator_id=owner.id
 WHERE rt.id=${r}.team_id AND rt.workspace_id=${r}.workspace_id AND rt.archived_at IS NULL
 AND (membership.role='owner' OR rt.settings_permission='all_members')))))`;
export const effectsAllowed = `NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`;
export const ownerReadsIssue = `EXISTS(SELECT 1 FROM operators reader WHERE reader.id=r.owner_operator_id
 AND reader.removed_at IS NULL AND reader.workspace_id=t.workspace_id AND ${visibleTeam('reader','i.team_id')})`;
/** Only an existing, active, explicitly selected Slack binding made by a current
 * Owner or Admin is eligible. Binding scope still limits the issue at dispatch. */
export const eligibleDestination = `EXISTS(SELECT 1 FROM vector_webhook_destinations d
 JOIN vector_channel_bindings b ON b.destination_id=d.id
 JOIN operators binder ON binder.id=b.created_by
 JOIN vector_auth_operators bm ON bm.operator_id=binder.id
 JOIN oa_operators ba ON ba.id=bm.auth_id AND ba.status='active'
 WHERE d.id=r.destination_id AND d.workspace_id=r.workspace_id AND d.kind='slack'
 AND d.enabled=1 AND d.revoked_at IS NULL AND binder.removed_at IS NULL
 AND binder.workspace_id=r.workspace_id AND binder.role IN ('owner','admin')
 AND b.suspended_reason IS NULL AND EXISTS(SELECT 1 FROM json_each(b.events) WHERE value='automation.rule'))`;
