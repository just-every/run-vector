/** The caller admits the issue before this read and fences access before exposing it. */
export async function githubIssueProjection(db: D1Database, issueId: string) {
  return githubIssueFromRows((await githubIssueStatement(db, issueId).all()).results);
}

export function githubIssueStatement(db: D1Database, issueId: string) {
  return db.prepare(`SELECT r.repository,p.number,p.title,p.url,p.state,p.updated_at AS updatedAt FROM vector_github_issue_links l JOIN vector_github_repositories r ON r.id=l.repository_id JOIN vector_github_pull_requests p ON p.repository_id=l.repository_id AND p.number=l.number WHERE l.issue_id=? ORDER BY p.updated_at DESC,p.number LIMIT 100`).bind(issueId);
}

export function githubIssueFromRows(rows: D1Result['results']) {
  return { pullRequests: rows as Record<string, unknown>[] };
}
