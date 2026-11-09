import { effectsAllowed } from './policy';
/** Called inside the label writer's batch, after its guarded activity. Only
 * actual additions are passed. No import, archive restore or Undo calls this.
 * An automation act is deliberately not a producer, even for another rule. */
export function labelAddedStatements(db: D1Database, event: { id: string; issueId: string; actor: string; at: string }, added: string[]) {
  if (!added.length) return [];
  return [db.prepare(`INSERT OR IGNORE INTO automation_rule_runs
    (id,rule_id,rule_version,event_id,issue_id,state,changes_json,created_at)
    SELECT ?||':'||r.id,r.id,r.version,?,i.id,'pending','[]',?
    FROM automation_rules r JOIN issues i ON i.id=? JOIN teams t ON t.id=i.team_id
    WHERE r.workspace_id=t.workspace_id AND (r.team_id IS NULL OR r.team_id=i.team_id)
    AND r.enabled=1 AND r.failure IS NULL AND r.label_id IN(SELECT value FROM json_each(?))
    AND NOT EXISTS(SELECT 1 FROM automation_rule_restore_holds h WHERE h.rule_id=r.id)
    AND EXISTS(SELECT 1 FROM issue_activity a WHERE a.id=? AND a.issue_id=i.id AND a.actor_operator_id=?
      AND a.kind IN ('issue.created','issue.updated','issue.copied_from','label.merged')
      AND json_extract(a.next_value_json,'$.automationRuleId') IS NULL)
    AND ${effectsAllowed}`).bind(event.id,event.id,event.at,event.issueId,JSON.stringify(added),event.id,event.actor)];
}

/** Label consolidation is a real addition only when the destination was absent
 * in the merge's recorded previous set. The same activity supplies once identity. */
export function labelMergedStatements(db:D1Database,actor:string,at:string,destination:string) {
  return [db.prepare(`INSERT OR IGNORE INTO automation_rule_runs
    (id,rule_id,rule_version,event_id,issue_id,state,changes_json,created_at)
    SELECT a.id||':'||r.id,r.id,r.version,a.id,i.id,'pending','[]',a.created_at
    FROM issue_activity a JOIN issues i ON i.id=a.issue_id JOIN teams t ON t.id=i.team_id
    JOIN automation_rules r ON r.workspace_id=t.workspace_id AND (r.team_id IS NULL OR r.team_id=i.team_id)
    WHERE a.kind='label.merged' AND a.actor_operator_id=? AND a.created_at=? AND r.label_id=?
    AND EXISTS(SELECT 1 FROM json_each(a.next_value_json,'$.labelIds') WHERE value=r.label_id)
    AND NOT EXISTS(SELECT 1 FROM json_each(a.previous_value_json,'$.labelIds') WHERE value=r.label_id)
    AND r.enabled=1 AND r.failure IS NULL
    AND NOT EXISTS(SELECT 1 FROM automation_rule_restore_holds h WHERE h.rule_id=r.id)
    AND ${effectsAllowed}`).bind(actor,at,destination)];
}
