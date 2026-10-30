/** An issue's team production environment: its deploy rule's choice, or
 * production while the team has none (RELEASE-002). */
const environmentOf=(issue:string)=>`lower(COALESCE((SELECT r.production_environment FROM github_automation_rules r JOIN issues i ON i.team_id=r.team_id
 WHERE i.id=${issue} AND r.trigger='deploy'),'production'))`;

/** A merged PR's recorded merge SHA starts one watch per linked issue, inside
 * the signed delivery's transaction. A replay or later delivery never moves
 * GitHub's merge time or the first receipt. A production deployment recorded
 * before the merge (an out-of-order delivery) settles the new watch at once. */
export function mergeStatements(db:D1Database,repository:string,pull:number,sha:string,mergedAt:string,recordedAt:string,issueIds:string[]){
 return issueIds.flatMap(issue=>[
  db.prepare('INSERT INTO deployment_followup_watches(repository_id,sha,issue_id,pull_number,merged_at,recorded_at) VALUES(?,?,?,?,?,?) ON CONFLICT(repository_id,sha,issue_id) DO NOTHING').bind(repository,sha,issue,pull,mergedAt,recordedAt),
  provenStatement(db,repository,sha,issue),
 ]);
}

/** Record the earliest recorded successful deployment to the issue's
 * production environment whose SHA is the merge SHA or descends from it
 * through signed non-forced pushes. Unknown SHAs and other environments never qualify. */
export function provenStatement(db:D1Database,repository:string,sha:string,issue:string){
 return db.prepare(`WITH RECURSIVE descendants(sha) AS (
  SELECT ? UNION SELECT p.after_sha FROM github_push_proofs p JOIN json_each(p.ancestors_json) j JOIN descendants d ON j.value=d.sha WHERE p.repository_id=?
 ), proof AS (
  SELECT deployment_id,deployed_at FROM github_deployments WHERE repository_id=? AND sha IN (SELECT sha FROM descendants) AND lower(environment)=${environmentOf('?')}
  ORDER BY deployed_at,deployment_id LIMIT 1
 )
 UPDATE deployment_followup_watches SET production_deployment_id=(SELECT deployment_id FROM proof),production_at=(SELECT deployed_at FROM proof)
 WHERE repository_id=? AND sha=? AND issue_id=? AND production_at IS NULL AND EXISTS(SELECT 1 FROM proof)`)
  .bind(sha,repository,repository,issue,repository,sha,issue);
}

/** A successful deployment records when each watched merge it includes reached
 * the watched issue's production environment, once; replays change nothing. */
export function productionStatement(db:D1Database,repository:string,deployment:{id:number;sha:string;environment:string},at:string){
 return db.prepare(`WITH RECURSIVE included(sha) AS (
  SELECT ? UNION SELECT j.value FROM github_push_proofs p JOIN included head ON p.after_sha=head.sha JOIN json_each(p.ancestors_json) j WHERE p.repository_id=?
 )
 UPDATE deployment_followup_watches SET production_deployment_id=?,production_at=?
 WHERE repository_id=? AND production_at IS NULL AND sha IN (SELECT sha FROM included) AND lower(?)=${environmentOf('deployment_followup_watches.issue_id')}`)
  .bind(deployment.sha,repository,deployment.id,at,repository,deployment.environment);
}
