import type { WorkerBindings } from '../../app/bindings';
import { eligibleDestination, effectsAllowed, liveRule, ownerReadsIssue } from './policy';
import { credentialProblem } from '../integrations/channels/settings';

/** Delivery never rolls back an already committed priority change. A terminal
 * refusal or unknown acknowledgement pauses the rule and sends one private
 * Inbox notice to its still-authorized owner, until an explicit repair save. */
export async function reconcileRuleDeliveries(env:WorkerBindings,now:Date) {
  const db=env.DB,at=now.toISOString();
  if(!await db.prepare('SELECT 1 WHERE '+effectsAllowed).first())return;
  const rows=(await db.prepare(`SELECT run.id,r.id rule_id,r.version,r.workspace_id,
    delivery.state delivery_state,(${eligibleDestination}) destination_live
    FROM automation_rule_runs run JOIN automation_rules r ON r.id=run.rule_id
    JOIN vector_webhook_events event ON event.id='rule:'||run.id
    LEFT JOIN integration_deliveries delivery ON delivery.namespace=r.workspace_id AND delivery.id=event.id
    WHERE run.state='succeeded' AND r.version=run.rule_version AND r.failure IS NULL
    AND NOT EXISTS(SELECT 1 FROM automation_rule_restore_holds h WHERE h.rule_id=r.id)
    AND ${liveRule()} LIMIT 100`).all<{id:string;rule_id:string;version:number;workspace_id:string;delivery_state:string|null;destination_live:number}>()).results;
  for(const row of rows) {
    const reason=!row.destination_live?'destination_unavailable':row.delivery_state==='rejected'?'delivery_rejected':row.delivery_state==='uncertain'?'delivery_uncertain':
      await credentialProblem(env,'slack:'+row.workspace_id)?'slack_needs_attention':null;
    if(!reason)continue;
    const token=crypto.randomUUID();
    await db.batch([
      db.prepare(`UPDATE automation_rule_runs SET state='failed',reason=?,completion_token=? WHERE id=? AND state='succeeded'
        AND EXISTS(SELECT 1 FROM automation_rules r WHERE r.id=automation_rule_runs.rule_id AND r.version=? AND r.failure IS NULL
        AND NOT EXISTS(SELECT 1 FROM automation_rule_restore_holds h WHERE h.rule_id=r.id) AND ${liveRule()}) AND ${effectsAllowed}`)
        .bind(reason,token,row.id,row.version),
      db.prepare(`INSERT OR IGNORE INTO notifications(id,event_id,issue_id,recipient_id,actor_id,actor_name,causes_json,created_at)
        SELECT lower(hex(randomblob(16))),'rule-failure:'||r.id||':'||r.version,i.id,r.owner_operator_id,NULL,
        'Automation rule failed: '||r.name,'["reminder"]',? FROM automation_rule_runs run JOIN automation_rules r ON r.id=run.rule_id
        JOIN issues i ON i.id=run.issue_id JOIN teams t ON t.id=i.team_id
        WHERE run.id=? AND run.completion_token=? AND r.failure_notified_at IS NULL AND ${ownerReadsIssue}`).bind(at,row.id,token),
      db.prepare(`UPDATE automation_rules SET failure=?,failure_notified_at=?,updated_at=? WHERE id=? AND version=? AND failure_notified_at IS NULL
        AND EXISTS(SELECT 1 FROM automation_rule_runs WHERE id=? AND completion_token=?)`).bind(reason,at,at,row.rule_id,row.version,row.id,token),
    ]);
  }
}
