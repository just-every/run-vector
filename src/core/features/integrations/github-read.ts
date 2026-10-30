/** The caller admits the issue before this read and fences access before exposing it. */
export async function githubIssueProjection(db:D1Database,issueId:string){
 return githubIssueFromRows((await githubIssueStatement(db,issueId).all()).results);
}
/** A single statement also serves the admitted streaming document projection. */
export function githubIssueStatement(db:D1Database,issueId:string){
 return db.prepare(`SELECT 'pr' AS type,json_object('repository',r.repository,'number',p.number,'title',p.title,'url',p.url,'state',p.state,'updatedAt',p.updated_at) AS body,p.updated_at AS sort
 FROM vector_github_issue_links l JOIN vector_github_repositories r ON r.id=l.repository_id JOIN vector_github_pull_requests p ON p.repository_id=l.repository_id AND p.number=l.number WHERE l.issue_id=?
 UNION ALL SELECT 'commit',json_object('repository',r.repository,'sha',c.sha,'author',c.author,'subject',c.subject,'url',c.url),c.received_at FROM github_commit_links c JOIN vector_github_repositories r ON r.id=c.repository_id WHERE c.issue_id=?

 UNION ALL SELECT 'deployment',json_object('repository',r.repository,'deploymentId',d.deployment_id,'sha',d.sha,'environment',d.environment,'deployedAt',d.deployed_at),d.deployed_at FROM github_issue_environments e JOIN github_deployments d ON d.repository_id=e.repository_id AND d.deployment_id=e.deployment_id JOIN vector_github_repositories r ON r.id=d.repository_id WHERE e.issue_id=?
 UNION ALL SELECT 'followup',json_object('repository',r.repository,'pullNumber',w.pull_number,'sha',w.sha,'mergedAt',w.merged_at,'productionAt',w.production_at,'askedAt',w.asked_at,
  'recipient',(SELECT name FROM operators WHERE id=w.recipient_id),
  'answeredAt',(SELECT MIN(c.created_at) FROM issue_comments c WHERE c.issue_id=w.issue_id AND c.actor_operator_id=w.recipient_id AND c.deleted_at IS NULL AND c.created_at>=w.asked_at)),w.merged_at
 FROM deployment_followup_watches w JOIN vector_github_repositories r ON r.id=w.repository_id WHERE w.issue_id=?
 ORDER BY sort DESC,body LIMIT 300`).bind(issueId,issueId,issueId,issueId);
}
export function githubIssueFromRows(rows:D1Result['results']){
 const pullRequests:Record<string,unknown>[]=[],commits:Record<string,unknown>[]=[],deployments:Record<string,unknown>[]=[],productionFollowups:Record<string,unknown>[]=[];
 const lists:Record<string,Record<string,unknown>[]>={pr:pullRequests,commit:commits,deployment:deployments,followup:productionFollowups};
 for(const row of rows as {type:string;body:string}[])lists[row.type]!.push(JSON.parse(String(row.body)) as Record<string,unknown>);
 return {pullRequests,commits,deployments,productionFollowups};
}
