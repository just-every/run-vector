import {reconcileRuleDeliveries} from './failures';
import { effectsAllowed, eligibleDestination, liveRule, ownerReadsIssue } from './policy';
import { channelMatches } from '../integrations/channels/delivery';
import { IntegrationError } from '../integrations/errors';
import type { WorkerBindings } from '../../app/bindings';
import type { Rule, Run } from './schema';

/** No rule-produced act is a label producer. This family cannot form a direct
 * or cross-rule cycle: only original label additions enqueue a run. */
export async function evaluateRules(env: WorkerBindings, now: Date) {
  await reconcileRuleDeliveries(env,now);
  const db = env.DB;
  if (!await db.prepare('SELECT 1 WHERE '+effectsAllowed).first()) return;
  const pending = (await db.prepare("SELECT * FROM automation_rule_runs WHERE state='pending' ORDER BY created_at,id LIMIT 100").all<Run>()).results;
  for (const run of pending) await evaluate(env,run,now);
}
async function evaluate(env: WorkerBindings, run: Run, now: Date) {
  const db = env.DB, at = now.toISOString(), month = at.slice(0,7);
  const rule = await db.prepare('SELECT * FROM automation_rules WHERE id=?').bind(run.rule_id).first<Rule>();
  if (!rule) return;
  const issue = await db.prepare('SELECT id,identifier,title,priority,version,team_id FROM issues WHERE id=?').bind(run.issue_id)
    .first<{id:string;identifier:string;title:string;priority:string;version:number;team_id:string}>();
  if (!issue) return;
  const base = `r.id=? AND r.version=? AND r.enabled=1 AND r.failure IS NULL
    AND (r.team_id IS NULL OR r.team_id=i.team_id) AND r.workspace_id=t.workspace_id
    AND i.archived_at IS NULL AND t.archived_at IS NULL
    AND EXISTS(SELECT 1 FROM issue_labels WHERE issue_id=i.id AND label_id=r.label_id)
    AND NOT EXISTS(SELECT 1 FROM automation_rule_restore_holds h WHERE h.rule_id=r.id)
    AND ${liveRule()} AND ${ownerReadsIssue} AND ${effectsAllowed}`;
  const from = 'FROM automation_rules r JOIN issues i ON i.id=? JOIN teams t ON t.id=i.team_id';
  const values = [issue.id,rule.id,run.rule_version];
  if (!await db.prepare(`SELECT 1 ${from} WHERE ${base}`).bind(...values).first()) {
    await db.prepare("UPDATE automation_rule_runs SET state='stopped',reason='rule_or_access_changed',completed_at=? WHERE id=? AND state='pending'").bind(at,run.id).run();
    return;
  }
  const body = JSON.stringify({eventKind:'automation.rule',ruleId:rule.id,ruleVersion:run.rule_version,runId:run.id,issueId:issue.id,
    identifier:issue.identifier,title:issue.title,actorId:rule.owner_operator_id,actor:'Automation: '+rule.name,change:'Set priority to '+rule.priority});
  let destination = Boolean(await db.prepare(`SELECT 1 FROM automation_rules r WHERE r.id=? AND ${eligibleDestination}`).bind(rule.id).first());
  if (destination) {
    try { destination = await channelMatches(env,rule.workspace_id,rule.destination_id,body); }
    catch (error) { if (!(error instanceof IntegrationError)) throw error; destination = false; }
  }
  const used = await db.prepare('SELECT runs FROM automation_rule_usage WHERE rule_id=? AND month=?').bind(rule.id,month).first<number>('runs') ?? 0;
  const state = used >= rule.monthly_budget ? 'budget_exhausted' : !destination ? 'failed' : 'succeeded';
  const reason = state === 'budget_exhausted' ? 'monthly_budget_exhausted' : state === 'failed' ? 'destination_unavailable' : null;
  const token = crypto.randomUUID(), changes = state === 'succeeded' && issue.priority !== rule.priority ? [{field:'priority',from:issue.priority,to:rule.priority}] : [];
  const claimed = `EXISTS(SELECT 1 FROM automation_rule_runs claim WHERE claim.id=? AND claim.completion_token=?)`;
  // The usage predicate is decided in the same batch as the once receipt. Two
  // workers and two issues racing the last slot cannot overspend the budget.
  const budget = state === 'budget_exhausted' ? '>=' : '<';
  const writes = [db.prepare(`UPDATE automation_rule_runs SET state=?,reason=?,changes_json=?,completed_at=?,completion_token=?
    WHERE id=? AND state='pending' AND EXISTS(SELECT 1 ${from} WHERE ${base} AND i.version=?
    AND COALESCE((SELECT runs FROM automation_rule_usage WHERE rule_id=r.id AND month=?),0) ${budget} r.monthly_budget
    ${state === 'succeeded' ? 'AND '+eligibleDestination : ''})`)
    .bind(state,reason,JSON.stringify(changes),at,token,run.id,...values,issue.version,month)];
  if (state !== 'budget_exhausted') writes.push(db.prepare(`INSERT INTO automation_rule_usage(rule_id,month,runs)
    SELECT ?,?,1 WHERE ${claimed} ON CONFLICT(rule_id,month) DO UPDATE SET runs=runs+1`).bind(rule.id,month,run.id,token));
  if (state === 'succeeded') {
    if (changes.length) {
      writes.push(db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)
        SELECT ?,?,?,?,'issue.updated',?,?,?,? WHERE ${claimed}`)
        .bind(run.id,issue.id,rule.owner_operator_id,'Automation: '+rule.name,JSON.stringify({priority:issue.priority}),JSON.stringify({priority:rule.priority,automationRuleId:rule.id,ownerOperatorId:rule.owner_operator_id}),at,at,run.id,token),
        db.prepare(`UPDATE issues SET priority=?,version=version+1,updated_at=? WHERE id=? AND ${claimed}`).bind(rule.priority,at,issue.id,run.id,token),
        db.prepare(`INSERT INTO audit_records(id,actor_operator_id,actor_kind,actor_reference,workspace_id,action,subject_identifier,subject_id,created_at,updated_at)
          SELECT ?,?,'automation',?,?, 'automation.rule.priority_changed',?,?,?,? WHERE ${claimed}`)
          .bind('rule:'+run.id,rule.owner_operator_id,'automation:rule:'+rule.id,rule.workspace_id,issue.identifier,issue.id,at,at,run.id,token));
    }
    writes.push(db.prepare(`INSERT OR IGNORE INTO vector_webhook_events(id,workspace_id,destination_id,event,body,created_at)
      SELECT ?,?,?,'automation.rule',?,? WHERE ${claimed}`).bind('rule:'+run.id,rule.workspace_id,rule.destination_id,body,at,run.id,token));
  }
  if (state === 'failed') {
    writes.push(db.prepare(`INSERT OR IGNORE INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
      SELECT lower(hex(randomblob(16))),?,i.id,r.owner_operator_id,NULL,'Automation rule failed: '||r.name,'["reminder"]',?
      ${from} WHERE r.id=? AND r.failure_notified_at IS NULL AND ${claimed} AND ${ownerReadsIssue}`)
      .bind('rule-failure:'+rule.id+':'+rule.version,at,issue.id,rule.id,run.id,token),
      db.prepare(`UPDATE automation_rules SET failure=?,failure_notified_at=?,updated_at=? WHERE id=? AND failure_notified_at IS NULL AND ${claimed}`)
        .bind(reason,at,at,rule.id,run.id,token));
  }
  await db.batch(writes);
}
