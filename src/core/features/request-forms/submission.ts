import { SettingsError } from '../settings/repository'
import { guard } from '../administration/transaction'
import { readForm } from './repository'
import type { FormSubmission } from './schema'

/** Validate before allocating an identifier, and fence the definition again in
 * the native intake transaction. Answers are form-local, never issue fields. */
export async function prepareFormSubmission(db: D1Database, actor: string, teamId: string, input?: FormSubmission) {
  if (!input) return null
  const form = await readForm(db, actor, input.id)
  if (form.teamId !== teamId || !form.published) throw new SettingsError('not_found', 'Form is unavailable.', 404)
  if (form.revision !== input.revision) throw new SettingsError('stale_form', 'The form changed. Reload and review its current fields.', 409)
  const fields = new Map(form.fields.map(f => [f.key, f]))
  for (const key of Object.keys(input.answers)) if (!fields.has(key)) throw new SettingsError('invalid_answers', 'An answer does not belong to this form.', 400)
  for (const field of form.fields) {
    const value = input.answers[field.key], empty = value === undefined || value === null || (typeof value === 'string' && !value.trim())
    if (empty) { if (field.required) throw new SettingsError('required_answer', field.label + ' is required.', 400); continue }
    const valid = field.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : field.type === 'boolean' ? typeof value === 'boolean' : typeof value === 'string' && (field.type !== 'choice' || field.choices.includes(value))
    if (!valid) throw new SettingsError('invalid_answers', 'Choose a valid answer for ' + field.label + '.', 400)
  }
  return {
    guard: (transaction: D1Database) => guard(transaction, 'EXISTS(SELECT 1 FROM request_forms WHERE id=? AND team_id=? AND revision=? AND published=1)', form.id, teamId, form.revision),
    statements: (transaction: D1Database, issueId: string, at: string) => [transaction.prepare('INSERT INTO request_form_submissions(issue_id,form_id,revision,form_name,fields_json,answers_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(issueId, form.id, form.revision, form.name, JSON.stringify(form.fields), JSON.stringify(input.answers), at)],
  }
}
export type SubmissionRow = { id: string; revision: number; name: string; fields_json: string; answers_json: string }
export const formSubmissionStatement = (db: D1Database, issueId: string) => db.prepare('SELECT form_id AS id,revision,form_name AS name,fields_json,answers_json FROM request_form_submissions WHERE issue_id=?').bind(issueId)
export function formSubmissionProjection(row?: SubmissionRow) {
  return row ? { id: row.id, revision: row.revision, name: row.name, fields: JSON.parse(row.fields_json), answers: JSON.parse(row.answers_json) } : null
}
