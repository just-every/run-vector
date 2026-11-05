import { createUlid } from '../../shared/ids'
import { administrationContext,commit,guard,audit,SettingsError } from '../administration/transaction'
import { readTemplate } from '../issue-templates/repository'
import { propertyGuards } from '../issue-templates/properties'
import { createIssueInputSchema } from '../issues/input'
import { recurringFence } from './authority'
import { localTimeToInstant } from '../administration/calendar'
import type { SeriesInput,SeriesRow } from './schema'

export async function readSeriesRow(db:D1Database,actor:string,id:string) {
  const row=await db.prepare(`SELECT s.* FROM recurring_issue_series s JOIN teams visible ON visible.id=s.team_id JOIN operators o ON o.workspace_id=s.workspace_id AND o.id=? AND o.removed_at IS NULL WHERE s.id=?`).bind(actor,id).first<SeriesRow>()
  if(!row)throw new SettingsError('not_found','Recurring issue is unavailable.',404)
  await recurringFence(db,actor,row.team_id)
  return row
}
export async function readSeries(db:D1Database,actor:string,id:string) {
  const row=await readSeriesRow(db,actor,id)
  const overrides=JSON.parse(row.overrides_json)
  for(const [key,table] of [['projectId','projects'],['statusId','workflow_statuses']] as const) {
    const value=overrides[key]
    if(value&&await db.prepare('SELECT 1 FROM main.'+table+' WHERE id=?').bind(value).first()&&!await db.prepare('SELECT 1 FROM '+table+' WHERE id=?').bind(value).first())
      throw new SettingsError('not_found','Recurring issue is unavailable.',404)
  }
  const receipts=(await db.prepare('SELECT * FROM recurring_issue_occurrences WHERE series_id=? ORDER BY due_on DESC LIMIT 100').bind(id).all<{due_on:string;scheduled_at:string;outcome:string;issue_id:string|null;child_ids_json:string;error:string|null;created_at:string}>()).results
  const history=[]
  for(const receipt of receipts) {
    // A retained receipt confers no access to an issue subsequently moved or erased.
    const issue=receipt.issue_id?await db.prepare('SELECT id,identifier,title FROM issues WHERE id=?').bind(receipt.issue_id).first():null
    const children=(await db.prepare('SELECT id,identifier,title FROM issues WHERE id IN(SELECT value FROM json_each(?)) ORDER BY id').bind(receipt.child_ids_json).all()).results
    history.push({dueOn:receipt.due_on,scheduledAt:receipt.scheduled_at,outcome:receipt.outcome,issue,children,error:receipt.error,at:receipt.created_at})
  }
  return {id:row.id,name:row.name,teamId:row.team_id,configuringPersonId:row.configuring_operator_id,
    templateId:row.template_id,templateVersion:row.template_version,cadence:'weekly' as const,
    timezone:row.timezone,startsOn:row.starts_on,nextOn:row.next_on,dueOffsetDays:row.due_offset_days,
    skipWhileOpen:Boolean(row.skip_while_open),overrides,
    state:row.state,version:row.version,lastError:row.last_error,
    restoreHeld:!await db.prepare('SELECT 1 FROM recurring_issue_activations WHERE series_id=?').bind(id).first(),history}
}
export async function listSeries(db:D1Database,actor:string) {
  const rows=(await db.prepare('SELECT s.id FROM recurring_issue_series s JOIN operators o ON o.workspace_id=s.workspace_id AND o.id=? AND o.removed_at IS NULL ORDER BY s.created_at,s.id').bind(actor).all<{id:string}>()).results
  const series=[]
  for(const row of rows)try{series.push(await readSeries(db,actor,row.id))}catch(e){if(!(e instanceof SettingsError&&[403,404].includes(e.status)))throw e}
  return {series}
}
export async function createSeries(db:D1Database,actor:string,input:SeriesInput) {
  const fence=await recurringFence(db,actor,input.teamId),ctx=await administrationContext(db,actor)
  const template=await readTemplate(db,actor,input.templateId)
  if(template.version!==input.templateVersion)throw new SettingsError('stale_template','Template changed. Choose it again.',409)
  if(template.teamId&&template.teamId!==input.teamId)throw new SettingsError('invalid_request','Choose the template’s team.',400)
  const zone=await db.prepare('SELECT timezone FROM workspace_settings WHERE id=?').bind(ctx.workspace).first<string>('timezone')
  if(!zone)throw new SettingsError('invalid_request','Workspace timezone is unavailable.',400)
  try{localTimeToInstant(input.startsOn+'T00:00',zone)}catch{throw new SettingsError('invalid_request','Choose an unambiguous calendar date in the workspace timezone.',400)}
  createIssueInputSchema.parse({...template.defaults,...input.overrides,teamId:input.teamId})
  const checks=await propertyGuards(ctx.db,{...template,teamId:input.teamId,defaults:{...template.defaults,...input.overrides}},ctx.workspace)
  const id=createUlid(new Date(ctx.at))
  await commit(ctx,[guard(ctx.db,fence.sql,...fence.values),
    guard(ctx.db,'EXISTS(SELECT 1 FROM issue_templates WHERE id=? AND version=?)',template.id,template.version),
    guard(ctx.db,'EXISTS(SELECT 1 FROM workspace_settings WHERE id=? AND timezone=?)',ctx.workspace,zone),...checks,
    ctx.db.prepare(`INSERT INTO recurring_issue_series(id,workspace_id,configuring_operator_id,team_id,template_id,template_version,name,timezone,starts_on,next_on,due_offset_days,skip_while_open,overrides_json,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,ctx.workspace,actor,input.teamId,input.templateId,input.templateVersion,input.name,zone,input.startsOn,input.startsOn,input.dueOffsetDays,Number(input.skipWhileOpen),JSON.stringify(input.overrides),ctx.at,ctx.at),
    ctx.db.prepare('INSERT INTO recurring_issue_activations(series_id) VALUES(?)').bind(id),
    ...audit(ctx,'recurring_issue.created',id,input.name,null,{teamId:input.teamId,templateId:template.id,templateVersion:template.version,timezone:zone,startsOn:input.startsOn})])
  return readSeries(db,actor,id)
}
export async function stopSeries(db:D1Database,actor:string,id:string,input:{expectedVersion:number;state:'paused'|'ended'}) {
  const old=await readSeriesRow(db,actor,id),fence=await recurringFence(db,actor,old.team_id),ctx=await administrationContext(db,actor)
  if(old.state==='ended')throw new SettingsError('series_ended','This series has ended.',409)
  await commit(ctx,[guard(ctx.db,fence.sql,...fence.values),
    guard(ctx.db,"EXISTS(SELECT 1 FROM recurring_issue_series WHERE id=? AND version=? AND state<>'ended')",id,input.expectedVersion),
    ctx.db.prepare('UPDATE recurring_issue_series SET state=?,version=version+1,updated_at=? WHERE id=?').bind(input.state,ctx.at,id),
    ...audit(ctx,'recurring_issue.'+input.state,id,old.name,{state:old.state},{state:input.state})])
  return readSeries(db,actor,id)
}
