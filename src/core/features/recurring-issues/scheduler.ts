import { createUlid } from '../../shared/ids'
import { mutationDatabase } from '../auth/mutation-database'
import { visibilityDatabase } from '../roles/visibility-database'
import { guard } from '../administration/transaction'
import { planIssueFromTemplate } from '../issue-templates/application'
import { recurringFence,seriesGuard,effectsAllowed } from './authority'
import { dueWeek,addDays } from './calendar'
import type { SeriesRow } from './schema'

const previousOpen=`EXISTS(SELECT 1 FROM main.issues i JOIN main.workflow_statuses s ON s.id=i.status_id
  WHERE i.id=? AND s.category NOT IN('completed','canceled','duplicate'))`
function receipt(db:D1Database,row:SeriesRow,day:string,scheduledAt:string,outcome:string,issueId:string|null,children:string[],error:string|null,at:string) {
  return db.prepare(`INSERT INTO recurring_issue_occurrences(series_id,due_on,scheduled_at,template_id,template_version,outcome,issue_id,child_ids_json,error,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(series_id,due_on) DO UPDATE SET outcome=excluded.outcome,issue_id=excluded.issue_id,
    child_ids_json=excluded.child_ids_json,error=excluded.error,created_at=excluded.created_at WHERE recurring_issue_occurrences.outcome='failed'`)
    .bind(row.id,day,scheduledAt,row.template_id,row.template_version,outcome,issueId,JSON.stringify(children),error,at)
}
function automationAudit(db:D1Database,row:SeriesRow,outcome:string,at:string) {
  return db.prepare("INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at) VALUES(?,NULL,?,?,?,?,?)")
    .bind(createUlid(new Date(at)),'recurring_issue.'+outcome,row.id,row.id,at,at)
}
/** A receipt and the complete native graph commit together. Conditional series
 * and authority fences make competing ticks losers without publishing partial work. */
export async function runRecurringIssues(env:{DB:D1Database},now=new Date()) {
  const raw=env.DB,at=now.toISOString()
  if(!await raw.prepare('SELECT ('+effectsAllowed+') allowed').first<number>('allowed'))return
  // Rotate failed attempts behind older work; future series cannot fill the due batch.
  const rows=(await raw.prepare(`SELECT s.* FROM recurring_issue_series s JOIN recurring_issue_activations a ON a.series_id=s.id
    WHERE s.state='enabled' AND s.next_on<=? ORDER BY s.updated_at,s.id LIMIT 100`).bind(addDays(at.slice(0,10),1)).all<SeriesRow>()).results
  for(const row of rows) {
    let due:ReturnType<typeof dueWeek>
    try{due=dueWeek(row,now)}catch{
      // A future civil boundary can cease to exist after timezone rule changes.
      // Leave the series inert and report a symbolic error without guessing a time.
      try {
        await raw.batch([seriesGuard(raw,row),raw.prepare("UPDATE recurring_issue_series SET last_error='calendar_unavailable',updated_at=? WHERE id=?").bind(at,row.id)])
      }catch(conflict){
        if(!/administration conflict|malformed JSON/.test(String(conflict)))throw conflict
      }
      continue
    }
    if(!due)continue
    const scoped=visibilityDatabase(raw,row.configuring_operator_id)
    const db=mutationDatabase(scoped,row.configuring_operator_id)
    try {
      const fence=await recurringFence(db,row.configuring_operator_id,row.team_id)
      const open=!!(row.skip_while_open&&row.last_issue_id&&await raw.prepare('SELECT ('+previousOpen+') open').bind(row.last_issue_id).first<number>('open'))
      const writes=[seriesGuard(db,row),guard(db,fence.sql,...fence.values),
        guard(db,'NOT EXISTS(SELECT 1 FROM recurring_issue_occurrences WHERE series_id=? AND due_on=? AND outcome<>\'failed\')',row.id,due.day)]
      if(row.skip_while_open&&row.last_issue_id)writes.push(guard(db,(open?'':'NOT ')+previousOpen,row.last_issue_id))
      let issueId:string|null=null,children:string[]=[]
      if(!open) {
        const overrides=JSON.parse(row.overrides_json)
        const plan=await planIssueFromTemplate(db,row.configuring_operator_id,{
          ...overrides,teamId:row.team_id,templateId:row.template_id,templateVersion:row.template_version,
          ...(row.due_offset_days===null?{}:{dueDate:addDays(due.day,row.due_offset_days)}),
        },now)
        issueId=plan.parent.issueId;children=plan.children.map(child=>child.issueId)
        writes.push(...plan.writes)
      }
      const outcome=open?'skipped':'created'
      writes.push(receipt(db,row,due.day,due.at,outcome,issueId,children,null,at),
        db.prepare('UPDATE recurring_issue_series SET next_on=?,last_issue_id=COALESCE(?,last_issue_id),last_error=NULL,updated_at=? WHERE id=?').bind(due.next,issueId,at,row.id),
        automationAudit(db,row,outcome,at))
      await db.batch(writes)
    } catch(error) {
      // A competing tick or a pause that won the transaction owns the outcome.
      const current=await raw.prepare('SELECT state,version,next_on FROM recurring_issue_series WHERE id=?').bind(row.id).first<SeriesRow>()
      if(!current||current.state!=='enabled'||current.version!==row.version||current.next_on!==row.next_on)continue
      if(await raw.prepare("SELECT 1 FROM recurring_issue_occurrences WHERE series_id=? AND due_on=? AND outcome<>'failed'").bind(row.id,due.day).first())continue
      const code=error&&typeof error==='object'&&'code' in error?String(error.code):'creation_failed'
      const safe=['stale_template','not_found','forbidden','invalid_option','invalid_request'].includes(code)?code:'creation_failed'
      try {
        // Failure is visible history, never a successful creation receipt.
        await raw.batch([seriesGuard(raw,row),receipt(raw,row,due.day,due.at,'failed',null,[],safe,at),
          raw.prepare('UPDATE recurring_issue_series SET last_error=?,updated_at=? WHERE id=?').bind(safe,at,row.id)])
      }catch(conflict){
        if(!/administration conflict|malformed JSON/.test(String(conflict)))throw conflict
      }
    }
  }
}
