import { createUlid } from '../../shared/ids'
import { administrationContext, commit, guard, audit, SettingsError } from '../administration/transaction'
import { formAuthority } from './authority'
import { formInputSchema, type FormInput, type RequestForm } from './schema'

type FormRow = { id: string; team_id: string; name: string; fields_json: string; revision: number; published: number }
export async function readForm(db: D1Database, actor: string, id: string): Promise<RequestForm> {
  const row = await db.prepare('SELECT * FROM request_forms WHERE id=?').bind(id).first<FormRow>()
  if (!row) throw new SettingsError('not_found', 'Form is unavailable.', 404)
  await formAuthority(db, actor, row.team_id)
  let canEdit = false
  try { await formAuthority(db, actor, row.team_id, true); canEdit = true } catch (e) { if (!(e instanceof SettingsError && e.status === 403)) throw e }
  if (!row.published && !canEdit) throw new SettingsError('not_found', 'Form is unavailable.', 404)
  return { ...formInputSchema.parse({ name: row.name, fields: JSON.parse(row.fields_json), published: !!row.published }), id, teamId: row.team_id, revision: row.revision, canEdit }
}
export async function listForms(db: D1Database, actor: string, teamId: string) {
  await formAuthority(db, actor, teamId)
  let canManage = false
  try { await formAuthority(db, actor, teamId, true); canManage = true } catch (e) { if (!(e instanceof SettingsError && e.status === 403)) throw e }
  const rows = (await db.prepare('SELECT id FROM request_forms WHERE team_id=? AND (published=1 OR ?=1) ORDER BY name,id').bind(teamId, Number(canManage)).all<{ id: string }>()).results
  return { forms: await Promise.all(rows.map(r => readForm(db, actor, r.id))), canManage }
}
export async function saveForm(db: D1Database, actor: string, teamId: string, input: FormInput, id?: string, expectedRevision?: number) {
  const fence = await formAuthority(db, actor, teamId, true), ctx = await administrationContext(db, actor)
  const old = id ? await readForm(db, actor, id) : null
  if (old && old.teamId !== teamId) throw new SettingsError('not_found', 'Form is unavailable.', 404)
  if (old && old.revision !== expectedRevision) throw new SettingsError('stale_form', 'The form changed. Reload before publishing.', 409)
  id ??= createUlid(new Date(ctx.at))
  const revision = old ? old.revision + 1 : 1, fields = JSON.stringify(input.fields)
  const writes = [guard(ctx.db, fence.sql, ...fence.values)]
  if (old) writes.push(guard(ctx.db, 'EXISTS(SELECT 1 FROM request_forms WHERE id=? AND revision=?)', id, expectedRevision!), ctx.db.prepare('UPDATE request_forms SET name=?,fields_json=?,published=?,revision=?,updated_at=? WHERE id=?').bind(input.name, fields, Number(input.published), revision, ctx.at, id))
  else writes.push(ctx.db.prepare('INSERT INTO request_forms(id,team_id,name,fields_json,published,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, teamId, input.name, fields, Number(input.published), revision, ctx.at, ctx.at))
  writes.push(ctx.db.prepare('INSERT INTO request_form_revisions(form_id,revision,name,fields_json,published,created_at) VALUES(?,?,?,?,?,?)').bind(id, revision, input.name, fields, Number(input.published), ctx.at), ...audit(ctx, old ? 'request_form.updated' : 'request_form.created', id, input.name, old ? { revision: old.revision } : null, { revision, published: input.published }))
  await commit(ctx, writes)
  return readForm(db, actor, id)
}
