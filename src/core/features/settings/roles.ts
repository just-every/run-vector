import { normalizeEmail } from '../../../../vendor/base/operator-auth/policy.mjs'
import { administrationContext, audit, commit, guard, SettingsError } from '../administration/transaction'
import { assignableRoles, type AssignableRole } from '../roles/matrix'

export const assignable = (role: string): role is AssignableRole => (assignableRoles as readonly string[]).includes(role)
export const guestNotAssignable = () => new SettingsError('role_not_assignable',
  'Guests are invited to named teams with guest access, which is not available yet (ROLE-003). Choose Owner, Admin or Member.', 400)

/** The role an invitation grants travels with the exact link its inviter just
 * issued. A link without one admits a Member. */
export async function recordInvitationRole(db: D1Database, actor: string, email: string, role: AssignableRole) {
  await db.prepare(`INSERT INTO vector_invitation_roles(token_id,role,inviter_operator_id,created_at)
    SELECT t.id,?,?,? FROM oa_tokens t JOIN oa_operators o ON o.id=t.operator_id
    WHERE o.email=? AND t.kind='invite' AND t.consumed_at IS NULL AND t.revoked_at IS NULL
    AND t.issuer_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)
    ORDER BY t.created_at DESC LIMIT 1
    ON CONFLICT(token_id) DO UPDATE SET role=excluded.role`)
    .bind(role, actor, new Date().toISOString(), normalizeEmail(email), actor).run()
}

/** Pending links an operator issued for a role they can no longer grant stop
 * admitting anyone; acceptance rechecks the rest (Base's invite policy). */
export function revokeUngrantableInvitations(db: D1Database, operator: string, role: string, at: number) {
  return db.prepare(`UPDATE oa_tokens SET revoked_at=? WHERE ?<>'owner' AND kind='invite' AND consumed_at IS NULL AND revoked_at IS NULL
    AND issuer_id IN (SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)
    AND id IN (SELECT token_id FROM vector_invitation_roles WHERE role IN ('owner','admin'))`).bind(at, role, operator)
}

/** ROLE-001: one audited role change, effective on the member's next request.
 * The database keeps the last Owner and the installation owner Owners. */
export async function changeRole(source: D1Database, actor: string, target: string, role: string) {
  if (role === 'guest') throw guestNotAssignable()
  if (!assignable(role)) throw new SettingsError('invalid_role', 'Choose Owner, Admin or Member.', 400)
  const ctx = await administrationContext(source, actor)
  const member = await ctx.db.prepare('SELECT id,name,role FROM operators WHERE id=? AND workspace_id=? AND removed_at IS NULL')
    .bind(target, ctx.workspace).first<{ id: string; name: string; role: string }>()
  if (!member) throw new SettingsError('not_found', 'Member is unavailable.', 404)
  if (member.role === role) return
  await commit(ctx, [
    guard(ctx.db, 'EXISTS(SELECT 1 FROM operators WHERE id=? AND role=? AND removed_at IS NULL)', target, member.role),
    ctx.db.prepare('UPDATE operators SET role=?,updated_at=? WHERE id=?').bind(role, ctx.at, target),
    revokeUngrantableInvitations(ctx.db, target, role, Date.parse(ctx.at)),
    ...audit(ctx, 'operator.role_changed', target, member.name, { role: member.role }, { role }),
  ])
}
