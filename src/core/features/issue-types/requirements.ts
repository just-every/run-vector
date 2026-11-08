import { IssueMutationError } from '../issues/errors'
import type { FieldCatalogue, FieldValues } from '../custom-fields/validation'

/** The predicate uses the final type and final full field map, never a patch.
 * Bind type ID, full JSON and team ID, in that order. */
export const currentTypeRequirements = `NOT EXISTS(SELECT 1 FROM main.issue_type_required_fields r
 WHERE r.type_id=? AND NOT EXISTS(SELECT 1 FROM json_each(?) v
 JOIN main.custom_field_options o ON o.field_id=v.key AND o.id=v.value
 JOIN main.custom_field_definitions d ON d.id=o.field_id
 WHERE r.field_id=d.id AND d.team_id=?))`

/** Called only inside FIELD-001's shared typed-value admission. */
export async function admitTypeRequirements(db: D1Database, teamId: string, typeId: string | null, values: FieldValues, catalogue?: FieldCatalogue) {
 if (!typeId) return
 if (catalogue) {
  if (!catalogue.types.some(t=>t.id===typeId && t.team_id===teamId && t.enabled===1))
   throw new IssueMutationError('invalid_option','Choose an enabled type of this issue’s team.')
  const missing=catalogue.requirements.filter(r=>r.type_id===typeId && !catalogue.options.some(o=>o.field_id===r.field_id && o.id===values[r.field_id]))
  if (missing.length) throw new IssueMutationError('invalid_option','This issue type requires: '+missing.map(r=>r.name).join(', ')+'.')
  return
 }
 const type = await db.prepare('SELECT 1 FROM main.issue_types WHERE id=? AND team_id=?').bind(typeId, teamId).first()
 if (!type) throw new IssueMutationError('invalid_option', 'Choose a type of this issue’s team.')
 const missing = await db.prepare(`SELECT d.name FROM main.issue_type_required_fields r
 JOIN main.custom_field_definitions d ON d.id=r.field_id WHERE r.type_id=? AND NOT EXISTS(
 SELECT 1 FROM json_each(?) v JOIN main.custom_field_options o ON o.field_id=v.key AND o.id=v.value
 WHERE v.key=d.id AND d.team_id=?)`).bind(typeId, JSON.stringify(values), teamId).all<{ name: string }>()
 if (missing.results.length) throw new IssueMutationError('invalid_option', 'This issue type requires: ' + missing.results.map(row => row.name).join(', ') + '.')
}
export function typeMutationError(error: unknown) {
 if (/issue_type_(required_field|unavailable)/.test(String(error)))
  return new IssueMutationError('invalid_option', /required_field/.test(String(error)) ? 'A required custom field is empty or unavailable.' : 'This issue type is unavailable. Enable types in team Settings and choose a type of this team.')
 return null
}
export async function admitTypeSelection(db: D1Database, teamId: string, previous: string | null, next: string | null) {
 if (previous === next && next === null) return
 if (next && !await db.prepare('SELECT 1 FROM main.issue_types WHERE id=? AND team_id=?').bind(next, teamId).first())
  throw new IssueMutationError('invalid_option', 'Choose a type of this issue’s team.')
 if (next !== previous && !await db.prepare('SELECT 1 FROM main.teams WHERE id=? AND issue_types_enabled=1').bind(teamId).first())
  throw new IssueMutationError('invalid_option', 'Enable issue types in team Settings before changing an issue’s type.')
}
