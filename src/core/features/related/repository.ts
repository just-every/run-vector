import { activityRow } from '../issues/repository';
import { DependencyError } from '../dependencies/errors';
import { requireDependencyPair, type DependencyOperation } from '../dependencies/repository';
import type { DependencyInput } from '../dependencies/input';

export function relatedIssuesStatement(db: D1Database, id: string) {
  return db.prepare(`SELECT i.identifier,i.title FROM issue_relations r JOIN issues i
    ON i.id=CASE WHEN r.first_issue_id=? THEN r.second_issue_id ELSE r.first_issue_id END
    WHERE r.first_issue_id=? OR r.second_issue_id=? ORDER BY i.identifier`).bind(id,id,id);
}

/** Symmetric, versioned links; the receipt admits both endpoints atomically. */
export async function mutateRelatedRecord(db:D1Database,identifier:string,actor:string,input:DependencyInput,operation:DependencyOperation):Promise<'written'|'stale'> {
  const {issue,relatedIssue}=await requireDependencyPair(db,identifier,input.relatedIdentifier,actor);
  if(issue.id===relatedIssue.id)throw new DependencyError('self_dependency','An issue cannot relate to itself.',409);
  if(issue.version!==input.expectedVersion||relatedIssue.version!==input.relatedVersion)return 'stale';
  const at=new Date().toISOString(),kind=operation==='add'?'issue.related_added':'issue.related_removed';
  const relation={relatedIdentifier:relatedIssue.identifier},reverse={relatedIdentifier:issue.identifier};
  const event=activityRow({issueId:issue.id,actorOperatorId:actor,kind,previousValue:operation==='remove'?relation:null,nextValue:operation==='add'?relation:null,now:at});
  const other=activityRow({issueId:relatedIssue.id,actorOperatorId:actor,kind,previousValue:operation==='remove'?reverse:null,nextValue:operation==='add'?reverse:null,now:at});
  const pair='((first_issue_id=? AND second_issue_id=?) OR (first_issue_id=? AND second_issue_id=?))';
  const pairValues=[issue.id,relatedIssue.id,relatedIssue.id,issue.id];
  const receipt='EXISTS(SELECT 1 FROM issue_activity WHERE id=?)';
  const writes=await db.batch([
    db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at)
      SELECT ?,i.id,?,?,?,?,?,? FROM issues i JOIN teams it ON it.id=i.team_id
      JOIN issues r ON r.id=? JOIN teams rt ON rt.id=r.team_id JOIN operators actor ON actor.id=?
      WHERE i.id=? AND i.version=? AND r.version=? AND actor.removed_at IS NULL
      AND it.workspace_id=actor.workspace_id AND rt.workspace_id=actor.workspace_id
      AND ${operation==='add'?'NOT ':''}EXISTS(SELECT 1 FROM issue_relations WHERE ${pair})`)
      .bind(event.id,actor,kind,event.previousValueJson,event.nextValueJson,at,at,relatedIssue.id,actor,issue.id,input.expectedVersion,input.relatedVersion,...pairValues),
    operation==='add'
      ?db.prepare(`INSERT INTO issue_relations(first_issue_id,second_issue_id,created_at) SELECT ?,?,? WHERE ${receipt}`).bind(issue.id,relatedIssue.id,at,event.id)
      :db.prepare(`DELETE FROM issue_relations WHERE ${pair} AND ${receipt}`).bind(...pairValues,event.id),
    db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,kind,previous_value_json,next_value_json,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE ${receipt}`)
      .bind(other.id,relatedIssue.id,actor,kind,other.previousValueJson,other.nextValueJson,at,at,event.id),
    db.prepare(`UPDATE issues SET version=version+1,updated_at=? WHERE id IN (?,?) AND ${receipt}`).bind(at,issue.id,relatedIssue.id,event.id),
  ]);
  if(writes[0].meta.changes===1)return 'written';
  const current=await requireDependencyPair(db,identifier,input.relatedIdentifier,actor);
  if(current.issue.version!==input.expectedVersion||current.relatedIssue.version!==input.relatedVersion)return 'stale';
  throw new DependencyError(operation==='add'?'related_exists':'related_not_found',operation==='add'?'These issues are already related.':'This related link no longer exists.',409);
}
