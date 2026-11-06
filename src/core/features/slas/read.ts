import { businessMinutes } from './calendar';
import { clockRule, matches, type Clock } from './clock';
import type { SlaInput } from './schema';
/** A read never starts or advances a stored clock. Its current-time projection
 * uses the same calendar and fixed target snapshot as the real scheduler. */
export async function projectSla(db:D1Database,identifier:string,now:Date) {
  const issue=await db.prepare(`SELECT i.id,i.created_at,i.updated_at,i.archived_at,i.team_id,s.category,t.archived_at team_archived,
    r.body_json,r.created_at rule_created,w.timezone,(${matches}) matching
    FROM issues i JOIN teams t ON t.id=i.team_id JOIN workflow_statuses s ON s.id=i.status_id
    JOIN workspace_settings w ON w.id=t.workspace_id LEFT JOIN team_slas r ON r.team_id=t.id WHERE i.identifier=?`)
    .bind(identifier).first<{id:string;created_at:string;updated_at:string;archived_at:string|null;team_id:string;category:string;team_archived:string|null;body_json:string|null;rule_created:string;timezone:string;matching:number}>();
  if(!issue)return null;
  const clock=await db.prepare('SELECT * FROM issue_sla_clocks WHERE issue_id=?').bind(issue.id).first<Clock>();
  if(!clock && (!issue.body_json||!JSON.parse(issue.body_json).enabled||!issue.matching||issue.archived_at||issue.team_archived||['completed','canceled','duplicate'].includes(issue.category)))return null;
  const rule=clock?clockRule(clock):JSON.parse(issue.body_json!) as SlaInput;
  const timezone=clock?.timezone??issue.timezone;
  const stopped=clock?.stopped_at??null;
  const elapsed=(clock?.elapsed_minutes??0)+businessMinutes(clock?.observed_at??[issue.updated_at,issue.rule_created].sort().at(-1)!,stopped??now.toISOString(),rule,timezone);
  const receipts=(await db.prepare('SELECT kind,created_at FROM issue_sla_occurrences WHERE issue_id=?').bind(issue.id).all<{kind:string;created_at:string}>()).results;
  return {state:elapsed>=rule.targetMinutes?'breached':stopped?clock?.stop_reason==='resolved'?'resolved':'stopped':'running',
    remainingMinutes:Math.ceil(rule.targetMinutes-elapsed),targetMinutes:rule.targetMinutes,timezone,stoppedAt:stopped,
    warnedAt:receipts.find(r=>r.kind==='warning')?.created_at??null,breachedAt:receipts.find(r=>r.kind==='breach')?.created_at??null};
}
