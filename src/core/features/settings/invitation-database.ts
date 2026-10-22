import type { AssignableRole } from '../roles/matrix'

/** Extends Base's native issuance batch, without editing the Base selection.
 * The product grant and named teams commit with the exact native token before
 * sendLink can expose it. A failed grant rolls back the invitation itself.
 */
export function invitationDatabase(db: D1Database, actor: string, email: string, role: AssignableRole, teams: string[]) {
  const issuance = new WeakMap<D1PreparedStatement,D1PreparedStatement>()
  const mark = (statement: D1PreparedStatement): D1PreparedStatement => {
    const result = new Proxy(statement, { get(target, key) {
      if (key === 'bind') return (...values: unknown[]) => mark(target.bind(...values))
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    } })
    issuance.set(result,statement)
    return result
  }
  return new Proxy(db, { get(target, key) {
    if (key === 'prepare') return (sql: string) => {
      const statement = target.prepare(sql)
      return /INSERT INTO oa_tokens[\s\S]*'invite'/.test(sql) ? mark(statement) : statement
    }
    if (key === 'batch') return async (statements: D1PreparedStatement[]) => {
      if (!statements.some(statement => issuance.has(statement))) return target.batch(statements)
      const result = await target.batch([
        ...statements.map(statement => issuance.get(statement) ?? statement),
        target.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM operators o JOIN workspace_settings w ON w.id=o.workspace_id
          WHERE o.id=? AND o.removed_at IS NULL AND (o.role='owner' OR o.role='admin' AND ? IN('member','guest') OR o.role='member' AND ?='member' AND w.member_invites=1)
          AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM teams t WHERE t.id=j.value AND t.workspace_id=o.workspace_id AND t.archived_at IS NULL)))
          THEN 1 ELSE json('invitation authority changed') END`).bind(actor, role, role, JSON.stringify(teams)),
        target.prepare(`INSERT INTO vector_invitation_roles(token_id,role,inviter_operator_id,created_at,team_ids_json)
          SELECT t.id,?,?,?,? FROM oa_tokens t JOIN oa_operators native ON native.id=t.operator_id
          WHERE native.email=? AND t.kind='invite' AND t.consumed_at IS NULL AND t.revoked_at IS NULL
          AND t.issuer_id=(SELECT auth_id FROM vector_auth_operators WHERE operator_id=?)
          ORDER BY t.created_at DESC LIMIT 1`)
          .bind(role, actor, new Date().toISOString(), JSON.stringify(teams), email, actor),
      ])
      return result.slice(0, statements.length)
    }
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}
