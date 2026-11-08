import { createUlid } from '../../shared/ids'
import { administrationContext, audit, commit, guard, SettingsError } from '../administration/transaction'
import { typeManagementFence } from './authority'
import { disabledTypeHistory } from './history'
import { readTeamTypes } from './read'
import type { TypeUpdate } from './schema'
import { typeMutationError } from './requirements'
const defaults = [['bug','Bug','🐛'],['feature','Feature','✨'],['task','Task','☑️'],['epic','Epic','⚡']] as const
async function context(db: D1Database, actor: string, teamId: string) {
 const ctx = await administrationContext(db, actor), fence = await typeManagementFence(ctx.db,actor,teamId)
 const team = await ctx.db.prepare('SELECT name,issue_types_enabled FROM teams WHERE id=? AND workspace_id=? AND archived_at IS NULL').bind(teamId,ctx.workspace).first<{name:string;issue_types_enabled:number}>()
 if (!team) throw new SettingsError('not_found','Choose an active team in this workspace.',404)
 return {ctx,team,writes:[guard(ctx.db,fence.sql,...fence.values),guard(ctx.db,'EXISTS(SELECT 1 FROM main.teams WHERE id=? AND workspace_id=? AND archived_at IS NULL)',teamId,ctx.workspace)]}
}
export async function enableTypes(db: D1Database, actor: string, teamId: string, enabled: boolean) {
 const {ctx,team,writes} = await context(db,actor,teamId)
 if (Boolean(team.issue_types_enabled) === enabled) return
 const before = await readTeamTypes(ctx.db,teamId)
 if (enabled && !before.types.length) for (const [position,[key,name,icon]] of defaults.entries()) {
  const id=createUlid(new Date(ctx.at))
  writes.push(ctx.db.prepare('INSERT INTO issue_types(id,team_id,default_key,name,icon,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,teamId,key,name,icon,position,ctx.at,ctx.at))
  // An existing FIELD-001 Severity definition is the Bug requirement, by stable ID.
  if (key === 'bug') writes.push(ctx.db.prepare(`INSERT INTO issue_type_required_fields(type_id,field_id)
   SELECT ?,id FROM custom_field_definitions WHERE team_id=? AND name='Severity' COLLATE NOCASE AND type='single_select'`).bind(id,teamId))
 }
 writes.push(guard(ctx.db,'EXISTS(SELECT 1 FROM main.teams WHERE id=? AND issue_types_enabled=?)',teamId,team.issue_types_enabled))
 if (!enabled) writes.push(disabledTypeHistory(ctx.db,teamId,actor,ctx.at,createUlid(new Date(ctx.at))))
 writes.push(ctx.db.prepare('UPDATE teams SET issue_types_enabled=?,updated_at=? WHERE id=?').bind(Number(enabled),ctx.at,teamId),...audit(ctx,'issue_types.enabled',teamId,team.name,{enabled:before.enabled},{enabled}))
 await commit(ctx,writes)
}
export async function updateType(db: D1Database, actor: string, teamId: string, id: string, input: TypeUpdate) {
 const {ctx,writes} = await context(db,actor,teamId)
 const previous = (await readTeamTypes(ctx.db,teamId)).types.find(type=>type.id===id)
 if (!previous) throw new SettingsError('not_found','Issue type is unavailable.',404)
 if (input.expectedVersion !== previous.version) throw new SettingsError('stale_type','This type changed. Reload before saving.',409)
 const next = {...previous,...input,requiredFieldIds:input.requiredFieldIds??previous.requiredFieldIds}
 for (const field of next.requiredFieldIds) if (!await ctx.db.prepare("SELECT 1 FROM main.custom_field_definitions WHERE id=? AND team_id=? AND type='single_select'").bind(field,teamId).first())
  throw new SettingsError('invalid_field','Choose a single-select field of this team.',400)
 writes.push(guard(ctx.db,'EXISTS(SELECT 1 FROM main.issue_types WHERE id=? AND team_id=? AND version=?)',id,teamId,previous.version),
  ctx.db.prepare('UPDATE issue_types SET name=?,icon=?,version=version+1,updated_at=? WHERE id=?').bind(next.name,next.icon,ctx.at,id),
  ctx.db.prepare('DELETE FROM issue_type_required_fields WHERE type_id=?').bind(id),
  ...next.requiredFieldIds.map(field=>ctx.db.prepare('INSERT INTO issue_type_required_fields(type_id,field_id) VALUES(?,?)').bind(id,field)),
  ...audit(ctx,'issue_type.updated',id,next.name,previous,next))
 try { await commit(ctx,writes) } catch(error) {
  if (typeMutationError(error)) throw new SettingsError('invalid_field','Every issue of this type must already have a value for each required field.',400)
  throw error
 }
}
