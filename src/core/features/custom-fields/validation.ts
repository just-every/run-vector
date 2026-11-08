import { admitTypeRequirements } from '../issue-types/requirements'
import { IssueMutationError } from '../issues/errors'

export type FieldValues = Record<string, unknown>
export type FieldCatalogue = { definitions: Definition[]; options: {id:string;field_id:string;name:string}[]; types:{id:string;team_id:string;enabled:number}[]; requirements:{type_id:string;field_id:string;name:string}[] }
type Definition = { id: string; team_id: string | null; name: string; type: string }

// JSON object order is not a change.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as FieldValues)[key])).join(',') + '}'
  return JSON.stringify(value)
}

/** The typed values a write keeps, required current again inside its transaction:
 * each names an option of a field of `team`, a bound `?` or a column such as
 * `issues.team_id`. Binds the JSON object first, then the team when it is `?`. */
export const currentFieldValues = (team: string) =>
  `NOT EXISTS(SELECT 1 FROM json_each(?) entry WHERE NOT EXISTS(SELECT 1 FROM main.custom_field_options o
    JOIN main.custom_field_definitions d ON d.id=o.field_id WHERE d.id=entry.key AND o.id=entry.value AND d.team_id=${team}))`

/** Definitions named by these keys, whatever the reader may see: a key never
 * changes meaning with the caller's visibility. */
export async function namedDefinitions(db: D1Database, keys: string[]) {
  if (!keys.length) return { definitions: [] as Definition[], options: [] as { id: string; field_id: string; name: string }[] }
  const definitions = (await db.prepare('SELECT id,team_id,name,type FROM main.custom_field_definitions WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(keys)).all<Definition>()).results
  const options = definitions.length ? (await db.prepare('SELECT id,field_id,name FROM main.custom_field_options WHERE field_id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(definitions.map(definition => definition.id))).all<{ id: string; field_id: string; name: string }>()).results : []
  return { definitions, options }
}

/** FIELD-001's one typed boundary, shared by every issue writer that accepts
 * custom-field values. A key naming a field definition is typed: a changed value
 * must be one of that team field's options, and null clears it. Any other key is
 * a legacy untyped value and passes unchanged, as does a retained typed value
 * the request leaves as it was. Returns the map to store and the typed values the
 * write transaction must still find current (see currentFieldValues). */
export async function admitFieldValues(db: D1Database, teamId: string, previous: FieldValues, next: FieldValues, issueTypeId: string | null = null, catalogue?: FieldCatalogue) {
  const changed = Object.keys(next).filter(key => !Object.hasOwn(previous, key) || canonical(previous[key]) !== canonical(next[key]))
  const { definitions, options } = catalogue ? {definitions:catalogue.definitions.filter(d=>changed.includes(d.id)),options:catalogue.options} : await namedDefinitions(db, changed)
  const values = { ...next }, checked: Record<string, string> = {}
  for (const definition of definitions) {
    const value = next[definition.id]
    if (definition.team_id !== teamId)
      throw new IssueMutationError('invalid_option', `Custom field ${definition.id} is not a field of this issue's team.`)
    if (definition.type !== 'single_select')
      throw new IssueMutationError('invalid_option', `${definition.name} values cannot be set yet.`)
    if (value === null) { delete values[definition.id]; continue }
    if (typeof value !== 'string' || !options.some(option => option.field_id === definition.id && option.id === value))
      throw new IssueMutationError('invalid_option', `${definition.name} accepts only one of its options.`)
    checked[definition.id] = value
  }
  await admitTypeRequirements(db, teamId, issueTypeId, values, catalogue)
  return { values, checked }
}
