/** The caller admits the issue before this read and fences access before exposing it. */
export async function githubIssueProjection(db:D1Database,issueId:string){
 return githubIssueFromRows((await githubIssueStatement(db,issueId).all()).results);
}
/** A single statement also serves the admitted streaming document projection. */
export function githubIssueStatement(db:D1Database,issueId:string){
 return db.prepare(`SELECT 'pr' AS type,json_object('repository',r.repository,'number',p.number,'title',p.title,'url',p.url,'state',p.state,'updatedAt',p.updated_at) AS body,p.updated_at AS sort
 FROM vector_github_issue_links l JOIN vector_github_repositories r ON r.id=l.repository_id JOIN vector_github_pull_requests p ON p.repository_id=l.repository_id AND p.number=l.number WHERE l.issue_id=?
 UNION ALL SELECT 'commit',json_object('repository',r.repository,'sha',c.sha,'author',c.author,'subject',c.subject,'url',c.url),c.received_at FROM github_commit_links c JOIN vector_github_repositories r ON r.id=c.repository_id WHERE c.issue_id=?
 ORDER BY sort DESC,body LIMIT 200`).bind(issueId,issueId);
}
export function githubIssueFromRows(rows:D1Result['results']){
 const pullRequests:Record<string,unknown>[]=[],commits:Record<string,unknown>[]=[];
 for(const row of rows as {type:string;body:string}[]){const value=JSON.parse(String(row.body)) as Record<string,unknown>;(row.type==='pr'?pullRequests:commits).push(value);}
 return {pullRequests,commits};
}
