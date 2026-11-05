import type {DeploymentReport} from './schema';
/** Only a recorded merged PR authorizes attachment. Signed non-forced pushes
 * may prove a path to that exact merge SHA, within the same repository. */
const inclusionSql=`WITH RECURSIVE included(sha) AS (
 SELECT ? UNION SELECT j.value FROM github_push_proofs p JOIN included head ON p.after_sha=head.sha
  JOIN json_each(p.ancestors_json) j WHERE p.repository_id=?
) SELECT DISTINCT i.id,i.team_id,i.version FROM vector_github_issue_links l
 JOIN vector_github_pull_requests p ON p.repository_id=l.repository_id AND p.number=l.number
 JOIN issues i ON i.id=l.issue_id JOIN teams t ON t.id=i.team_id
 WHERE l.repository_id=? AND p.state='merged' AND p.merge_sha IN(SELECT sha FROM included)
  AND t.workspace_id=? ORDER BY i.id LIMIT 201`;
const values=(input:DeploymentReport,workspace:string)=>[input.sha,input.repositoryId,input.repositoryId,workspace];
export type IncludedIssue={id:string;team_id:string;version:number};
export function includedIssues(db:D1Database,input:DeploymentReport,workspace:string){
 return db.prepare(inclusionSql).bind(...values(input,workspace));
}
/** Preparation is optimistic. Recheck the complete included set in the same
 * transaction as its receipt, rather than trusting earlier merge or push reads. */
export function inclusionGuard(db:D1Database,input:DeploymentReport,workspace:string,issues:IncludedIssue[]){
 return db.prepare(`SELECT CASE WHEN (SELECT json_group_array(json_object('id',id,'team_id',team_id,'version',version))
  FROM (${inclusionSql}))=? THEN 1 ELSE json('deployment inclusion changed') END`)
  .bind(...values(input,workspace),JSON.stringify(issues.map(({id,team_id,version})=>({id,team_id,version}))));
}
