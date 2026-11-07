import { createUlid } from '../../shared/ids'
import { administrationContext, audit, commit, guard, SettingsError, type AdministrationContext } from '../administration/transaction'
import { fieldManagementFence } from './authority'
import { planOptions } from './options'
import type { FieldCreateInput, FieldUpdateInput } from './schema'

type Stored = { id: string; name: string; description: string; type: string; version: number }
const insertOption = 'INSERT INTO custom_field_options(id,field_id,name,position,created_at,updated_at) VALUES(?,?,?,?,?,?)'

/** The team as the reader sees it now: hidden and other-workspace teams are absent. */
async function activeTeam(ctx: AdministrationContext, teamId: string) {
  const team = await ctx.db.prepare('SELECT archived_at FROM teams WHERE id=? AND workspace_id=?').bind(teamId, ctx.workspace).first<{ archived_at: string | null }>()
  if (!team) throw new SettingsError('not_found', 'Team is unavailable.', 404)
  if (team.archived_at) throw new SettingsError('team_archived', 'Unarchive this team before changing its fields.', 409)
}

/** A name is unique in its team, whatever its letter case; the unique index decides races. */
async function availableName(ctx: AdministrationContext, teamId: string, name: string, except: string | null = null) {
  if (await ctx.db.prepare('SELECT 1 FROM main.custom_field_definitions WHERE team_id=? AND name=? COLLATE NOCASE AND id IS NOT ?').bind(teamId, name, except).first())
    throw new SettingsError('field_name_taken', `This team already has a field named ${name}.`, 409)
}

export async function createField(db: D1Database, actor: string, teamId: string, input: FieldCreateInput) {
  const ctx = await administrationContext(db, actor)
  const fence = await fieldManagementFence(ctx.db, actor, teamId)
  await activeTeam(ctx, teamId)
  await availableName(ctx, teamId, input.name)
  const id = createUlid(new Date(ctx.at))
  const options = input.options.map((option, position) => ({ id: createUlid(new Date(ctx.at)), name: option.name, position }))
  await commit(ctx, [
    guard(ctx.db, fence.sql, ...fence.values),
    guard(ctx.db, 'EXISTS(SELECT 1 FROM main.teams WHERE id=? AND workspace_id=? AND archived_at IS NULL)', teamId, ctx.workspace),
    ctx.db.prepare('INSERT INTO custom_field_definitions(id,workspace_id,team_id,name,description,type,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(id, ctx.workspace, teamId, input.name, input.description, input.type, ctx.at, ctx.at),
    ...options.map(option => ctx.db.prepare(insertOption).bind(option.id, id, option.name, option.position, ctx.at, ctx.at)),
    ...audit(ctx, 'custom_field.created', id, input.name, null,
      { teamId, name: input.name, description: input.description, type: input.type, options: options.map(({ id, name }) => ({ id, name })) }),
  ])
  return id
}

/** Renames the field or its options, edits its description or adds options. No stored
 * issue value changes: values name option identities, never option names. */
export async function updateField(db: D1Database, actor: string, teamId: string, fieldId: string, input: FieldUpdateInput) {
  const ctx = await administrationContext(db, actor)
  const fence = await fieldManagementFence(ctx.db, actor, teamId)
  await activeTeam(ctx, teamId)
  const field = await ctx.db.prepare('SELECT id,name,description,type,version FROM custom_field_definitions WHERE id=? AND team_id=?').bind(fieldId, teamId).first<Stored>()
  if (!field) throw new SettingsError('not_found', 'Field is unavailable.', 404)
  if (field.version !== input.expectedVersion) throw new SettingsError('stale_field', 'This field changed. Reload it before saving again.', 409)
  const stored = (await ctx.db.prepare('SELECT id,name,position FROM custom_field_options WHERE field_id=? ORDER BY position,id').bind(fieldId)
    .all<{ id: string; name: string; position: number }>()).results
  const options = input.options ? planOptions(stored, input.options) : { renamed: [], added: [] }
  const name = input.name ?? field.name, description = input.description ?? field.description
  if (name !== field.name) await availableName(ctx, teamId, name, fieldId)
  if (name === field.name && description === field.description && !options.renamed.length && !options.added.length) return
  const added = options.added.map(option => ({ ...option, id: createUlid(new Date(ctx.at)) }))
  await commit(ctx, [
    guard(ctx.db, fence.sql, ...fence.values),
    guard(ctx.db, `EXISTS(SELECT 1 FROM main.custom_field_definitions d JOIN main.teams t ON t.id=d.team_id
      WHERE d.id=? AND d.team_id=? AND d.version=? AND t.archived_at IS NULL)`, fieldId, teamId, field.version),
    ctx.db.prepare('UPDATE custom_field_definitions SET name=?,description=?,version=version+1,updated_at=? WHERE id=?').bind(name, description, ctx.at, fieldId),
    ...options.renamed.map(option => ctx.db.prepare('UPDATE custom_field_options SET name=?,updated_at=? WHERE id=? AND field_id=?').bind(option.to, ctx.at, option.id, fieldId)),
    ...added.map(option => ctx.db.prepare(insertOption).bind(option.id, fieldId, option.name, option.position, ctx.at, ctx.at)),
    ...audit(ctx, 'custom_field.updated', fieldId, name,
      { name: field.name, description: field.description, version: field.version, options: options.renamed.map(({ id, from }) => ({ id, name: from })) },
      { name, description, version: field.version + 1, options: [...options.renamed.map(({ id, to }) => ({ id, name: to })), ...added.map(({ id, name }) => ({ id, name }))] }),
  ])
}
