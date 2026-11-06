import { customFieldSchema, type CustomField } from './schema'

type Row = { id: string; team_id: string; name: string; description: string; type: string; version: number; option_id: string | null; option_name: string | null }
const columns = 'd.id,d.team_id,d.name,d.description,d.type,d.version,o.id AS option_id,o.name AS option_name'
const order = 'ORDER BY d.name COLLATE NOCASE,d.id,o.position,o.id'

/** Every visible team's fields. Unqualified tables follow the reader's current
 * team visibility (ROLE-002, ROLE-003), so a hidden team's fields never appear. */
export function teamFieldsStatement(db: D1Database, workspaceId: string) {
  return db.prepare(`SELECT ${columns} FROM custom_field_definitions d JOIN teams t ON t.id=d.team_id
    LEFT JOIN custom_field_options o ON o.field_id=d.id WHERE t.workspace_id=? ${order}`).bind(workspaceId)
}

/** The fields that apply to one issue: those of its current team. */
export function issueFieldsStatement(db: D1Database, issueId: string) {
  return db.prepare(`SELECT ${columns} FROM issues i JOIN custom_field_definitions d ON d.team_id=i.team_id
    LEFT JOIN custom_field_options o ON o.field_id=d.id WHERE i.id=? ${order}`).bind(issueId)
}

export function fieldProjection(rows: readonly unknown[]): CustomField[] {
  const fields = new Map<string, { id: string; teamId: string; name: string; description: string; type: string; version: number; options: { id: string; name: string }[] }>()
  for (const row of rows as Row[]) {
    const field = fields.get(row.id) ?? { id: row.id, teamId: row.team_id, name: row.name, description: row.description, type: row.type, version: row.version, options: [] }
    if (row.option_id !== null) field.options.push({ id: row.option_id, name: String(row.option_name) })
    fields.set(row.id, field)
  }
  return [...fields.values()].map(field => customFieldSchema.parse(field))
}
