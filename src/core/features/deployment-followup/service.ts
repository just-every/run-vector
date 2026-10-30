import {createUlid} from '../../shared/ids';
import {deploymentQuestionStatements,finalizeEvent,visibleRecipient} from '../notifications/events';
import {provenStatement,reconcileProductionStatement} from './watches';

// Restores, held restore effects and archive application ask nothing.
const quiet=`NOT EXISTS(SELECT 1 FROM vector_restore_status WHERE effects_held=1) AND NOT EXISTS(SELECT 1 FROM vector_http_restore)
 AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE applying=1)`;
// A watch is due once its team's explicit window has passed since GitHub's
// merge time, for merges received after the window was turned on, while its
// repository connection is current.
const due=`w.asked_at IS NULL AND w.production_at IS NULL AND f.window_hours IS NOT NULL
 AND julianday(w.recorded_at)>=julianday(f.enabled_at) AND julianday(?)>=julianday(w.merged_at)+f.window_hours/24.0
 AND t.archived_at IS NULL AND i.archived_at IS NULL AND s.category NOT IN ('canceled','duplicate')
 AND r.enabled=1 AND r.revoked_at IS NULL AND ${quiet}`;
// Only an issue's current assignee who can read it is asked; other due merges
// keep waiting without occupying a run's limit.
const watched=`FROM deployment_followup_watches w JOIN issues i ON i.id=w.issue_id JOIN teams t ON t.id=i.team_id
 JOIN workflow_statuses s ON s.id=i.status_id JOIN team_deployment_followups f ON f.team_id=i.team_id
 JOIN vector_github_repositories r ON r.id=w.repository_id AND r.workspace_id=t.workspace_id
 JOIN operators o ON o.id=i.assignee_operator_id AND o.workspace_id=t.workspace_id`;
type Due={repository:string;sha:string;issueId:string;pullNumber:number;mergedAt:string;windowHours:number;followupVersion:number;assignee:string};

/** Scheduled PUSH-003 step. A due merge first rechecks recorded production
 * proof, so a late push proof or deployment settles it without a question.
 * Otherwise its issue's current assignee is asked once: the question entry,
 * watch, Inbox notification and feature audit commit together, and nothing
 * else on the issue changes. */
export async function askDeploymentFollowups(env:{DB:D1Database},now=new Date()){
 const db=env.DB,at=now.toISOString(),result={asked:0,deployed:(await reconcileProductionStatement(env.DB,quiet).run()).meta.changes};
 const rows=(await db.prepare(`SELECT w.repository_id AS repository,w.sha,w.issue_id AS issueId,w.pull_number AS pullNumber,w.merged_at AS mergedAt,
  f.window_hours AS windowHours,f.version AS followupVersion,i.assignee_operator_id AS assignee ${watched}
  WHERE ${visibleRecipient} AND ${due} ORDER BY w.merged_at,w.issue_id LIMIT 100`).bind(at).all<Due>()).results;
 for(const row of rows){
  if((await provenStatement(db,row.repository,row.sha,row.issueId).run()).meta.changes===1){result.deployed++;continue;}
  const event={id:createUlid(now),issueId:row.issueId,actor:null,actorName:'Deployment follow-up',at};
  // The entry names the merge and window only; the watch keeps who was asked.
  const question=JSON.stringify({pullNumber:row.pullNumber,sha:row.sha,mergedAt:row.mergedAt,windowHours:row.windowHours});
  const writes=await db.batch([
   db.prepare(`INSERT INTO issue_activity(id,issue_id,actor_operator_id,actor_name,kind,previous_value_json,next_value_json,created_at,updated_at)
    SELECT ?,i.id,NULL,?,'deployment.followup_asked',NULL,?,?,? ${watched}
    WHERE w.repository_id=? AND w.sha=? AND w.issue_id=? AND i.assignee_operator_id=? AND f.version=? AND ${visibleRecipient} AND ${due}`)
    .bind(event.id,event.actorName,question,at,at,row.repository,row.sha,row.issueId,row.assignee,row.followupVersion,at),
   db.prepare(`UPDATE deployment_followup_watches SET asked_at=?,question_id=?,recipient_id=? WHERE repository_id=? AND sha=? AND issue_id=? AND asked_at IS NULL
    AND EXISTS(SELECT 1 FROM issue_activity WHERE id=? AND issue_id=deployment_followup_watches.issue_id)`)
    .bind(at,event.id,row.assignee,row.repository,row.sha,row.issueId,event.id),
   ...deploymentQuestionStatements(db,event,row.assignee),
   ...finalizeEvent(db,event),
   db.prepare(`INSERT INTO audit_records(id,actor_operator_id,action,subject_identifier,subject_id,created_at,updated_at)
    SELECT a.id,NULL,'deployment.followup_asked',i.identifier,i.id,a.created_at,a.created_at FROM issue_activity a JOIN issues i ON i.id=a.issue_id WHERE a.id=?`).bind(event.id),
  ]);
  if(writes[0]!.meta.changes===1)result.asked++;
 }
 return result;
}
