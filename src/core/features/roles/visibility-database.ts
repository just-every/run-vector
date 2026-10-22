import { visibilityCtes } from './visibility-sql'

const scoped = new WeakMap<D1Database,string>()
/** Every native/API/document repository receives this database. CTE shadowing
 * is SQLite row projection, not string replacement of table references: nested
 * queries, recursive copy graphs and Drizzle see exactly the same policy.
 * Mutation targets remain real SQLite tables; their SELECT sources are scoped.
 * The native transaction/session wrapper remains outside this adapter.
 */
export function visibilityDatabase(source: D1Database, actor: string): D1Database {
  const reader=scoped.get(source)
  if (reader) {
    if (reader !== actor) throw new Error('A visibility database belongs to one admitted actor.')
    return source
  }
  const ctes = visibilityCtes(actor)
  const db = new Proxy(source, {
    get(target, key) {
      if (key === 'prepare') return (sql: string) => {
        if (/^\s*(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(sql)) return target.prepare(`WITH ${ctes}\n${sql}`)
        if (/^\s*WITH\s+RECURSIVE\b/i.test(sql)) return target.prepare(sql.replace(/^(\s*WITH\s+RECURSIVE)\b/i, `$1 ${ctes},`))
        if (/^\s*WITH\b/i.test(sql)) return target.prepare(sql.replace(/^(\s*WITH)\b/i, `$1 ${ctes},`))
        if (/^\s*PRAGMA\s+table_xinfo\b/i.test(sql)) return target.prepare(sql)
        throw new Error('Visibility-scoped repositories require prepared SQL queries.')
      }
      if (['exec', 'dump', 'withSession'].includes(String(key))) return () => { throw new Error('Visibility-scoped repositories require prepared SQL queries.') }
      const value = Reflect.get(target, key, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  scoped.set(db,actor)
  return db
}
